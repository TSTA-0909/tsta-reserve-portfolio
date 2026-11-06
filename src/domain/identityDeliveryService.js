// TSTA: 予約/繰り上げ通知の人物解決。ブラウザ由来stableIdとPerson IDを混同しない。
// Firestoreの既存予約・試合記録は変更せず、読取時だけ正本人物へ照合する。
const clean = value => String(value ?? '').trim();
const normalName = value => clean(value).normalize('NFKC').replace(/[\s\u3000]+/g, '').toLowerCase();

// フルネームの取り違えを防ぐ。ニックネームや名字のみならここでは否定しない。
export function hasClearDifferentGivenName(recordedName, person = {}) {
  const last = normalName(person.lastName);
  const first = normalName(person.firstName);
  const record = normalName(recordedName);
  if (!last || !first || !record.startsWith(last)) return false;
  const recordedGiven = record.slice(last.length);
  return Boolean(recordedGiven && recordedGiven !== first);
}

export async function resolveDeliveryOwner(row = {}, identityResolver = null, db = null) {
  const uid = clean(row.uid || row.bookerUid);
  const participantKey = clean(row.participantKey);
  const isSelf = row.participantKind === 'self' ||
    (!row.participantKind && (!participantKey || participantKey === `self:${uid}`));
  // 紹介参加者の個人IDは紹介者のIDと同一にしない。送信先だけを紹介者で解決する。
  const declared = clean(isSelf ? row.globalStableId : row.bookerGlobalStableId);
  let uidCanonical = '';
  let declaredCanonical = '';
  try {
    if (uid && identityResolver?.resolveUid) {
      uidCanonical = clean((await identityResolver.resolveUid(uid))?.canonicalPersonId);
    }
    if (declared && identityResolver?.resolvePersonId) {
      declaredCanonical = clean((await identityResolver.resolvePersonId(declared))?.canonicalPersonId);
    }
  } catch (error) {
    return { uid, personId: '', isSelf, issue: 'identity_lookup_failed', error: String(error?.message || error) };
  }
  if (uidCanonical && declaredCanonical && uidCanonical !== declaredCanonical) {
    return { uid, personId: '', isSelf, issue: 'uid_person_conflict' };
  }
  const personId = declaredCanonical || uidCanonical;
  if (isSelf && personId && db) {
    try {
      const snap = await db.collection('persons').doc(personId).get();
      if (snap.exists && hasClearDifferentGivenName(row.name, snap.data() || {})) {
        return { uid, personId: '', isSelf, issue: 'full_name_conflict' };
      }
      if (snap.exists && uid) {
        const userSnap = await db.collection('users').doc(uid).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        if (user.lastName && user.firstName && hasClearDifferentGivenName(
          `${user.lastName}${user.firstName}`, snap.data() || {})) {
          return { uid, personId: '', isSelf, issue: 'account_person_name_conflict' };
        }
      }
    } catch (error) {
      return { uid, personId: '', isSelf, issue: 'profile_lookup_failed', error: String(error?.message || error) };
    }
  }
  return { uid, personId, isSelf, issue: '' };
}

function millis(value) {
  if (value?.toMillis) return Number(value.toMillis()) || 0;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

// 同一FCMトークンが別UIDの旧文書に残っていた場合、最新の登録だけを有効な送信先とする。
// UID/Personが矛盾する文書を送信に使わない。Browser stableIdでの転送はしない。
export async function collectDeliveryTokens(db, identityResolver, { uid = '', personId = '' } = {}) {
  const targetUid = clean(uid);
  const targetPerson = clean(personId);
  if (targetPerson) {
    // 既に誤統合の疑いがある正本は通知を自動配送しない（誤通知より保留を優先）。
    const personSnap = await db.collection('persons').doc(targetPerson).get();
    const canonical = personSnap.exists ? (personSnap.data() || {}) : {};
    for (const aliasId of (canonical.mergedFromGlobalStableIds || []).slice(0, 30)) {
      const aliasSnap = await db.collection('persons').doc(aliasId).get();
      if (!aliasSnap.exists) continue;
      const alias = aliasSnap.data() || {};
      const fullCanonical = normalName(`${canonical.lastName || ''}${canonical.firstName || ''}`);
      const fullAlias = normalName(`${alias.lastName || ''}${alias.firstName || ''}`);
      if (canonical.lastName && canonical.firstName && alias.lastName && alias.firstName && fullCanonical !== fullAlias) {
        return [];
      }
    }
  }
  const snapshot = await db.collection('tokens').get();
  const all = snapshot.docs.map(docSnap => ({
    ref: docSnap.ref,
    id: docSnap.id,
    ...docSnap.data(),
    token: clean(docSnap.data()?.token),
    uid: clean(docSnap.data()?.uid || (docSnap.id.includes('__') ? '' : docSnap.id)),
    refreshedAt: Math.max(millis(docSnap.data()?.updatedAt), millis(docSnap.data()?.timestamp))
  })).filter(row => row.token && row.uid && row.active !== false);
  const byToken = new Map();
  for (const row of all) {
    const existing = byToken.get(row.token);
    if (!existing || row.refreshedAt > existing.refreshedAt) {
      byToken.set(row.token, row);
    } else if (row.refreshedAt === existing.refreshedAt && row.uid !== existing.uid) {
      // 最新の所有者が曖昧なトークンは送信しない。
      byToken.set(row.token, { ...row, ambiguousOwner: true });
    }
  }
  const resolvedUids = new Map();
  const selected = [];
  for (const row of byToken.values()) {
    if (row.ambiguousOwner) continue;
    let ownerPerson = '';
    if (identityResolver?.resolveUid) {
      if (!resolvedUids.has(row.uid)) {
        try { resolvedUids.set(row.uid, clean((await identityResolver.resolveUid(row.uid))?.canonicalPersonId)); }
        catch { resolvedUids.set(row.uid, ''); }
      }
      ownerPerson = resolvedUids.get(row.uid);
    }
    if (targetPerson) {
      if (ownerPerson !== targetPerson) continue;
    } else if (row.uid !== targetUid) {
      continue;
    }
    // 人物との紐づけを確認できない古いトークンは、UIDが直接一致する場合だけ送る。
    selected.push(row);
  }
  return selected;
}

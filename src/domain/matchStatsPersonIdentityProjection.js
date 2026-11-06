// 管理者の「みんなの戦績一覧表」専用の表示時人物照合。
// Firestoreの試合原本は変更せず、Person EngineのIDで同一人物の戦績を集約する。
// 氏名だけでは絶対に人物を統合しない。
import { clearlyDifferentPersonNames, conflictsWithPersonName, isAmbiguousSurnameOnly, fullPersonName } from './matchPersonNameGuard.js';
import { reviewMatchesPlayer } from './matchIdentityReviewPolicy.js';
const clean = value => String(value ?? '').trim();
const compactName = value => clean(value).normalize('NFKC').replace(/[\s\u3000]+/g, '').toLowerCase();
const SIDES = ['pair1', 'pair2'];
// 区分の切替でPerson Engineを何度も読まないため、短時間だけ結果を再利用する。
const READ_CACHE_MS = 60 * 1000;
const personReadCaches = new WeakMap();
const linkReadCaches = new WeakMap();
function getCacheForLoader(caches, loader) {
  let cache = caches.get(loader);
  if (!cache) { cache = new Map(); caches.set(loader, cache); }
  return cache;
}
async function cachedRead(cache, key, load) {
  const now = Date.now();
  const old = cache.get(key);
  if (old && now - old.at < READ_CACHE_MS) return old.value;
  const pending = Promise.resolve().then(load);
  cache.set(key, { at: now, value: pending });
  try { return await pending; }
  catch (error) { if (cache.get(key)?.value === pending) cache.delete(key); throw error; }
}

async function mapWithConcurrency(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await fn(items[index]); }
      catch (error) { output[index] = { error }; }
    }
  }));
  return output;
}

/**
 * @param {Array} results selectMatchResultsForStats済みの試合結果
 * @param {Object} options 人物正本・AccountLinkの読み取り関数（副作用なし）
 */
export async function projectMatchResultsForAdminStats(results = [], {
  loadPerson = async () => null,
  loadAccountLink = async () => null
} = {}) {
  const records = Array.isArray(results) ? results : [];
  const stableIds = new Set();
  const personNames = new Map();
  for (const record of records) {
    for (const side of SIDES) for (const player of (Array.isArray(record?.[side]) ? record[side] : [])) {
      const id = clean(player?.globalStableId);
      if (id) stableIds.add(id);
      const reviewedId = clean(player?.statsIdentityReview?.targetPersonId);
      if (reviewedId) stableIds.add(reviewedId);
      if (!id && !reviewedId) continue;
      const name = compactName(player?.name || player?.displayName);
      if (!personNames.has(id)) personNames.set(id, new Set());
      if (name) personNames.get(id).add(name);
    }
  }
  if (!stableIds.size) return { results: records, verifiedPersonCount: 0, linkedPlayerCount: 0, unresolvedPersonCount: 0 };

  const ids = [...stableIds];
  const personsLoaded = await mapWithConcurrency(ids, 6, async id => cachedRead(getCacheForLoader(personReadCaches, loadPerson), id, () => loadPerson(id)));
  const personById = new Map();
  const aliases = new Map();
  const sourcePersons = new Map();
  const conflicts = [];
  const verifiedIds = new Set();
  for (let i = 0; i < ids.length; i += 1) {
    const person = personsLoaded[i];
    if (!person || person.error || typeof person !== 'object') continue;
    const id = ids[i];
    // 統合済みの人物であっても、同じ人物と明示されている正本IDだけに寄せる。
    const canonical = clean(person.mergedIntoGlobalStableId || person.supersededByGlobalStableId || person.mergedInto || id);
    sourcePersons.set(id, person);
    personById.set(id, canonical);
    verifiedIds.add(id);
    const name = compactName(person.displayName || person.name);
    if (!personNames.has(canonical)) personNames.set(canonical, new Set());
    if (name) personNames.get(canonical).add(name);
    for (const uid of [person.primaryUid, ...(Array.isArray(person.linkedUids) ? person.linkedUids : [])]) {
      const value = clean(uid);
      if (!value) continue;
      if (!aliases.has(value)) aliases.set(value, new Set());
      aliases.get(value).add(canonical);
    }
  }

  // 試合原本に同居したUIDと人物IDだけを根拠に他の試合を帰属させない。
  // 過去に紹介者UIDが別人の試合へ書き込まれた可能性があるため。

  // 旧形式のUID-only戦績で、正本Person側のlinkedUidsに漏れがあれば
  // personAccountLinksを確認する。名前は検索負荷を減らす用途のみで、帰属の根拠にしない。
  const namesToCheck = new Set([...personNames.values()].flatMap(set => [...set]));
  const oldUids = [...new Set(records.flatMap(record => SIDES.flatMap(side =>
    (Array.isArray(record?.[side]) ? record[side] : [])
      .filter(p => !clean(p.globalStableId) && clean(p.uid) && namesToCheck.has(compactName(p.name || p.displayName)))
      .map(p => clean(p.uid))
  )))].filter(uid => !aliases.has(uid));
  // 上限付き。超過しても旧記録を間違った人物へ紐づけない。
  const links = await mapWithConcurrency(oldUids.slice(0, 80), 8, async uid => cachedRead(getCacheForLoader(linkReadCaches, loadAccountLink), uid, () => loadAccountLink(uid)));
  for (let i = 0; i < links.length; i += 1) {
    const id = clean(links[i]?.globalStableId);
    if (!id) continue;
    const canonical = personById.get(id);
    if (!canonical) continue;
    aliases.set(oldUids[i], new Set([canonical]));
  }

  const canonicalIds = [...new Set([...personById.values()])];
  const canonicalProfiles = await mapWithConcurrency(canonicalIds, 6, async id =>
    cachedRead(getCacheForLoader(personReadCaches, loadPerson), id, () => loadPerson(id)));
  const canonicalById = new Map();
  canonicalIds.forEach((id, index) => {
    const data = canonicalProfiles[index];
    if (data && !data.error) canonicalById.set(id, data);
  });
  // 正本プロフィールと統合元プロフィールの「名字＋名前」が違う場合、
  // 旧IDは自動で新IDへ読み替えない。元の履歴を保持し管理者診断へ出す。
  for (const [sourceId, targetId] of personById) {
    if (sourceId === targetId) continue;
    const source = sourcePersons.get(sourceId), target = canonicalById.get(targetId);
    if (clearlyDifferentPersonNames(source, target)) {
      personById.set(sourceId, sourceId);
      canonicalById.set(sourceId, source);
      conflicts.push({ reason: '統合元と正本の本名が不一致', rawPersonId: sourceId,
        canonicalPersonId: targetId, recordedName: fullPersonName(source), canonicalName: fullPersonName(target), matchId: '' });
    }
  }
  // IDの紐づけを調整したら別名UIDも作り直す。別人のUIDを原本から推測しない。
  aliases.clear();
  for (const [sourceId, person] of sourcePersons) {
    const personId = personById.get(sourceId);
    for (const uid of [person.primaryUid, ...(Array.isArray(person.linkedUids) ? person.linkedUids : [])]) {
      const value = clean(uid); if (!value) continue;
      if (!aliases.has(value)) aliases.set(value, new Set());
      aliases.get(value).add(personId);
    }
  }
  for (let i = 0; i < links.length; i += 1) {
    const linkedId = clean(links[i]?.globalStableId);
    const mapped = personById.get(linkedId);
    if (mapped && oldUids[i]) {
      if (!aliases.has(oldUids[i])) aliases.set(oldUids[i], new Set());
      aliases.get(oldUids[i]).add(mapped);
    }
  }
  const conflictingCanonicalIds = new Set();
  for (const record of records) for (const side of SIDES) for (const player of (Array.isArray(record?.[side]) ? record[side] : [])) {
    const personId = personById.get(clean(player?.globalStableId));
    const profile = canonicalById.get(personId);
    if (personId && profile && conflictsWithPersonName(player?.name || player?.displayName, profile)) {
      conflictingCanonicalIds.add(personId);
    }
  }

  let linkedPlayerCount = 0;
  const projected = records.map(record => {
    const copy = { ...record };
    for (const side of SIDES) {
      copy[side] = (Array.isArray(record[side]) ? record[side] : []).map((player,index) => {
        if (!player || typeof player !== 'object') return player;
        const stable = personById.get(clean(player.globalStableId));
        const uid = clean(player.uid);
        const uidIds = aliases.get(uid);
        const fallbackMapped = stable || (uidIds?.size === 1 ? [...uidIds][0] : '');
        const proposedReview = player.statsIdentityReview;
        const reviewedId = clean(proposedReview?.targetPersonId);
        const reviewedMapped = personById.get(reviewedId);
        const reviewedProfile = canonicalById.get(reviewedMapped);
        const reviewApproved = Boolean(reviewedMapped && reviewedProfile &&
          reviewMatchesPlayer(proposedReview,player,{
            matchId:clean(record.id || record.matchId),side,index,
            canonicalId:reviewedMapped,canonicalName:fullPersonName(reviewedProfile)
          }) && (proposedReview.decision !== 'same_person_alias' || reviewedMapped === stable));
        const mapped = reviewApproved ? reviewedMapped : fallbackMapped;
        // 「同一人物・表記揺れ」の承認だけでは、別PersonのUIDを正当化しない。
        // 登録UIDが正本の既知リンクに含まれないなら、別途人物確認が必要。
        if (reviewApproved && proposedReview.decision === 'same_person_alias' && uid &&
            !aliases.get(uid)?.has(mapped)) {
          conflicts.push({ side,index, originalUid:uid, reason:'承認した本名とUIDの人物リンクが一致しない',
            rawPersonId:clean(player.globalStableId),canonicalPersonId:mapped,
            recordedName:clean(player.name||player.displayName),canonicalName:fullPersonName(reviewedProfile),
            matchId:clean(record.id||record.matchId||''),date:clean(record.date||'') });
          return { ...player, uid:'',statsIdentityHeld:true };
        }
        // 原本のPerson IDと登録UIDのリンクが矛盾したら集計せず管理者確認へ。
        if (!(reviewApproved && proposedReview.decision === 'reassign_person') && stable && uidIds?.size && !uidIds.has(stable)) {
          conflicts.push({ side,index, originalUid:uid, reason:'試合の人物IDとUIDの帰属が不一致',
            rawPersonId:clean(player.globalStableId), canonicalPersonId:stable,
            recordedName:clean(player.name||player.displayName), canonicalName:fullPersonName(canonicalById.get(stable)),
            matchId:clean(record.id||record.matchId||''),date:clean(record.date||'') });
          return { ...player, uid:'', statsIdentityHeld:true };
        }
        if (!mapped) return { ...player };
        const profile = canonicalById.get(mapped);
        const rawName = clean(player.name || player.displayName);
        if (!reviewApproved && profile && (conflictsWithPersonName(rawName, profile) ||
          (conflictingCanonicalIds.has(mapped) && isAmbiguousSurnameOnly(rawName, profile)))) {
          conflicts.push({ side,index, originalUid:uid, reason:'試合記録の本名とPerson IDが不一致', rawPersonId:clean(player.globalStableId),
            canonicalPersonId:mapped, recordedName:rawName, canonicalName:fullPersonName(profile),
            matchId:clean(record.id || record.matchId || ''), date:clean(record.date || '') });
          // 誤った人物の勝敗に絶対加算しない。試合原本は変更しない。
          return { ...player, uid:'', statsIdentityHeld:true };
        }
        if (uid === `person:${mapped}`) return { ...player, statsCanonicalName:fullPersonName(profile) || player.name };
        linkedPlayerCount += 1;
        return { ...player, uid: `person:${mapped}`,
          statsCanonicalName:fullPersonName(profile) || player.name, statsIdentityNormalized: true };
      });
    }
    return copy;
  });
  return { results: projected, verifiedPersonCount: verifiedIds.size,
    linkedPlayerCount, unresolvedPersonCount: ids.length - verifiedIds.size, conflicts };
}

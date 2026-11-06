export function createOfferEngine(deps) {
  const {
    db,
    FieldValue,
    Timestamp,
    logger,
    getMessaging,
    sendOfferPushToUid,

    CONFIG_COLL,
    RESERVATIONS_COLL,
    WAITLIST_COLL,
    OFFERS_COLL,
    OFFER_KEYS_COLL,

    OFFER_TTL_MIN,
    DEFAULT_TIME,

    keyId,
    nowTs,
    addMinutes,

    normType,
    getWaitlistQueue,
    getOpenSlots,
    pickByCursor,
    diag,
    mkTraceId
  } = deps;

  // ===== 内部関数 =====

  async function advanceCursor(date, type) {
    const t = normType(type);
    if (!date || !t) return;
    const keyRef = db.collection(OFFER_KEYS_COLL).doc(keyId(date, t));

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(keyRef);
      const key = snap.exists ? (snap.data() || {}) : {};
      const cur = Number.isFinite(Number(key.currentIndex)) ? Number(key.currentIndex) :
        Number.isFinite(Number(key.cursorIndex)) ? Number(key.cursorIndex) : 0;

      const queue = await getWaitlistQueue(date, t);
      if (!queue.length) {
        tx.set(keyRef, { currentIndex: 0, cursorIndex: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return;
      }

      const next = cur + 1;
      if (next >= queue.length) {
        const rounds = Number.isFinite(Number(key.rounds)) ? Number(key.rounds) : 0;
        tx.set(
          keyRef,
          { currentIndex: 0, cursorIndex: 0, rounds: rounds + 1, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      } else {
        tx.set(keyRef, { currentIndex: next, cursorIndex: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });
  }

  async function expireAndRotateOneOffer(offerRef, offer, status = "expired") {
    const date = offer?.date;
    const type = normType(offer?.type);
    if (!date || !type) return;

    const removeWaitlist = status === "declined";

    await db.runTransaction(async (tx) => {
      tx.set(
        offerRef,
        { status, updatedAt: FieldValue.serverTimestamp(), expiredAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      if (removeWaitlist && offer?.waitlistId) {
        for (const id of [...new Set([offer.waitlistId,...(offer.waitlistIds || [])])]) {
          tx.delete(db.collection(WAITLIST_COLL).doc(String(id)));
        }
      }

      const keyRef = db.collection(OFFER_KEYS_COLL).doc(keyId(date, type));
      tx.set(
        keyRef,
        { pendingOfferId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });

    await advanceCursor(date, type);
    await issueOfferIfPossible(date, type, "expire_rotate_next");
  }

  async function issueOfferIfPossible(date, type, reason = "manual") {

    const traceId = mkTraceId();

    try {
      const t = normType(type);
      if (!date || !t) {
        return;
      }

      const keyRef = db.collection(OFFER_KEYS_COLL).doc(keyId(date, t));
      const offersRef = db.collection(OFFERS_COLL);

      let issued = null;

      const queue = await getWaitlistQueue(date, t);
      if (!queue.length) {
        return;
      }

      const { open } = await getOpenSlots(date, t);

      await db.runTransaction(async (tx) => {
        const keySnap = await tx.get(keyRef);
        const key = keySnap.exists ? (keySnap.data() || {}) : {};

        const hasHold = !!key.holdReservationId && (Number(key.rounds || 0) < 1);

        if (open <= 0 && !hasHold) {
          return;
        }

        const pendingOfferId = key.pendingOfferId || null;
        if (pendingOfferId) { // 修正箇所
          const pendingRef = offersRef.doc(String(pendingOfferId)); // 修正箇所
          const pendingSnap = await tx.get(pendingRef); // 修正箇所
          const pending = pendingSnap.exists ? (pendingSnap.data() || {}) : null; // 修正箇所
          const pendingStatus = String(pending?.status || ""); // 修正箇所
          const pendingExpiresAt = pending?.expiresAt?.toMillis ? pending.expiresAt.toMillis() : 0; // 修正箇所
          const nowMillis = nowTs().toMillis(); // 修正箇所
          const isActivePending = pendingSnap.exists && pendingStatus === "pending" && (!pendingExpiresAt || pendingExpiresAt > nowMillis); // 修正箇所

          if (isActivePending) {
            return; // 修正箇所：有効なpendingがある場合だけ新規offerを止める
          }

          if (pendingSnap.exists && pendingStatus === "pending" && pendingExpiresAt && pendingExpiresAt <= nowMillis) { // 修正箇所
            tx.set( // 修正箇所
              pendingRef, // 修正箇所
              { status: "expired", updatedAt: FieldValue.serverTimestamp(), expiredAt: FieldValue.serverTimestamp() }, // 修正箇所
              { merge: true } // 修正箇所
            ); // 修正箇所
          } // 修正箇所

          tx.set( // 修正箇所
            keyRef, // 修正箇所
            { pendingOfferId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, // 修正箇所
            { merge: true } // 修正箇所
          ); // 修正箇所
        } // 修正箇所

        const picked = pickByCursor(queue, key);
        if (!picked) {
          return;
        }

        const { idx, row } = picked;

        const targetUid = String(row.uid || "");
        const targetStableId = String(row.stableId || "");
        const recipient = row.__recipient || {};
        const toGlobalStableId = String(recipient.personId || "");
        if (recipient.issue) {
          // 人物ID/名前が矛盾する行を別人に届けない。待機順は変えず管理者調査対象。
          logger.warn("WL_DIAG waitlist identity requires review", { traceId, waitlistId: row.id, issue: recipient.issue });
          return;
        }
        if (!targetUid && !toGlobalStableId) {
          return; // 修正箇所：uid主軸のため、uidがない行にはofferを発行しない
        }

        const offerRef = offersRef.doc();
        const createdAt = nowTs();
        const expiresAt = addMinutes(createdAt, OFFER_TTL_MIN);

        tx.set(offerRef, {
          date,
          type: t,
          time: DEFAULT_TIME,
          toUid: targetUid,
          toGlobalStableId,
          identitySchemaVersion: 2,
          toStableId: targetStableId,
          uid: targetUid,
          globalStableId: recipient.isSelf ? toGlobalStableId : "",
          bookerGlobalStableId: recipient.isSelf ? "" : toGlobalStableId,
          stableId: targetStableId,
          toName: row.name || "",
          waitlistId: row.id,
          waitlistIds: row.__ids || [row.id],
          participantKey: row.participantKey || `self:${targetUid}`,
          participantKind: row.participantKind || (recipient.isSelf ? 'self' : 'proxy'),
          participantKeyVersion: Number(row.participantKeyVersion || 1),
          status: "pending",
          reason,
          createdAt,
          expiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(
          keyRef,
          {
            date,
            type: t,
            pendingOfferId: offerRef.id,
            currentWaitlistId: row.id,
            currentIndex: idx,
            cursorIndex: idx,
            rounds: Number.isFinite(key.rounds) ? key.rounds : 0,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        issued = {
          toUid: targetUid,
          toStableId: targetStableId,
          toGlobalStableId,
          offerId: offerRef.id,
          date,
          type: t
        };

      });

      if (issued?.toUid || issued?.toGlobalStableId) {

        // 修正箇所：uid主軸で通知し、stableIdは補助情報として渡す
        await sendOfferPushToUid(issued.toUid, {
          ...issued,
          toStableId: issued.toStableId,
          toGlobalStableId: issued.toGlobalStableId
        });
      } else {
      }

    } catch (e) {
      logger.error("offerEngine error", { message: String(e) });
    }
  }

  return {
    issueOfferIfPossible,
    advanceCursor,
    expireAndRotateOneOffer
  };
}
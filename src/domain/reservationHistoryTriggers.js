import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {
  buildReservationHistoryEvent,
  didReservationBecomeCancelled,
  isHistoryTargetReservation,
  pickReservationEventOccurredAt
} from "../history/reservationHistoryEventFactory.js";

export function createReservationHistoryTriggers({ db, FieldValue, region, identityResolver, participationService = null }) {
  if (!identityResolver?.resolveUid || !identityResolver?.resolvePersonId) {
    throw new Error("reservationHistoryTriggers requires Person Engine identityResolver");
  }
  const recordReservationHistory = onDocumentWritten(
    { region, document: "reservations/{reservationId}" },
    async (event) => {
      const beforeExists = event.data?.before?.exists === true;
      const afterExists = event.data?.after?.exists === true;
      const before = beforeExists ? (event.data.before.data() || {}) : null;
      const after = afterExists ? (event.data.after.data() || {}) : null;
      const reservationId = String(event.params.reservationId || "").trim();

      try {
        if (!beforeExists && afterExists) {
          if (!isHistoryTargetReservation(after)) return;
          await appendReservationEvent({
            db, FieldValue, identityResolver, participationService, reservationId, reservation: after,
            eventType: "reservation_reserved", role: "participant",
            eventTime: pickReservationEventOccurredAt("reservation_reserved", after, event.time)
          });
          return;
        }

        if (beforeExists && afterExists) {
          if (!isHistoryTargetReservation(after)) return;

          if (didReservationBecomeCancelled(before, after)) {
            await appendReservationEvent({
              db, FieldValue, identityResolver, participationService, reservationId, reservation: after,
              eventType: "reservation_cancelled", role: "participant",
              eventTime: pickReservationEventOccurredAt("reservation_cancelled", after, event.time)
            });
          }

          // V20.19: 支払確認(paymentOK)は参加判定に使わない。
          // 参加に影響する項目が変わった時だけ、予約原本から参加/欠席を再判定する。
          if (
            participationService?.reconcileReservation &&
            didParticipationRelevantFieldsChange(before, after)
          ) {
            await participationService.reconcileReservation(reservationId, after);
          }
          return;
        }

        if (beforeExists && !afterExists) {
          if (!isHistoryTargetReservation(before)) return;
          await appendReservationEvent({
            db, FieldValue, identityResolver, participationService, reservationId, reservation: before,
            eventType: "reservation_cancelled", role: "participant",
            eventTime: pickReservationEventOccurredAt("reservation_cancelled", before, event.time)
          });
        }
      } catch (error) {
        logger.error("recordReservationHistory failed", {
          reservationId,
          message: String(error?.message || error)
        });
        throw error;
      }
    }
  );

  return { recordReservationHistory };
}

function didParticipationRelevantFieldsChange(before = {}, after = {}) {
  const fields = [
    "attendanceAbsent",
    "status",
    "date",
    "uid",
    "bookerUid",
    "globalStableId",
    "personId"
  ];
  return fields.some((field) => {
    const a = before?.[field];
    const b = after?.[field];
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}

async function appendReservationEvent({
  db, FieldValue, identityResolver, participationService, reservationId, reservation, eventType, role, eventTime
}) {
  const identity = await resolveReservationPersonIdentity(db, reservation, identityResolver);
  if (!identity.globalStableId) {
    logger.info("reservation history skipped: person identity not linked", {
      reservationId,
      eventType,
      uid: String(reservation?.uid || ""),
      participantKind: String(reservation?.participantKind || "")
    });
    return;
  }

  const historyEvent = buildReservationHistoryEvent({
    reservationId,
    reservation,
    eventType,
    role,
    globalStableId: identity.globalStableId,
    sourceGlobalStableId: identity.sourceGlobalStableId,
    identityClusterId: identity.identityClusterId,
    identityResolutionSource: identity.identityResolutionSource,
    occurredAt: eventTime
  });
  const eventRef = db.collection("historyEvents").doc(historyEvent.eventId);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) return;

    const eventDocument = {
      ...historyEvent.document,
      recordedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    };

    // Firestore Transactionでは全readをwriteより先に行う必要がある。
    // 参加集計は既存historyEventsを読むため、event作成より先に実行する。
    if (eventType === "reservation_attended" && participationService?.writeSummaryInTransaction) {
      await participationService.writeSummaryInTransaction(tx, {
        globalStableId: identity.globalStableId,
        currentEvent: eventDocument
      });
    }

    tx.create(eventRef, eventDocument);
  });
}

async function resolveReservationPersonIdentity(_db, reservation, identityResolver) {
  const participantKind = String(reservation?.participantKind || "").trim().toLowerCase();
  const isGuest = reservation?.isFriend === true || reservation?.isProxyReservation === true ||
    participantKind === "friend" || participantKind === "proxy";
  // Friend/proxy's `uid` is the referrer/booker, NOT the participant. Never attribute
  // reservation history to that UID's Person, including records with stale direct IDs.
  // Guest-person linkage and history migration require separate administrator review.
  if (isGuest) {
    return {
      globalStableId: "", sourceGlobalStableId: "",
      identityClusterId: "", identityResolutionSource: "guest_pending_review"
    };
  }
  const uid = String(reservation?.uid || "").trim();

  if (uid) {
    const resolved = await identityResolver.resolveUid(uid);
    const linkedPersonId = String(resolved?.linkedPersonId || "").trim();
    const canonicalPersonId = String(resolved?.canonicalPersonId || linkedPersonId).trim();
    if (canonicalPersonId) {
      return {
        globalStableId: canonicalPersonId,
        sourceGlobalStableId: linkedPersonId || canonicalPersonId,
        identityClusterId: String(resolved?.identityClusterId || ""),
        identityResolutionSource: String(resolved?.resolutionSource || "self")
      };
    }
  }

  const reservationPersonId = String(reservation?.globalStableId || "").trim();
  if (reservationPersonId) {
    const resolved = await identityResolver.resolvePersonId(reservationPersonId);
    return {
      globalStableId: String(resolved?.canonicalPersonId || reservationPersonId),
      sourceGlobalStableId: reservationPersonId,
      identityClusterId: String(resolved?.identityClusterId || ""),
      identityResolutionSource: String(resolved?.resolutionSource || "self")
    };
  }

  return {
    globalStableId: "",
    sourceGlobalStableId: "",
    identityClusterId: "",
    identityResolutionSource: "none"
  };
}

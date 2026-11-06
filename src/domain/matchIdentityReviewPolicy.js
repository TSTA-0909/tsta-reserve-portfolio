// 試合原本を消さず、管理者による「この試合のこの選手」単位の照合を検証する。
// 同名の別人や旧UIDの誤帰属を自動承認しないため、記録当時の値で固定する。
const clean = v => String(v ?? '').trim();
export const MATCH_IDENTITY_REVIEW_VERSION = 1;
export function reviewMatchesPlayer(review, player, {matchId, side, index, canonicalId, canonicalName} = {}) {
  if (!review || review.version !== MATCH_IDENTITY_REVIEW_VERSION ||
      !['same_person_alias','reassign_person'].includes(review.decision)) return false;
  if (!clean(review.reviewedBy) || !clean(review.reason)) return false;
  if (!clean(matchId) || !['pair1','pair2'].includes(side) || !Number.isInteger(index) || index < 0) return false;
  if (review.matchId !== matchId || review.side !== side || review.index !== index) return false;
  if (clean(review.originalName) !== clean(player?.name || player?.displayName)) return false;
  if (clean(review.originalPersonId) !== clean(player?.globalStableId)) return false;
  if (clean(review.originalUid) !== clean(player?.uid)) return false;
  if (clean(review.targetPersonId) !== clean(canonicalId)) return false;
  // Person Engine側の正本が変わった場合、過去の承認を黙って使い回さない。
  if (clean(review.targetCanonicalName) !== clean(canonicalName)) return false;
  return true;
}
export function snapshotPlayerForReview(player = {}) {
  return {
    name: clean(player?.name || player?.displayName),
    globalStableId: clean(player?.globalStableId),
    uid: clean(player?.uid)
  };
}
export function reviewKey({matchId,side,index}={}) {
  return `${clean(matchId)}::${clean(side)}::${Number(index)}`;
}

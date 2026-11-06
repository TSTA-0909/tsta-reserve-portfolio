// Pure policy: a guest is NOT a Person Engine identity. Never infer identity from names alone.
export const GUEST_ID_PATTERN = /^guest_[a-z0-9-]{20,90}$/i;
export const GUEST_RETENTION_DAYS = 365;
export const clean = value => String(value ?? "").trim();
export function normalizedGuestName(value) {
  return clean(value).normalize("NFKC").replace(/[\s\u3000]+/g, "").toLowerCase();
}
export function isGuestId(value) { return GUEST_ID_PATTERN.test(clean(value)); }
export function guestExpiryForEventDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(dateString))) throw new Error("invalid_guest_event_date");
  const date = new Date(`${dateString}T23:59:59+09:00`);
  if (Number.isNaN(date.valueOf())) throw new Error("invalid_guest_event_date");
  date.setUTCFullYear(date.getUTCFullYear() + 1); // one calendar year, including leap years
  return date;
}
export function validateGuestReuse(previous, { bookerUid, name, eventDate }) {
  if (!previous) return { valid: true, reuse: false };
  if (clean(previous.bookerUid) !== clean(bookerUid)) return { valid: false, reason: "guest_owned_by_another_booker" };
  if (normalizedGuestName(previous.name) !== normalizedGuestName(name)) return { valid: false, reason: "guest_name_changed_requires_review" };
  if (clean(previous.status) === "expired") return { valid: false, reason: "guest_expired" };
  if (previous.expiresAt && typeof previous.expiresAt.toDate === "function" && previous.expiresAt.toDate() < new Date()) return { valid: false, reason: "guest_expired" };
  return { valid: true, reuse: true, expiresAt: guestExpiryForEventDate(eventDate) };
}
export function candidatePersonNames(person = {}) {
  return Array.from(new Set([
    clean(person.name), clean(person.displayName),
    [clean(person.lastName), clean(person.firstName)].filter(Boolean).join(" ")
  ].map(normalizedGuestName).filter(Boolean)));
}
export function isPotentialGuestMatch(guest, person) {
  return ["pending", "expiry_review"].includes(clean(guest?.status)) &&
    !!normalizedGuestName(guest?.name) &&
    candidatePersonNames(person).includes(normalizedGuestName(guest.name)) &&
    clean(person?.status) !== 'superseded' &&
    !clean(person?.mergedIntoGlobalStableId || person?.supersededByGlobalStableId || person?.mergedInto);
}

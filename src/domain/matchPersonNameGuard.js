// Person EngineのIDだけで別人のフルネームを自動統合しないための純粋関数。
const norm = value => String(value ?? '').trim().normalize('NFKC').replace(/[\s\u3000]+/g,'').toLowerCase();
export function fullPersonName(person = {}) {
  const last = norm(person.lastName), first = norm(person.firstName);
  return last && first ? `${last}${first}` : '';
}
export function clearlyDifferentPersonNames(a = {}, b = {}) {
  const aFull = fullPersonName(a), bFull = fullPersonName(b);
  return Boolean(aFull && bFull && aFull !== bFull);
}
export function conflictsWithPersonName(recorded, person = {}) {
  const last = norm(person.lastName), first = norm(person.firstName), value = norm(recorded);
  if (!last || !first || !value.startsWith(last)) return false;
  const given = value.slice(last.length);
  return Boolean(given && given !== first);
}
export function isAmbiguousSurnameOnly(recorded, person = {}) {
  return Boolean(norm(person.lastName) && norm(recorded) === norm(person.lastName));
}

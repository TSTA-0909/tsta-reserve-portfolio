import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedGuestName, isGuestId, guestExpiryForEventDate, validateGuestReuse, isPotentialGuestMatch } from '../src/domain/guestIdentityPolicy.js';

test('名前の空白・表記ゆれを正規化する', () => {
  assert.equal(normalizedGuestName(' 空野　星 '), normalizedGuestName('空野星'));
});
test('ゲストID形式と有効期限を検査する', () => {
  assert.equal(isGuestId('guest_19a12640-12ad-4b19-9c02-369a28e76349'), true);
  assert.equal(isGuestId('person_19a12640-12ad-4b19-9c02-369a28e76349'), false);
  assert.equal(guestExpiryForEventDate('2026-11-05').toISOString().slice(0, 10), '2027-11-05');
});
test('異なる紹介者から同じゲストIDを再利用できない', () => {
  const previous = { bookerUid: 'booker_a', name: '空野 星', status: 'pending' };
  assert.equal(validateGuestReuse(previous,{bookerUid:'booker_b',name:'空野 星',eventDate:'2026-11-05'}).reason,'guest_owned_by_another_booker');
});
test('一致名でも本人確認候補に留める', () => {
  assert.equal(isPotentialGuestMatch({status:'pending',name:'空野 星'}, {name:'空野 星',status:'active'}), true);
  assert.equal(isPotentialGuestMatch({status:'pending',name:'空野 星'}, {name:'空野 昴',status:'active'}), false);
});

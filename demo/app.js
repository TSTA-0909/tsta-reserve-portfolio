import { normalizedGuestName, isPotentialGuestMatch, validateGuestReuse, guestExpiryForEventDate } from '../src/domain/guestIdentityPolicy.js';
import { reviewMatchesPlayer } from '../src/domain/matchIdentityReviewPolicy.js';
const $ = id => document.getElementById(id);
let guest = null;
$('createGuest').addEventListener('click', () => {
  const name = $('guestName').value.trim();
  const bookerUid = $('booker').value;
  if (!name) { $('guestResult').textContent = '名前を入力してください。'; return; }
  const valid = guest ? validateGuestReuse(guest, { bookerUid, name, eventDate: '2026-11-05' }) : {valid:true,reuse:false};
  if (!valid.valid) {
    $('guestResult').textContent = `既存IDの自動再利用は保留：${valid.reason}
（異なる紹介者・別名のゲストは管理者確認が必要）`;
    return;
  }
  if (!valid.reuse) guest = {id:'guest_' + crypto.randomUUID(),name,bookerUid,status:'pending'};
  $('guestResult').textContent = `ゲストID：${guest.id}
紹介者：${bookerUid}
正規化名：${normalizedGuestName(guest.name)}
保有期限（例）：${guestExpiryForEventDate('2026-11-05').toLocaleDateString('ja-JP')}
※本番データは使用していません`;
});
$('checkMatch').addEventListener('click', () => {
  if (!guest) { $('matchResult').textContent = '先に仮IDを作成してください。'; return; }
  const person = {name:$('registeredName').value.trim(),status:'active'};
  const candidate = isPotentialGuestMatch(guest,person);
  $('matchResult').textContent = candidate
    ? `候補あり：名前が一致しました。
ただし同一人物とは断定せず、管理者の本人確認へ進めます。`
    : `候補なし：名前や状態の条件が一致しません。
誤統合を避けるため自動紐付けしません。`;
});
$('checkReview').addEventListener('click', () => {
  const original={name:'空野 星',globalStableId:'person_demo_1',uid:'uid_demo_1'};
  const review={version:1,decision:'same_person_alias',matchId:'match_demo_1',side:'pair1',index:0, originalName:original.name,originalPersonId:original.globalStableId,originalUid:original.uid,targetPersonId:original.globalStableId,targetCanonicalName:'空野星',reason:'管理者が確認',reviewedBy:'admin_demo'};
  const ctx={matchId:'match_demo_1',side:'pair1',index:0,canonicalId:'person_demo_1',canonicalName:'空野星'};
  const ok=reviewMatchesPlayer(review,original,ctx);
  const changed=reviewMatchesPlayer(review,{...original,name:'空野 昴'},ctx);
  $('reviewResult').textContent = `元データ一致：${ok?'承認有効':'保留'}
記録の氏名が変更された場合：${changed?'承認有効':'承認無効・再確認が必要'}
（すべて架空のデータです）`;
});

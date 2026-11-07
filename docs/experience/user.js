import {readState,writeState,prettyDate,calendarHtml,escapeHtml,isFull,countFor,capFor,typeName} from './shared.js';
import {initTour,guideRender,toast} from './tour.js';
import {saveDemoProfile,bookDemo,acceptDemoOffer,chooseDemoCategory,confirmDemoBookingReview} from './engine.js';
const $=id=>document.getElementById(id);
function updateState(f){const s=readState();f(s);writeState(s);return s;}
function initialize(){const s=readState();if(s.stage===4){if(s.guide&&!s.adminBookingReviewed){window.location.replace('admin.html');return;}s.stage=5;s.category='';s.selectedUserDate='';}if(s.stage===8&&s.offer)s.stage=9;writeState(s);$('typeSelf').value=s.category||'';$('profileInput').value=s.profile||'空野 星';
 if(s.stage===5){$('reservationActionPanel').hidden=false;}
 $('profileBtn').addEventListener('click',()=>{$('profileDialog').showModal();guideRender();});
 $('editProfileInline').addEventListener('click',()=>{$('profileDialog').showModal();guideRender();});
 $('profileCancel').addEventListener('click',()=>{$('profileDialog').close();guideRender();});
 $('profileForm').addEventListener('submit',e=>{e.preventDefault();const name=$('profileInput').value.trim();if(name.length<2){toast('架空名を2文字以上で入力してください。');return;}updateState(s=>saveDemoProfile(s,name));$('profileDialog').close();toast('架空プロフィールを保存しました。');render();});
 $('typeSelf').addEventListener('change',e=>{let result;updateState(s=>{result=chooseDemoCategory(s,e.target.value);});render();if(!result.accepted)toast(result.message);});
 // These are accessible HTML options, instead of attempting to style OS-native select options.
 $('pickBeginner').addEventListener('click',()=>{
   let result;updateState(s=>{result=chooseDemoCategory(s,'beginner');});
   render();if(!result.accepted)toast(result.message);
 });
 $('pickExperienced').addEventListener('click',()=>{
   let result;updateState(s=>{result=chooseDemoCategory(s,'experienced');});
   render();if(!result.accepted)toast(result.message);
 });
 $('calendarArea').addEventListener('click',e=>{const el=e.target.closest('button[data-date]');if(!el)return;const s=readState(),date=el.dataset.date;
  if(s.guide&&s.stage===1&&(s.category!=='beginner'||date!==s.dates.open)){toast('まず初心者(B)を選び、オレンジ枠の緑色の日付を押しましょう。');return;}
  if(s.guide&&s.stage===5&&(s.category!=='experienced'||date!==s.dates.full)){toast('経験者(A)を選び、オレンジ枠の濃い灰色の日付を押しましょう。');return;}
  updateState(x=>x.selectedUserDate=date);render();});
 $('reserveBtn').addEventListener('click',()=>{const s=readState(),name=s.profile,date=s.selectedUserDate,type=s.category;
  if(!name){$('profileDialog').showModal();guideRender();return;}
  if(!date||!type){toast('区分と開催日を選んでください。');return;}
  if(s.guide&&s.stage===1&&(type!=='beginner'||date!==s.dates.open)){toast('最初は初心者(B)でオレンジ枠の日付を予約しましょう。');return;}
  if(s.guide&&s.stage===5&&(type!=='experienced'||date!==s.dates.full)){toast('キャンセル待ちは経験者(A)でオレンジ枠の満席日を選びましょう。');return;}
  const full=isFull(s,date,type);
  const already=s.reservations.some(x=>x.mine&&x.date===date&&x.type===type)||s.waits.some(x=>x.mine&&x.date===date&&x.type===type);
  if(already){toast('その日には既に予約またはキャンセル待ちをしています。');return;}
  try{updateState(x=>bookDemo(x,{date,type}));}catch(err){toast(err.message);return;}
  toast(full?'キャンセル待ちに登録しました！':'架空の予約が完了しました！');render();
 });
 $('proxyReserveToggle').addEventListener('change',e=>{$('proxyReserveNameBox').hidden=!e.target.checked;});
 $('addFriendBtn').addEventListener('click',()=>{$('friendInfo').hidden=!$('friendInfo').hidden;});
 $('rentalToggle').addEventListener('change',e=>{$('rentalBox').hidden=!e.target.checked;});
 $('reservationMenu').addEventListener('click',()=>{const node=$('reservationActionPanel');node.hidden=!node.hidden;$('reservationMenu').setAttribute('aria-expanded',String(!node.hidden));guideRender();});
 $('noticeMenu').addEventListener('click',()=>{$('noticePanel').classList.toggle('tour-notice-open');$('noticePanel').scrollIntoView({block:'center',behavior:'smooth'});});
 $('chatMenu').addEventListener('click',()=>toast('チャットは本番機能です。このデモでは外部への送信を行いません。'));
 // Do not let the guided tour skip the confirmation step by clicking the old bottom link.
 $('goAdmin').addEventListener('click',e=>{
   const s=readState();
   if(s.guide && s.stage===2 && !s.bookingReviewed){
     e.preventDefault();toast('まず上の「あなたの予約一覧」で予約を確認しましょう。');
     $('bookingConfirmation').scrollIntoView({behavior:'smooth',block:'center'});
   }
 });
 $('bookingConfirmNext').addEventListener('click',()=>{
   try{updateState(s=>confirmDemoBookingReview(s));}
   catch(err){toast(err.message);return;}
   render();
   toast('予約一覧を確認しました！ 続いて管理者画面へ進みましょう。');
 });
 // The native modal keeps the background inert and traps keyboard focus.
 $('offerModal').addEventListener('cancel',e=>e.preventDefault()); // Escape must not skip the demo confirmation.
 $('offerAccept').addEventListener('click',()=>{try{updateState(x=>acceptDemoOffer(x));render();toast('予約が確定しました。続いて管理者一覧も確認しましょう！');}catch(err){toast(err.message);}});
 $('goAdminPromotion').addEventListener('click',()=>{
   const s=readState();
   if(s.stage!==10 || !s.reservations.some(r=>r.mine&&r.date===s.dates.full&&r.type==='experienced')){
     toast('繰り上がり予約を確認できません。');return;
   }
   updateState(x=>{x.stage=11;x.selectedAdminDate=x.dates.full;});
   window.location.href='admin.html';
 });
 render();initTour('user',render);
}
function render(){const s=readState();$('profileBtn').hidden=Boolean(s.guide&&s.stage>0);$('currentProfile').textContent=s.profile||'未登録（架空名を登録してください）';$('wlCount').textContent=s.waits.filter(w=>w.mine).length;
 const list=$('reservationList'),mine=s.reservations.filter(x=>x.mine);
 list.replaceChildren();if(!mine.length){const p=document.createElement('p');p.className='tour-empty';p.textContent='まだ予約はありません。下の「予約する」から体験できます。';list.appendChild(p);}else{
  mine.forEach(x=>{const div=document.createElement('div');div.className='tour-my-reservation';div.innerHTML=`<span>✅ <strong>${prettyDate(x.date)}</strong>　${escapeHtml(typeName(x.type))}</span><span>${escapeHtml(x.name)}</span>`;list.appendChild(div);});}
 // Show the actual saved reservation at the top before leading to the administrator side.
 const showReview=s.stage===2&&!s.bookingReviewed;
 $('bookingConfirmation').hidden=!showReview;
 $('bookingConfirmDate').textContent=prettyDate(s.dates.open);
 $('goAdmin').classList.toggle('tour-hop-disabled',s.guide&&showReview);
 $('goAdmin').setAttribute('aria-disabled',String(s.guide&&showReview));
 const cat=s.category;$('calendarGuard').hidden=!!cat;$('calendarArea').hidden=!cat;$('calendarArea').innerHTML=cat?calendarHtml(s,s.selectedUserDate,{type:cat}):'';
 const date=s.selectedUserDate,full=!!date&&isFull(s,date,cat),button=$('reserveBtn');
 const ready=Boolean(date&&cat&&s.profile);
 button.textContent=ready?(full?'キャンセル待ちに登録':'予約する'):(s.guide&&s.stage===5?'先に灰色の日付を選択してください':'先に日付を選択してください');
 button.disabled=!ready;button.dataset.wait=String(full);
 button.dataset.ready=String(ready&&!full);
 $('selectionStatus').textContent=date
   ?`✅ ${prettyDate(date)}を選択済み！　${typeName(cat)}　${full?'満席：キャンセル待ちに登録できます':'空きあり：下のボタンで予約できます'}`
   :s.guide&&s.stage===1&&cat==='beginner'
     ?`まだ日付が未選択です。オレンジ枠の${prettyDate(s.dates.open)}をクリックすると「予約する」が押せます。`
   :s.guide&&s.stage===5&&cat==='experienced'
     ?`まだ日付が未選択です。オレンジ枠の${prettyDate(s.dates.full)}をクリックするとキャンセル待ちに登録できます。`
   :'開催日を選んでください。';
 $('typeSelf').value=cat;
 const showBeginnerPick=Boolean(s.guide&&s.stage===1&&cat!=='beginner');
 const showExperiencedPick=Boolean(s.guide&&s.stage===5&&cat!=='experienced');
 $('experiencePick').hidden=!(showBeginnerPick||showExperiencedPick);
 $('pickBeginner').hidden=!showBeginnerPick;
 $('pickExperienced').hidden=!showExperiencedPick;
 $('experiencePickCaption').textContent=showBeginnerPick
   ? '👇 最初はこの区分を選んでください（ここを押して選択できます）'
   : '👇 次に選ぶ項目（ここを押して選択できます）';
 const offer=s.offer,offerDialog=$('offerModal');
 if(offer){
  $('offerText').textContent=`${prettyDate(offer.date)} ${typeName(offer.type)} に空きが出ました。`;
  if(!offerDialog.open)offerDialog.showModal();
 } else if(offerDialog.open)offerDialog.close();
 $('promotedUserConfirmation').hidden=s.stage!==10;
 $('promotedUserDate').textContent=prettyDate(s.dates.full);
 if([0,1,5,6].includes(s.stage)){$('reservationActionPanel').hidden=false;$('reservationMenu').setAttribute('aria-expanded','true');}
 $('goAdmin').textContent=s.stage>=6&&s.stage<=8?'管理者画面へ戻って取消を体験する　→':'管理者画面を体験する　→';
 guideRender();
}
initialize();

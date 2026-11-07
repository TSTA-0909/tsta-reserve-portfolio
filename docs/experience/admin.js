import {readState,writeState,prettyDate,calendarHtml,escapeHtml,typeName,countFor,capFor,isFull} from './shared.js';
import {initTour,guideRender,toast} from './tour.js';
import {cancelDemoParticipant,confirmAdminBookingReview,confirmAdminPromotionReview} from './engine.js';
const $=id=>document.getElementById(id);
function change(f){const x=readState();f(x);writeState(x);return x;}
function init(){const s=readState();if(s.stage===2)s.stage=3;if(s.stage===6)s.stage=7;writeState(s);if(s.stage===7&&!s.selectedAdminDate){s.selectedAdminDate=s.dates.full;writeState(s);}if(s.stage===11){s.selectedAdminDate=s.dates.full;writeState(s);}
 $('calendarArea').addEventListener('click',e=>{const btn=e.target.closest('button[data-date]');if(!btn)return;
  const date=btn.dataset.date;
  const before=readState();
  if(before.guide&&((before.stage===4&&!before.adminBookingReviewed&&date!==before.dates.open)||(before.stage===11&&date!==before.dates.full))){
    toast(before.stage===11?'繰り上がり予約の参加者一覧を先に確認しましょう。':'先に予約した日の参加者一覧で名前を確認しましょう。');return;
  }
  change(x=>{x.selectedAdminDate=date;if(x.stage===3&&date===x.dates.open)x.stage=4;});render();});
 $('adminConfirmNext').addEventListener('click',()=>{
  try {change(x=>confirmAdminBookingReview(x));}
  catch(err){toast(err.message);return;}
  render();toast('14日の参加者一覧に、あなたの予約が反映されています！');
 });
 $('adminPromotionConfirmNext').addEventListener('click',()=>{
  try{change(x=>confirmAdminPromotionReview(x));}
  catch(err){toast(err.message);return;}
  render();toast('管理者の参加者一覧でも予約が確認できました！');
 });
 $('discoverFeaturesBtn').addEventListener('click',()=>{
  const s=readState();if(s.stage!==12&&s.stage!==13)return;
  if(s.stage===12)change(x=>x.stage=13);
  render();
 });
 $('goUserWait').addEventListener('click',e=>{
  const s=readState();
  if(s.guide && s.stage===4 && !s.adminBookingReviewed){
    e.preventDefault();toast('先にオレンジ枠の参加者一覧で、予約した名前を確認してください。');
    document.querySelector('#reservationInfo').scrollIntoView({behavior:'smooth',block:'start'});
  }
 });
 const features={
  tournament:{name:'大会管理',summary:'大会の受付から対戦・結果までを一つの流れで扱う仕組みです。',examples:['参加ペアやチームを整理し、試合の進行を管理','対戦順・試合結果を記録して、次の対戦に反映','当日の運営者が必要な情報を確認しやすくする'],insight:'現地で進行状況が変わることを想定し、管理操作と試合情報をつなげて設計。'},
  members:{name:'メンバー管理',summary:'利用者が増えたとき、同姓同名や代理予約でも人物を取り違えないための仕組みです。',examples:['本人・友達紹介・未登録の参加者を区別','複数の登録情報を管理者が確認して紐付け','予約履歴や試合結果を別人に誤って付けない'],insight:'名前だけで人物を自動統合せず、根拠を確認したうえで管理者が判断。'},
  notice:{name:'お知らせ',summary:'練習案内など、参加者に必要な連絡を分かりやすく届ける機能です。',examples:['開催や運営に関するお知らせを掲示','案内内容を予約画面から確認','通知関連の仕組みと連動する運用を想定'],insight:'予約機能を使う流れの中で、連絡も見つけやすい配置を検討。'},
  matches:{name:'試合ボード',summary:'当日の参加者を試合に配置し、結果を次の記録へつなげます。',examples:['参加者をコート・試合に割り当て','対戦や得点を記録して保存','人物IDと照合し、個人の戦績との取り違えを防止'],insight:'オフラインを含む現場での操作や、人違い・重複登録への対策を重視。'},
  profile:{name:'プロフィール',summary:'利用者が自分の情報を管理し、予約の際に繰り返し入力しなくて済むようにします。',examples:['表示名・参加区分などの登録と変更','予約時に本人を識別するための情報を管理','端末が変わったときの引き継ぎを考慮'],insight:'入力を減らしつつ、端末依存で別人扱いされる問題への対策を検討。'},
  stats:{name:'戦績表',summary:'試合結果を後から振り返れるよう、個人の記録を整理する機能です。',examples:['日付ごとに対戦結果を確認','区分や対象者で見たい戦績を探す','誤った人物への記録付けを見直せるようにする'],insight:'記録の原本を守りながら、表示時の人物照合や取消に対応。'},
  chat:{name:'管理者チャット',summary:'運営への問い合わせや確認を、予約画面の流れの中で扱う機能です。',examples:['参加者からの問い合わせを運営へ伝える','過去のやり取りを見返す','予約に関連する連絡を分散させにくくする'],insight:'利用者が別の連絡手段へ移動せずに相談できる導線を意識。'}
 };
 document.querySelectorAll('[data-feature]').forEach(btn=>btn.addEventListener('click',()=>{
  const item=features[btn.dataset.feature];if(!item)return;
  $('featureTitle').textContent='🎾 '+item.name;
  $('featureDescription').textContent=item.summary;
  const list=$('featureExamples');list.replaceChildren();
  item.examples.forEach(example=>{const li=document.createElement('li');li.textContent=example;list.appendChild(li);});
  $('featureInsight').textContent=item.insight;
  $('featureDialog').showModal();guideRender();
 }));
 $('closeFeatureDialog').addEventListener('click',()=>{$('featureDialog').close();guideRender();});
 $('reservationInfo').addEventListener('click',e=>{const btn=e.target.closest('button[data-cancel]');if(!btn)return;const id=btn.dataset.cancel,s=readState(),res=s.reservations.find(x=>x.id===id);if(!res)return;
  if(res.mine){toast('体験ガイドでは自分以外の架空参加者を取り消してください。');return;}
  if(s.guide&&s.stage===11){toast('まず繰り上がり予約を確認してください。');return;}
  if(s.guide&&s.stage===7&&(res.type!=='experienced'||res.date!==s.dates.full)){
   toast('経験者(A)の架空参加者を1人取り消してください。');return;
  }
  try{change(x=>cancelDemoParticipant(x,id));}catch(err){toast(err.message);return;}
  toast('架空参加者を取り消しました。キャンセル待ちの繰り上がりを確認してください。');render();});
 render();initTour('admin',render);
}
function render(){
 // The promotion confirmation may have been moved beside a participant row.
 // Restore it outside the re-created list BEFORE replaceChildren() clears that list.
 const promotionPanel=$('adminPromotionConfirmation');
 if(promotionPanel && promotionPanel.parentElement?.id==='experiencedList')
   $('experiencedList').insertAdjacentElement('afterend',promotionPanel);
 let s=readState();if(s.stage===7&&s.selectedAdminDate!==s.dates.full){s.selectedAdminDate=s.dates.full;writeState(s);}if(s.stage===11&&s.selectedAdminDate!==s.dates.full){s.selectedAdminDate=s.dates.full;writeState(s);}const date=s.selectedAdminDate;
 $('calendarArea').innerHTML=calendarHtml(s,date,{admin:true,type:'experienced'});
 $('selectedDateDisplay').textContent=date?prettyDate(date):'未選択';$('participantsTitle').textContent=date?`🔎 参加者一覧（${prettyDate(date)}）`:'🔎 参加者一覧（未選択）';
 $('participantsLimitInfo').textContent=date?'上限設定：初心者4名／経験者'+capFor(s,date,'experienced')+'名（架空の開催日です）':'日付を選ぶと予約一覧が表示されます';
 $('currentSettingBox').textContent=date?`${prettyDate(date)}の予約人数　初心者：${countFor(s,date,'beginner')}名　経験者：${countFor(s,date,'experienced')}名`:'（日付未選択）';
 for(const type of ['beginner','experienced']){const area=$(type==='beginner'?'beginnerList':'experiencedList');area.replaceChildren();
  const h=document.createElement('h4');h.className='tour-people-head';h.textContent=`${typeName(type)} — ${date?countFor(s,date,type):0}名`;area.appendChild(h);
  if(!date){const p=document.createElement('p');p.className='tour-small';p.textContent='日付を選んでください。';area.appendChild(p);continue;}
  const list=s.reservations.filter(r=>r.date===date&&r.type===type);
  if(!list.length){const p=document.createElement('p');p.className='tour-empty';p.textContent='参加者はいません。';area.appendChild(p);}
  for(const p of list){const row=document.createElement('div');row.className='tour-person-row';if(p.mine&&date===s.dates.open&&type==='beginner')row.id='tourMineReservation';
   if(p.mine&&date===s.dates.full&&type==='experienced')row.id='tourPromotedReservation';
   row.innerHTML=`<div><strong>${escapeHtml(p.name)}</strong><span>${p.mine?'あなたが予約した架空の参加者':'サンプル参加者'}</span></div>`;
   if(!p.mine){const button=document.createElement('button');button.type='button';button.className='cancel-btn';button.dataset.cancel=p.id;button.textContent='参加取消';if(s.stage===7&&date===s.dates.full&&type==='experienced'&&!document.getElementById('cancelSeedBtn'))button.id='cancelSeedBtn';row.appendChild(button);}
   area.appendChild(row);
  }
 }
 // Show an in-list checkpoint BEFORE allowing the waitlist step.
 const reviewVisible=s.stage===4&&!s.adminBookingReviewed&&date===s.dates.open;
 $('adminBookingConfirmation').hidden=!reviewVisible;
 $('adminConfirmedName').textContent=s.profile || 'あなた';
 $('adminConfirmedDate').textContent=prettyDate(s.dates.open);
 $('goUserWait').classList.toggle('tour-hop-disabled',s.guide&&s.stage===4&&!s.adminBookingReviewed);
 $('goUserWait').setAttribute('aria-disabled',String(s.guide&&s.stage===4&&!s.adminBookingReviewed));
 $('goUserExplanation').textContent=reviewVisible?'まず上の参加者一覧に自分の名前があるか確認してください。':'満席の日にキャンセル待ちを登録すると、この一覧に反映されます。';
 // Persistent instruction beside the actual cancellation controls.
 const cancelStep = s.guide && s.stage===7 && date===s.dates.full;
 if($('cancelGuideNote'))$('cancelGuideNote').hidden=!cancelStep;
 const waits=s.waits.filter(w=>w.date===date&&w.type==='experienced');$('wlCountExperienced').textContent=`${waits.length}名`;
 $('wlListExperienced').replaceChildren();if(!waits.length){const p=document.createElement('p');p.className='tour-empty';p.textContent=date?'この日のキャンセル待ちはありません。':'日付を選択すると表示されます。';$('wlListExperienced').appendChild(p);}
 waits.forEach((w,i)=>{
  const div=document.createElement('div');
  div.className='wl-row';
  const isMine=w.mine&&date===s.dates.full;
  const isOffering=isMine&&Boolean(s.offer&&s.offer.date===w.date);
  if(isMine){
    div.id='tourWaitlistStatus';
    div.classList.add('tour-waiting-person');
    if(isOffering)div.classList.add('tour-waiting-offer');
  }
  div.innerHTML=`<span class="wl-rank">${i+1}</span><span class="tour-waiting-name">${escapeHtml(w.name)}（${w.mine?'あなた':'架空'}）${isMine?`<strong class="tour-waiting-badge">${isOffering?'🔔 繰り上がり案内中':'⏳ キャンセル待ち登録中'}</strong>`:''}</span>`;
  $('wlListExperienced').appendChild(div);
 });
 const promotionVisible=s.stage===11&&date===s.dates.full;
 $('adminPromotionConfirmation').hidden=!promotionVisible;
 // Keep the confirmation button immediately beside the promoted participant,
 // rather than requiring the viewer to hunt below a long list.
 if(promotionVisible){
  const row=$('tourPromotedReservation');
  if(row)row.insertAdjacentElement('afterend',$('adminPromotionConfirmation'));
 }
 $('adminPromotedName').textContent=s.profile||'あなた';
 $('adminPromotedDate').textContent=prettyDate(s.dates.full);
 $('tourCompleteBanner').hidden=![12,13].includes(s.stage);
 $('goUserWait').hidden=s.stage>=8;
 $('goUserNotice').hidden=s.stage!==8;
 if(s.stage===7)$('goUserExplanation').textContent='登録済みの架空参加者を取消すると、キャンセル待ちの案内が発生します。';
 if(s.stage===8)$('goUserExplanation').textContent='空き枠ができ、架空の通知が準備できました。';
 guideRender();
}
init();

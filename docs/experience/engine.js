/** Pure interaction rules for the fictional, local-only portfolio experience. */
import {isFull,countFor,capFor} from './shared.js';
export function saveDemoProfile(state,name){
 const safe=String(name??'').trim();if(safe.length<2)throw new Error('架空名を2文字以上で入力してください。');
 state.profile=safe;if(state.stage===0)state.stage=1;
 return state;
}
export function chooseDemoCategory(state, requested){
 const category=String(requested||'');
 if(state.guide && state.stage===1 && category && category!=='beginner'){
  state.category='';state.selectedUserDate='';
  return {accepted:false,message:'最初は「初心者・ブランク有(B)」を選びましょう。'};
 }
 if(state.guide && state.stage===5 && category && category!=='experienced'){
  state.category='';state.selectedUserDate='';
  return {accepted:false,message:'キャンセル待ちの体験は「経験者(A)」を選びましょう。'};
 }
 state.category=category;state.selectedUserDate='';
 return {accepted:true};
}
export function bookDemo(state,{date,type}={}){
 if(!state.profile||!date||!type)throw new Error('プロフィール・区分・日付を選んでください。');
 if(![state.dates.open,state.dates.full].includes(date))throw new Error('開催日を選んでください。');
 if(!['experienced','beginner'].includes(type))throw new Error('区分を選んでください。');
 if(state.reservations.some(x=>x.mine&&x.date===date&&x.type===type)||state.waits.some(x=>x.mine&&x.date===date&&x.type===type))throw new Error('その日にはすでに登録があります。');
 const full=isFull(state,date,type),kind=full?'wait':'book';
 const record={id:`${kind}-demo-${Date.now()}-${state.reservations.length+state.waits.length}`,date,type,name:state.profile,mine:true};
 if(full){state.waits.push(record);if(state.stage===5&&date===state.dates.full)state.stage=6;}
 else{state.reservations.push(record);if(state.stage===1&&date===state.dates.open)state.stage=2;}
 state.selectedUserDate='';
 return {kind,record};
}
/** A deliberate confirmation step between submitting a reservation and viewing it as admin. */
export function confirmDemoBookingReview(state){
 const found=state.reservations.some(x=>x.mine&&x.date===state.dates.open&&x.type==='beginner');
 if(state.stage!==2||!found)throw new Error('最初の予約を確認できませんでした。');
 state.bookingReviewed=true;
 return state;
}
/** Require the user's actual booking to exist on the selected administrator date. */
export function confirmAdminBookingReview(state){
 if (state.stage !== 4 || state.selectedAdminDate !== state.dates.open)
  throw new Error('管理者のカレンダーで最初の予約日を選んでください。');
 if (!state.reservations.some(r=>r.mine && r.name===state.profile && r.date===state.dates.open && r.type==='beginner'))
  throw new Error('参加者一覧に本人の予約が見つかりません。');
 state.adminBookingReviewed=true;
 return state;
}
export function cancelDemoParticipant(state,id){
 const item=state.reservations.find(x=>x.id===id);if(!item)throw new Error('参加者が見つかりません。');
 if(item.mine)throw new Error('体験ガイドでは架空の別参加者を取り消してください。');
 state.reservations=state.reservations.filter(x=>x.id!==id);
 const next=state.waits.find(x=>x.date===item.date&&x.type===item.type);
 const promotable=next&&countFor(state,item.date,item.type)<capFor(state,item.date,item.type);
 if(promotable){state.offer={date:item.date,type:item.type,mine:next.mine};if(state.stage===7&&next.mine)state.stage=8;}
 return {offered:!!promotable,offer:state.offer};
}
export function acceptDemoOffer(state){
 const offer=state.offer;if(!offer)throw new Error('案内中のキャンセル待ちはありません。');
 const i=state.waits.findIndex(w=>w.mine&&w.date===offer.date&&w.type===offer.type);
 if(i<0)throw new Error('キャンセル待ちが見つかりません。');
 if(countFor(state,offer.date,offer.type)>=capFor(state,offer.date,offer.type))throw new Error('空き枠がありません。');
 state.waits.splice(i,1);
 state.reservations.push({id:`offer-demo-${Date.now()}`,date:offer.date,type:offer.type,name:state.profile,mine:true});
 state.offer=null;state.noticeRead=true;if(state.stage===9)state.stage=10;
 return state;
}

/** The final checkpoint must show the promoted booking in the administrator list. */
export function confirmAdminPromotionReview(state) {
 if (state.stage !== 11 || state.selectedAdminDate !== state.dates.full)
   throw new Error('管理者画面でキャンセル待ちの開催日を選んでください。');
 if (!state.reservations.some(r => r.mine && r.name === state.profile &&
      r.date === state.dates.full && r.type === 'experienced'))
   throw new Error('繰り上がった予約が参加者一覧に見つかりません。');
 if (state.waits.some(w => w.mine && w.date === state.dates.full && w.type === 'experienced'))
   throw new Error('キャンセル待ちの状態が更新されていません。');
 state.adminPromotionReviewed = true;
 state.stage = 12;
 return state;
}

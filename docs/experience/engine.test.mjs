import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSeed,readState,writeState,resetState,capFor,countFor,calendarHtml} from './shared.js';
import {saveDemoProfile,bookDemo,cancelDemoParticipant,acceptDemoOffer,chooseDemoCategory,confirmDemoBookingReview,confirmAdminBookingReview} from './engine.js';
const fakeSession=new Map();globalThis.sessionStorage={getItem:k=>fakeSession.get(k)??null,setItem:(k,v)=>fakeSession.set(k,v)};
test('架空プロフィール→予約→管理者の確認',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');assert.equal(s.stage,1);
 const result=bookDemo(s,{date:s.dates.open,type:'experienced'});assert.equal(result.kind,'book');assert.equal(s.stage,2);
 assert.equal(countFor(s,s.dates.open,'experienced'),1);
 assert.equal(s.reservations.find(r=>r.mine).name,'空野 星');
});
test('満席→キャンセル待ち→他人の予約取消→模擬通知→予約確定',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');s.stage=5;
 const added=bookDemo(s,{date:s.dates.full,type:'experienced'});assert.equal(added.kind,'wait');assert.equal(s.stage,6);
 assert.equal(s.waits.length,1);assert.equal(countFor(s,s.dates.full,'experienced'),capFor(s,s.dates.full,'experienced'));
 s.stage=7;const canceled=cancelDemoParticipant(s,'seed1');assert.equal(canceled.offered,true);assert.equal(s.stage,8);
 s.stage=9;acceptDemoOffer(s);assert.equal(s.stage,10);assert.equal(s.waits.length,0);assert.equal(s.offer,null);
 assert.equal(s.reservations.filter(r=>r.mine&&r.date===s.dates.full).length,1);
});
test('架空データの二重予約と本人取消を防止',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');const {record}=bookDemo(s,{date:s.dates.open,type:'experienced'});
 assert.throws(()=>bookDemo(s,{date:s.dates.open,type:'experienced'}));assert.throws(()=>cancelDemoParticipant(s,record.id));
});
test('ページ移動に使うセッションデータを保存・再読込',()=>{
 const s=makeSeed();s.profile='空野 星';s.stage=4;writeState(s);
 assert.equal(readState().profile,'空野 星');assert.equal(readState().stage,4);
});
test('最初の予約は初心者の14日へ誘導し、区分切り替えでも予約が押せなくならない',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');
 let r=chooseDemoCategory(s,'experienced');assert.equal(r.accepted,false);assert.equal(s.category,'');
 r=chooseDemoCategory(s,'beginner');assert.equal(r.accepted,true);assert.equal(s.category,'beginner');
 assert.equal(countFor(s,s.dates.full,'beginner'),4);
 assert.equal(capFor(s,s.dates.full,'beginner'),4);
 assert.match(calendarHtml(s,'',{type:'beginner'}),new RegExp(`data-date="${s.dates.full}"[^>]*`));
 s.selectedUserDate=s.dates.open;
 assert.equal(s.selectedUserDate,s.dates.open);
 const b=bookDemo(s,{date:s.dates.open,type:s.category});assert.equal(b.kind,'book');assert.equal(s.stage,2);
});
test('キャンセル待ち区分を初心者に切り替えても誤案内しない',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');s.stage=5;
 let r=chooseDemoCategory(s,'beginner');assert.equal(r.accepted,false);assert.equal(s.category,'');
 r=chooseDemoCategory(s,'experienced');assert.equal(r.accepted,true);
 s.selectedUserDate=s.dates.full;const b=bookDemo(s,{date:s.selectedUserDate,type:s.category});
 assert.equal(b.kind,'wait');assert.equal(s.stage,6);
});
test('2か月分のカレンダーに開催可能日と満席日がある',()=>{
 const s=makeSeed(),html=calendarHtml(s,'',{type:'experienced'});
 assert.match(html,/tour-full/);assert.match(html,/tour-open/);assert.match(html,/tour-disabled/);
});

test('カレンダーの日付は選択前と選択後で見た目とariaが明確に異なる',()=>{
 const s=makeSeed();const before=calendarHtml(s,'',{type:'beginner'});
 const after=calendarHtml(s,s.dates.open,{type:'beginner'});
 const re=new RegExp(`class="[^"]*tour-selected[^"]*" data-date="${s.dates.open}"`);
 assert.doesNotMatch(before,re);
 assert.match(after,re);
 assert.match(after,/選択済み/);
});

test('予約直後は14日の予約を確認するまで管理者へ進まない',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');
 assert.equal(s.bookingReviewed,false);
 assert.throws(()=>confirmDemoBookingReview(s),/最初の予約/);
 bookDemo(s,{date:s.dates.open,type:'beginner'});
 assert.equal(s.stage,2);
 assert.equal(s.bookingReviewed,false);
 assert.equal(s.reservations.filter(x=>x.mine&&x.date===s.dates.open&&x.type==='beginner').length,1);
 confirmDemoBookingReview(s);assert.equal(s.bookingReviewed,true);
 assert.equal(s.stage,2);
});


test('管理者で14日の参加者一覧を確認するまでキャンセル待ちへ進まない',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');
 bookDemo(s,{date:s.dates.open,type:'beginner'});
 confirmDemoBookingReview(s);
 s.stage=3;
 s.selectedAdminDate=s.dates.open;s.stage=4;
 assert.equal(s.adminBookingReviewed,false);
 assert.ok(s.reservations.find(x=>x.mine&&x.name==='空野 星'&&x.date===s.selectedAdminDate));
 confirmAdminBookingReview(s);
 assert.equal(s.adminBookingReviewed,true);
});
test('誤った日付・予約がない状態では管理者の確認を完了できない',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');
 s.stage=4;s.selectedAdminDate=s.dates.full;
 assert.throws(()=>confirmAdminBookingReview(s),/カレンダー/);
 s.selectedAdminDate=s.dates.open;
 assert.throws(()=>confirmAdminBookingReview(s),/参加者一覧/);
});


test('「最初から」で架空予約・キャンセル待ち・通知・案内を完全初期化する',()=>{
 const s=makeSeed();saveDemoProfile(s,'空野 星');bookDemo(s,{date:s.dates.open,type:'beginner'});
 s.stage=7;s.adminBookingReviewed=true;s.bookingReviewed=true;s.selectedAdminDate=s.dates.full;
 s.waits=[{name:'架空',mine:true,date:s.dates.full,type:'experienced'}];
 s.offer={date:s.dates.full,type:'experienced',mine:true};s.guide=false;
 writeState(s);
 const fresh=resetState();
 assert.equal(fresh.stage,0);assert.equal(fresh.profile,'');assert.equal(fresh.guide,true);
 assert.equal(fresh.bookingReviewed,false);assert.equal(fresh.adminBookingReviewed,false);
 assert.equal(fresh.waits.length,0);assert.equal(fresh.offer,null);
 assert.equal(fresh.selectedAdminDate,'');assert.equal(fresh.selectedUserDate,'');
 assert.equal(fresh.reservations.some(x=>x.mine),false);
 assert.deepEqual(readState(),fresh);
});

test('管理者画面のガイド・確認・リセットに必要なHTML要素が存在する',()=>{
 const html=readFileSync(new URL('./admin.html',import.meta.url),'utf8');
 for(const id of ['cancelGuideNote','reservationInfo','tourMineReservation','adminBookingConfirmation','adminConfirmNext','resetTour','tourBubble','tourStep','featureDialog','featureExamples','featureInsight']){
   if(id==='tourMineReservation')continue; // inserted at runtime
   assert.match(html,new RegExp(`\\bid="${id}"`),`Missing #${id}`);
 }
 assert.doesNotMatch(html,/id="cancelGuideNote class=/);
});

// v0.8: don't call the tour complete until the promoted booking is shown on the admin side.
test('繰り上がり確定のあと管理者で予約反映を検証するまで完了にしない', async()=>{
 const {confirmAdminPromotionReview}=await import('./engine.js');
 const s=makeSeed();saveDemoProfile(s,'空野 星');s.stage=5;
 bookDemo(s,{date:s.dates.full,type:'experienced'});
 s.stage=7;cancelDemoParticipant(s,'seed1');
 s.stage=9;acceptDemoOffer(s);
 assert.equal(s.stage,10);
 assert.equal(s.adminPromotionReviewed,false);
 assert.equal(s.reservations.filter(x=>x.mine&&x.date===s.dates.full&&x.type==='experienced').length,1);
 assert.equal(s.waits.filter(x=>x.mine).length,0);
 assert.throws(()=>confirmAdminPromotionReview(s),/管理者画面/);
 s.stage=11;
 assert.throws(()=>confirmAdminPromotionReview(s),/管理者画面/);
 s.selectedAdminDate=s.dates.full;
 confirmAdminPromotionReview(s);
 assert.equal(s.stage,12);
 assert.equal(s.adminPromotionReviewed,true);
});

test('繰り上がり未反映は管理者確認を通らない', async()=>{
 const {confirmAdminPromotionReview}=await import('./engine.js');
 const s=makeSeed();saveDemoProfile(s,'空野 星');
 s.stage=11;s.selectedAdminDate=s.dates.full;
 assert.throws(()=>confirmAdminPromotionReview(s),/参加者一覧/);
});

test('Ver 0.8の選択補助・管理者確認・追加機能の導線がHTMLにある',()=>{
 const user=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const admin=readFileSync(new URL('./admin.html',import.meta.url),'utf8');
 for(const id of ['experiencePick','pickExperienced','promotedUserConfirmation','goAdminPromotion'])
  assert.match(user,new RegExp(`id="${id}"`));
 for(const id of ['adminPromotionConfirmation','adminPromotionConfirmNext','tourCompleteBanner','discoverFeaturesBtn','otherFeaturesPanel'])
  assert.match(admin,new RegExp(`id="${id}"`));
});


test('Ver.0.10 はキャンセル待ち状態を強調し、ガイド位置を右上に統一',()=>{
 const admin=readFileSync(new URL('./admin.js',import.meta.url),'utf8');
 const tour=readFileSync(new URL('./tour.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('./assets/tour.css',import.meta.url),'utf8');
 assert.match(admin,/id='tourWaitlistStatus'/);
 assert.match(admin,/キャンセル待ち登録中/);
 assert.match(admin,/繰り上がり案内中/);
 assert.match(tour,/selector:'#tourWaitlistStatus',extraSelector:'#goUserNotice'/);
 assert.match(tour,/bubble\.style\.top='92px'/);
 assert.doesNotMatch(tour,/bubble\.style\.bottom='clamp\(/);
 assert.match(css,/#tourWaitlistStatus\.tour-waiting-person/);
 assert.match(css,/\.tour-bubble:not\(\[hidden\]\)\{top:92px!important/);
});

/** Guided portfolio tour. A visible instruction is the default, never a silent fallback. */
import {readState, writeState, resetState, prettyDate} from './shared.js';
let page = '';
let rerender = null;
let pending = 0;
let lastFocusKey = '';
const $ = id => document.getElementById(id);

function targetFor(s) {
  const openDate = s.dates.open;
  const fullDate = s.dates.full;
  if (page === 'user') {
    if (s.stage === 0) return {
      selector:'#editProfileInline', title:'まずは「予約する」欄から始めよう！',
      text:'ここが実際の予約画面です。オレンジ色の「プロフィールを登録・変更」を押して、架空の名前を保存しましょう。'
    };
    if (s.stage === 1) {
      if (s.category !== 'beginner') return {
        selector:'#pickBeginner', title:'① 初心者・ブランク有(B)を選ぼう',
        text:'最初の予約は「初心者・ブランク有(B)」を選んでください。表示されたオレンジ枠の区分を押すと選択できます。経験者(A)はキャンセル待ちの体験で使います。'
      };
      if (s.selectedUserDate !== openDate) return {
        selector:`#calendarArea button[data-date="${openDate}"]`,
        title:`② 緑色の${prettyDate(openDate)}をクリック！`,
        text:`オレンジ枠は「押してほしい場所」の印で、まだ選択されていません。緑色の${prettyDate(openDate)}を直接押すか、下のボタンで選択してください。灰色の${prettyDate(fullDate)}は満席です。`,
        actionLabel:`${prettyDate(openDate)}を選択する`
      };
      return {
        selector:'#reserveBtn', title:'③「予約する」を押そう',
        text:`${prettyDate(openDate)}が選択されました。下の「予約する」を押すと、管理者側にもあなたの名前が反映されます。`
      };
    }
    if (s.stage === 2 && !s.bookingReviewed) return {
      selector:'#bookingConfirmation',
      title:`④ ${prettyDate(openDate)}の予約完了を確かめよう！`,
      text:`ページ上部の「あなたの予約一覧」に${prettyDate(openDate)}・初心者(B)の予約が反映されています。名前と日付を見てから、オレンジ枠内の「確認できた！」を押してください。`
    };
    if (s.stage === 2) return {selector:'#goAdmin',title:'⑤ 次は管理者画面へ！',text:'予約が一覧に反映されたことを確認しました。今度は下の「管理者画面を体験する」を押して、管理者側から確認しましょう。'};
    if (s.stage === 5) {
      if (s.category !== 'experienced') return {
        selector:'#pickExperienced',title:'⑨ オレンジ枠の経験者(A)を選ぼう',
        text:'表示された「経験者(A)」を押してください。上のプルダウンからも選べます。'
      };
      if (s.selectedUserDate !== fullDate) return {
        selector:`#calendarArea button[data-date="${fullDate}"]`,title:`⑩ 灰色の${prettyDate(fullDate)}をクリック！`,
        text:`オレンジ枠はまだ選択済みではありません。濃い灰色の${prettyDate(fullDate)}を直接押すか、下のボタンで選択してください。薄い灰色は開催日ではありません。`,
        actionLabel:`${prettyDate(fullDate)}を選択する`
      };
      return {selector:'#reserveBtn',title:'⑪ キャンセル待ちに登録',text:'「キャンセル待ちに登録」を押しましょう。これは本番には送信されない架空の登録です。'};
    }
    if (s.stage === 6) return {selector:'#goAdmin',title:'⑫ 管理者側へ戻ろう',text:'キャンセル待ちの登録ができました。「管理者画面へ戻って取消を体験する」を押しましょう。'};
    if (s.stage === 9) return {selector:'#offerAccept',title:'⑮ 繰り上がり通知を確認！',text:'通知が届きました。「参加予約を確定する」を押しましょう。'};
    if (s.stage === 10) return {
      selector:'#promotedUserConfirmation',title:'⑯ 繰り上がり予約を確認！',
      text:`${prettyDate(fullDate)}・経験者(A)の予約が「あなたの予約一覧」に追加されました。確認したら「管理者の参加者一覧で確認する」を押してください。`
    };
  }
  if (page === 'admin') {
    if (s.stage === 3) return {
      selector:`#calendarArea button[data-date="${openDate}"]`,title:`⑥ 予約した${prettyDate(openDate)}を押そう`,
      text:`管理者のカレンダーで${prettyDate(openDate)}を選んでください。右側の「参加者一覧」に、先ほど予約した名前が表示されます。`
    };
    if (s.stage === 4 && !s.adminBookingReviewed) return {
      selector:'#reservationInfo', extraSelector:'#tourMineReservation',
      title:`⑦ 管理者の「参加者一覧」を確認しよう！`,
      text:`右側のオレンジ枠に、${prettyDate(openDate)}の「${s.profile}」が表示されています。名前を見つけたら、一覧のオレンジ色の「確認した！ 次へ進む」を押してください。`
    };
    if (s.stage === 4) return {
      selector:'#goUserWait',title:'⑧ 次はキャンセル待ちへ！',
      text:'管理者の参加者一覧でも予約を確認できました。下の「予約側でキャンセル待ちをする」を押してください。'
    };
    if (s.stage === 7) return {
      selector:$('#cancelSeedBtn')?'#cancelSeedBtn':'#cancelGuideNote',
      title:'⑬ 自分以外の参加者を1人取り消そう！',
      text:'右側の経験者(A)一覧にある、架空の参加者の赤い「参加取消」ボタンを1回押してください。これで満席に空きができます。'
    };
    if (s.stage === 8) return {
      selector:'#tourWaitlistStatus',extraSelector:'#goUserNotice',
      title:'⑭ キャンセル待ちが「繰り上がり案内中」に変わった！',
      text:`右側のキャンセル待ち欄で「${s.profile}（あなた）」が「🔔 繰り上がり案内中」になりました。確認したら、下のオレンジ枠の「予約側へ戻って通知を確認」を押してください。`
    };
    if (s.stage === 11) return {
      selector:'#reservationInfo',extraSelector:'#tourPromotedReservation',
      title:'⑰ 管理者の「参加者一覧」に反映されているか確認！',
      text:`右側の経験者(A)一覧で「${s.profile}」を見つけてください。確認できたら、一覧のオレンジ色のボタンを押して体験を完了しましょう。`
    };
    if (s.stage === 12) return {
      selector:'#tourCompleteBanner',title:'🎉 予約から繰り上がりまで体験完了！',
      text:'管理者の参加者一覧でも予約を確認できました。次は「ほかの機能も見てみる」を押してみましょう。'
    };
    if (s.stage === 13) return {
      selector:'#otherFeaturesPanel',title:'🎾 ほかにもこんな機能があります！',
      text:'大会管理・メンバー管理・試合ボード・戦績表など、気になるボタンを自由に押してください。どれも本番データには接続しません。'
    };
  }
  return {selector:page==='user'?'#reservationActionPanel':'#reservationInfo',title:'体験ガイド',text:'オレンジ色で強調された場所から、次の操作を試してください。'};
}
function clearTarget(){document.querySelectorAll('.tour-highlight').forEach(x=>x.classList.remove('tour-highlight'));}
function showGuide(){
  const bubble=$('tourBubble'); if(!bubble)return;
  const s=readState();
  const modal=page==='user'&&($('offerModal')?.open||$('profileDialog')?.open) || page==='admin'&&$('featureDialog')?.open;
  if(!s.guide||modal){
    bubble.hidden=true;
    bubble.style.removeProperty('display');
    bubble.style.removeProperty('top');bubble.style.removeProperty('left');bubble.style.removeProperty('width');
    bubble.style.removeProperty('bottom');bubble.style.removeProperty('right');
    clearTarget();
    return;
  }
  const hint=targetFor(s);
  let target=document.querySelector(hint.selector);
  // Missing target must never silently erase the instruction.
  if(!target) target=page==='admin'?$('reservationInfo'):$('reservationActionPanel');
  bubble.hidden=false;
  bubble.querySelector('.tour-bubble-title').textContent=hint.title;
  bubble.querySelector('.tour-bubble-text').textContent=hint.text;
  const action=$('tourAction');
  if(action){action.hidden=!hint.actionLabel;action.textContent=hint.actionLabel||'';}
  clearTarget();target?.classList.add('tour-highlight');if(hint.extraSelector)document.querySelector(hint.extraSelector)?.classList.add('tour-highlight');
  // Re-apply a brief glow when the actual instruction changes (not on every render).
  const attentionKey=`${page}|${s.stage}|${hint.selector}|${s.adminBookingReviewed}`;
  if(bubble.dataset.attentionKey!==attentionKey){
    bubble.dataset.attentionKey=attentionKey;
    bubble.classList.remove('tour-guide-attention');
    void bubble.offsetWidth;
    bubble.classList.add('tour-guide-attention');
  }
  // Anchor to the visible browser viewport instead of using an offscreen target position.
  // The orange outline and automatic scroll connect the tip to the actual control.
  bubble.style.removeProperty('top');bubble.style.removeProperty('left');bubble.style.removeProperty('width');
  bubble.style.removeProperty('bottom');bubble.style.removeProperty('right');
  const w=window.innerWidth;
  bubble.style.setProperty('display','block','important');
  // Consistent right-top instruction position across every page and every step.
  // The target itself scrolls into view and is highlighted separately.
  bubble.style.position='fixed';
  bubble.style.right=w<=760?'12px':'18px';
  bubble.style.left='auto';
  bubble.style.top='92px';
  bubble.style.bottom='auto';
  bubble.style.width=w<=760?'min(310px, calc(100vw - 24px))':'min(330px, calc(100vw - 36px))';
}
// Step 17: the name and the actual confirmation button must be visible together.
// Scrolling the entire participant panel to its top obscured the button below the fold.
function focusPromotionReview(){
  const row=$('tourPromotedReservation');
  const button=$('adminPromotionConfirmNext');
  const heading=$('experiencedList')?.querySelector('.tour-people-head');
  if(!row||!button||!heading||!button.offsetParent)return false;
  const bubble=$('tourBubble');
  const topBar=$('tourProgress')?.closest('.tour-top');
  const adminBar=document.querySelector('.admin-topbar');
  const headerBottom=Math.max(topBar?.getBoundingClientRect().bottom||0,adminBar?.getBoundingClientRect().bottom||0);
  // Place the experienced group below the always-visible guide on wide screens.
  const guideBottom=bubble&&!bubble.hidden
    ? bubble.getBoundingClientRect().bottom+14 : 0;
  const viewTop=Math.max(headerBottom+16,guideBottom,window.innerWidth<=760?95:190);
  const viewBottom=window.innerHeight-30;
  const headRect=heading.getBoundingClientRect();
  const rowRect=row.getBoundingClientRect();
  const buttonRect=button.getBoundingClientRect();
  const usefulHeight=buttonRect.bottom-headRect.top;
  const usableHeight=viewBottom-viewTop;
  // When the full group is taller than the viewport, prioritize the selected
  // participant and confirmation button rather than a title above the fold.
  const startRect=usefulHeight<=usableHeight?headRect:rowRect;
  const preferredTop=viewTop+Math.max(0,(usableHeight-(buttonRect.bottom-startRect.top))/3);
  const scrollDelta=Math.max(startRect.top-preferredTop,buttonRect.bottom-viewBottom);
  if(Math.abs(scrollDelta)>3)window.scrollBy({top:scrollDelta,behavior:'smooth'});
  return true;
}
function focusGuideTarget(){
  const s=readState();if(!s.guide)return;
  if(page==='user'&&($('offerModal')?.open||$('profileDialog')?.open) || page==='admin'&&$('featureDialog')?.open)return;
  const hint=targetFor(s),target=document.querySelector(hint.selector);
  if(!target)return;
  const key=`${page}|${s.stage}|${hint.selector}`;
  if(key===lastFocusKey)return;
  lastFocusKey=key;
  if(page==='admin'&&s.stage===11&&focusPromotionReview())return;
  const mobile=window.innerWidth<=760;
  target.style.scrollMarginTop='110px';
  target.style.scrollMarginBottom=mobile?'220px':'60px';
  target.scrollIntoView({behavior:'smooth',block:mobile||page==='admin'&&[4,11,12,13].includes(s.stage)?'start':'center',inline:'nearest'});
}
export function guideRender(){
  const s=readState();if(!$('tourBubble'))return;
  $('guideToggle').checked=s.guide;
  // Reservation confirmation adds one step between the submit and the admin hop.
  const progress=()=>{
    if(s.stage===0)return 1;
    if(s.stage===1)return s.category!=='beginner'?2:s.selectedUserDate!==s.dates.open?3:4;
    if(s.stage===2)return s.bookingReviewed?6:5;
    if(s.stage===3)return 7;
    if(s.stage===4)return s.adminBookingReviewed?9:8;
    if(s.stage===5)return s.category!=='experienced'?10:s.selectedUserDate!==s.dates.full?11:12;
    if(s.stage===6)return 13;
    if(s.stage===7)return 14;
    if(s.stage===8)return 15;
    if(s.stage===9)return 16;
    if(s.stage===10)return 17;
    if(s.stage===11)return 18;
    if(s.stage===12)return 19;
    return 20;
  };
  const step=progress();
  $('tourStep').textContent=`${step} / 20`;
  $('tourProgress').style.width=`${Math.round(step/20*100)}%`;
  // Defer after render to allow re-created calendar buttons to exist.
  showGuide();
  clearTimeout(pending);
  if(s.guide)pending=setTimeout(()=>{focusGuideTarget();showGuide();},80);
}
export function initTour(pageName,render){
  page=pageName;rerender=render;lastFocusKey='';
  // The orange outline highlights a target; it does NOT select the date.
  // The optional one-click action always delegates to the real date button's handler.
  $('tourAction')?.addEventListener('click',()=>{
    const hint=targetFor(readState());
    if(!hint.actionLabel)return;
    const target=document.querySelector(hint.selector);
    if(target instanceof HTMLButtonElement && !target.disabled) target.click();
  });
  $('guideToggle').addEventListener('change',e=>{
    const s=readState();s.guide=e.target.checked;writeState(s);lastFocusKey='';
    if(page==='admin')rerender?.();else guideRender();
  });
  $('resetTour').addEventListener('click',()=>{
    if(!window.confirm('架空の予約・キャンセル待ち・進行状況をすべてリセットして、最初からやり直しますか？'))return;
    // Reset explicitly rather than relying on a key name and a possibly same-URL navigation.
    resetState();
    const freshStart=new URL('index.html',import.meta.url);
    freshStart.searchParams.set('restart',String(Date.now()));
    window.location.replace(freshStart.href);
  });
  $('tourClose').addEventListener('click',()=>{
    const s=readState();
    s.guide=false;
    writeState(s);
    if(page==='admin')rerender?.();else guideRender();
  });
  window.addEventListener('resize',()=>{lastFocusKey='';guideRender();});
  guideRender();
}
export function advanceStep(expected,newStage){const s=readState();if(s.stage===expected){s.stage=newStage;writeState(s);}return s;}
export function toast(msg){const x=$('tourToast');if(!x)return;x.textContent=msg;x.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>x.classList.remove('show'),4100);}

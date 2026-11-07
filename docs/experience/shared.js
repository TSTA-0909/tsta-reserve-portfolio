/** TSTA Reserve experience / fictional, browser-only state. No Firebase, auth, push or network writes. */
const KEY = 'tsta_reserve_portfolio_tour_v8';
export const prettyDate = value => { const [y,m,d] = value.split('-'); return `${Number(m)}月${Number(d)}日`; };
const dstr = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function nextSaturday(offsetWeeks=0) {
 // All sessions belong to the Japanese tennis club; dates must not drift with the viewer's time zone.
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date());
 const n = type => Number(parts.find(x=>x.type===type)?.value);
 const d = new Date(n('year'),n('month')-1,n('day'),12,0,0);
 d.setDate(d.getDate()+((6-d.getDay()+7)%7 || 7)+7*offsetWeeks);
 return dstr(d);
}
export const demoDates = () => ({open:nextSaturday(),full:nextSaturday(1)});
export const typeName = t => t === 'beginner' ? '初心者・ブランク有(B)' : '経験者(A)';
export const makeSeed = () => {
 const dates=demoDates();
 return {version:8,stage:0,bookingReviewed:false,adminBookingReviewed:false,adminPromotionReviewed:false,guide:true,profile:'',category:'',selectedUserDate:'',selectedAdminDate:'',
   dates, reservations:[
    {id:'seed1',name:'緑川 さくら（架空）',date:dates.full,type:'experienced',mine:false},
    {id:'seed2',name:'朝倉 みなと（架空）',date:dates.full,type:'experienced',mine:false},
    {id:'seedB1',name:'若葉 かえで（架空）',date:dates.full,type:'beginner',mine:false},
    {id:'seedB2',name:'桜庭 るい（架空）',date:dates.full,type:'beginner',mine:false},
    {id:'seedB3',name:'水瀬 まひろ（架空）',date:dates.full,type:'beginner',mine:false},
    {id:'seedB4',name:'朝比奈 つむぎ（架空）',date:dates.full,type:'beginner',mine:false}
   ], waits:[],offer:null,noticeRead:false};
};
export function readState(){try{const v=JSON.parse(sessionStorage.getItem(KEY));if(v?.version===8&&v.dates?.open&&v.dates?.full)return v;}catch{}const v=makeSeed();writeState(v);return v;}
export function writeState(v){sessionStorage.setItem(KEY,JSON.stringify(v));return v;}
export function resetState(){const x=makeSeed();writeState(x);return x;}
export function countFor(s,date,type){return s.reservations.filter(x=>x.date===date&&x.type===type).length;}
export function capFor(s,date,type){if(date===s.dates.full&&type==='experienced')return 2;return 4;}
export const isFull=(s,date,type)=>countFor(s,date,type)>=capFor(s,date,type);
export function calendarHtml(s,selected,{admin=false,type='experienced'}={}){
 const one=s.dates.open,two=s.dates.full;
 const selectedDates=[one,two].map(t=>new Date(`${t}T12:00:00`));
 const first=selectedDates[0];let html='';
 for(let offset=0;offset<2;offset++){
  const firstOf=new Date(first.getFullYear(),first.getMonth()+offset,1);
  const last=new Date(firstOf.getFullYear(),firstOf.getMonth()+1,0).getDate();
  html+=`<div class="tour-calendar-month"><h4>${firstOf.getFullYear()}年${firstOf.getMonth()+1}月</h4><div class="tour-cal-grid tour-cal-weekdays">${['日','月','火','水','木','金','土'].map(x=>`<span>${x}</span>`).join('')}</div><div class="tour-cal-grid">`;
  for(let empty=0;empty<firstOf.getDay();empty++)html+='<span></span>';
  for(let day=1;day<=last;day++){
   const dt=dstr(new Date(firstOf.getFullYear(),firstOf.getMonth(),day));
   const active=dt===one||dt===two;
   const full=isFull(s,dt,type);let className=active?(full?'tour-full':'tour-open'):'tour-disabled';
   if(selected===dt)className+=' tour-selected';
   const aria=(dt===two?'満席の日付':dt===one?'予約可能日':'開催なし')+(selected===dt?'（選択済み）':'');
   html+=`<button type="button" class="tour-day ${className}" data-date="${dt}" ${active?'':'disabled'} aria-label="${prettyDate(dt)} ${aria}" title="${prettyDate(dt)} ${aria}" ${selected===dt?'aria-pressed="true"':''}>${day}</button>`;
  }
  html+='</div></div>';
 }
 return html;
}
export function todaySessions(s){return [s.dates.open,s.dates.full];}
export function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function stageToPage(stage){return [0,1,2,5,6,8,9,10].includes(stage)?'user':'admin';}

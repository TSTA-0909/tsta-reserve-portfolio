// Regression test for the step-17 visual focus: the attendee and confirmation
// button must remain in the same viewport even when the admin roster is long.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('./tour.js',import.meta.url),'utf8');
const start=src.indexOf('function focusPromotionReview(){');
const end=src.indexOf('\nfunction focusGuideTarget(){',start);
assert.ok(start>=0&&end>start,'Step-17 custom scroller must exist');
const source=src.slice(start,end);
function check({width,height,headTop,rowTop,buttonBottom,bubbleBottom}){
  const args={};
  function el(top,bottom){return {offsetParent:{},getBoundingClientRect:()=>({top,bottom})};}
  const nodes={
    tourPromotedReservation:el(rowTop,rowTop+60),
    adminPromotionConfirmNext:el(buttonBottom-47,buttonBottom),
    experiencedList:{querySelector:()=>el(headTop,headTop+38)},
    tourBubble:{hidden:false,getBoundingClientRect:()=>({bottom:bubbleBottom})},
    tourProgress:{closest:()=>({getBoundingClientRect:()=>({bottom:66})})},
  };
  let delta;
  const context={
    $:id=>nodes[id],
    document:{querySelector:sel=>sel==='.admin-topbar'?el(66,width<=760?123:217):null},
    window:{innerWidth:width,innerHeight:height,scrollBy:opts=>{delta=opts.top}},
  };
  const found=vm.runInNewContext(`${source}\nfocusPromotionReview()`,context);
  assert.equal(found,true);
  assert.equal(typeof delta,'number');
  const nameAfter=rowTop-delta;
  const buttonAfter=buttonBottom-delta;
  assert.ok(nameAfter>=(width<=760?bubbleBottom:Math.max(217,bubbleBottom))-5,
    `person name visible below guide: ${nameAfter}`);
  assert.ok(buttonAfter<=height-25,`confirmation button visible: ${buttonAfter} <= ${height-25}`);
  return {delta,nameAfter,buttonAfter};
}
test('⑰ PC 960px: attendee + confirmation button fit on screen',()=>{
  check({width:1280,height:960,headTop:735,rowTop:845,buttonBottom:1125,bubbleBottom:369});
});
test('⑰ smaller desktop 768px: attendee + confirmation button fit',()=>{
  check({width:1280,height:768,headTop:660,rowTop:765,buttonBottom:1075,bubbleBottom:369});
});
test('⑰ mobile 844px: attendee + confirmation button fit below fixed guide',()=>{
  check({width:390,height:844,headTop:710,rowTop:795,buttonBottom:1045,bubbleBottom:300});
});

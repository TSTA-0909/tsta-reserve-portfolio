import assert from 'node:assert/strict';
import { projectMatchResultsForAdminStats } from '../src/domain/matchStatsPersonIdentityProjection.js';
import { reviewMatchesPlayer } from '../src/domain/matchIdentityReviewPolicy.js';
const people={
 t:{lastName:'白波',firstName:'海斗',primaryUid:'t-uid',status:'active'},
 h:{lastName:'森川',firstName:'陽菜',primaryUid:'h-uid',status:'active'},
 tak:{lastName:'空野',firstName:'昴',primaryUid:'tak-uid',status:'active'},
 kei:{lastName:'空野',firstName:'星',primaryUid:'kei-uid',status:'active'}
};
const mk=(id,name,globalStableId,uid)=>({id,date:'2026-11-02',category:'experienced',pair1:[{name,globalStableId,uid}],pair2:[],winner:'pair1',score:{pair1:3,pair2:0}});
const run=records=>projectMatchResultsForAdminStats(records,{
 loadPerson:async id=>people[id]||null,loadAccountLink:async()=>null});
const base=mk('tanaka','白波たつゆき','t','t-uid');
const before=await run([base]);
assert.equal(before.results[0].pair1[0].statsIdentityHeld,true);
const reviewed=(record,decision,target,canonicalName)=>{
 const p=record.pair1[0];return {...p,statsIdentityReview:{
 version:1,decision,matchId:record.id,side:'pair1',index:0,
 originalName:p.name,originalPersonId:p.globalStableId,originalUid:p.uid,
 targetPersonId:target,targetCanonicalName:canonicalName,reason:'管理者が本人確認',reviewedBy:'admin',reviewedAt:'2026-11-05T00:00:00Z'}};
};
base.pair1[0]=reviewed(base,'same_person_alias','t','白波海斗');
const after=await run([base]);
assert.equal(after.results[0].pair1[0].uid,'person:t');
assert.equal(after.results[0].pair1[0].statsCanonicalName,'白波海斗');
// Person情報・原本名が変わった場合には承認を流用しない。
assert.equal(reviewMatchesPlayer(base.pair1[0].statsIdentityReview,{...base.pair1[0],name:'白波別人'},
 {matchId:'tanaka',side:'pair1',index:0,canonicalId:'t',canonicalName:'白波海斗'}),false);
const mismatchedUid=mk('bad-uid','白波たつゆき','t','kei-uid');
mismatchedUid.pair1[0]=reviewed(mismatchedUid,'same_person_alias','t','白波海斗');
const held=await run([mismatchedUid]);
assert.equal(held.results[0].pair1[0].uid,'','同一人物表記承認だけでは別PersonのUIDを無視できない');
const wrong=mk('bad-record','空野星','tak','tak-uid');
const wrongBefore=await run([wrong]);
assert.equal(wrongBefore.results[0].pair1[0].uid,'');
wrong.pair1[0]=reviewed(wrong,'reassign_person','kei','空野星');
const corrected=await run([wrong]);
assert.equal(corrected.results[0].pair1[0].uid,'person:kei');
const spoof=mk('spoof','空野星','tak','tak-uid');
spoof.pair1[0]=structuredClone(wrong.pair1[0]);
assert.equal((await run([spoof])).results[0].pair1[0].uid,'','別の試合へ承認をコピーしても無効');
console.log('PASS match identity review (alias, separate person, stale/tampered approval, UID safety)');

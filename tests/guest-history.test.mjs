import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const code=readFileSync(new URL('../src/domain/reservationHistoryTriggers.js',import.meta.url),'utf8');
const body=code.slice(code.indexOf('export function createReservationHistoryTriggers')).replace('export function createReservationHistoryTriggers','function createReservationHistoryTriggers');
let resolvedUidCount=0; let writes=0;
const sandbox={
  onDocumentWritten:(_options,handler)=>handler,
  logger:{info:()=>{},error:()=>{}},
  isHistoryTargetReservation:()=>true,
  buildReservationHistoryEvent:()=>({eventId:'history',document:{eventType:'reservation_reserved'}}),
  didReservationBecomeCancelled:()=>false,
  pickReservationEventOccurredAt:()=>new Date().toISOString(),
  console
};
runInNewContext(body+'\nglobalThis.make=createReservationHistoryTriggers;',sandbox);
const db={collection(){return {doc(id){return {id}}}},async runTransaction(fn){
  return fn({async get(){return {exists:false}},create(){writes++}});
}};
const identityResolver={
  async resolveUid(){resolvedUidCount++;return {canonicalPersonId:'person_booker'}},
  async resolvePersonId(id){return {canonicalPersonId:id}}
};
const {recordReservationHistory}=sandbox.make({db,FieldValue:{serverTimestamp:()=>new Date()},region:'asia-northeast1',identityResolver});
const event=reservation=>({params:{reservationId:'test-1'},data:{before:{exists:false},after:{exists:true,data:()=>reservation}},time:new Date().toISOString()});
await recordReservationHistory(event({uid:'uid_booker',name:'空野 星',isFriend:true,participantKind:'friend',guestId:'guest_19a12640-12ad-4b19-9c02-369a28e76349',globalStableId:'person_incorrect_old'}));
assert.equal(resolvedUidCount,0,'friend must never resolve introducer UID for participant history');
assert.equal(writes,0,'friend must not enter introducer Person history');
await recordReservationHistory(event({uid:'uid_booker',name:'空野 昴',isFriend:false,participantKind:'self'}));
assert.equal(resolvedUidCount,1,'self reservation must still resolve UID');
assert.equal(writes,1,'self history must still be saved');
console.log('PASS guest history (friend/proxy never credited to referrer; own history preserved)');

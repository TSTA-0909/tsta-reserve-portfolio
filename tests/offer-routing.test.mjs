import assert from 'node:assert/strict';
import { createOfferEngine } from '../src/domain/offerEngine.js';
let next = 1;
const logs=[];
const store=new Map();
const db={
 collection(name){return {doc(id){return {id:id||`offer${next++}`,name, key:`${name}/${id||`offer${next-1}`}`}}}},
 async runTransaction(fn){return fn({
  async get(ref){return {exists:false,id:ref.id,data:()=>({})}},
  set(ref,obj){store.set(`${ref.name}/${ref.id}`,obj)},delete(ref){store.set(`${ref.name}/${ref.id}`,'deleted')}
 })}
};
const mkEngine = (row)=>createOfferEngine({
 db,FieldValue:{serverTimestamp:()=>1,delete:()=>null}, Timestamp:{},logger:{warn:(...v)=>logs.push(v),error:(...v)=>logs.push(v)},
 getMessaging:()=>null,sendOfferPushToUid:async(uid,meta)=>logs.push({uid,...meta}),
 CONFIG_COLL:'config',RESERVATIONS_COLL:'reservations',WAITLIST_COLL:'waitlist',OFFERS_COLL:'offers',OFFER_KEYS_COLL:'offer_keys',
 OFFER_TTL_MIN:30,DEFAULT_TIME:'19:00',keyId:(d,t)=>d+'__'+t,nowTs:()=>({toMillis:()=>1000}),
 addMinutes:()=>({toMillis:()=>1801000}),normType:x=>x,getWaitlistQueue:async()=>[row],
 getOpenSlots:async()=>({open:1}),pickByCursor:queue=>({idx:0,row:queue[0]}),diag:()=>{},mkTraceId:()=>`trace`
});
const identity={personId:'person_1',isSelf:true,issue:''};
const valid={id:'waiting1',__ids:['waiting1','waiting2'],uid:'oldUid',participantKey:'self:oldUid',participantKind:'self',name:'花子',__recipient:identity};
await mkEngine(valid).issueOfferIfPossible('2026-11-04','experienced');
const offers=[...store.entries()].filter(([key])=>key.startsWith('offers/'));
assert.equal(offers.length,1);
assert.equal(offers[0][1].toGlobalStableId,'person_1');
assert.deepEqual(offers[0][1].waitlistIds,['waiting1','waiting2']);
assert.equal(logs.some(entry=>entry.uid==='oldUid'&&entry.toGlobalStableId==='person_1'),true);
store.clear();logs.length=0;
await mkEngine({...valid,__recipient:{personId:'',isSelf:true,issue:'full_name_conflict'}}).issueOfferIfPossible('2026-11-04','experienced');
assert.equal([...store.keys()].some(k=>k.startsWith('offers/')),false,'氏名衝突は発行しない');
console.log('PASS offer routing (canonical recipient, duplicate waitlist keys, identity hold)');

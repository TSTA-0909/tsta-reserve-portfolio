import assert from 'node:assert/strict';
import { resolveDeliveryOwner, collectDeliveryTokens, hasClearDifferentGivenName } from '../src/domain/identityDeliveryService.js';
import { projectMatchResultsForAdminStats } from '../src/domain/matchStatsPersonIdentityProjection.js';

const personData = {
  person_T: {lastName:'空野',firstName:'昴',linkedUids:['uid_T','old_UID'],mergedIntoGlobalStableId:'person_K'},
  person_K: {lastName:'空野',firstName:'星',linkedUids:['uid_K'],mergedFromGlobalStableIds:['person_T']}
};
const routeMap={uid_T:'person_K',old_UID:'person_K',uid_K:'person_K',uid_G:'person_G'};
const resolver={
  async resolveUid(uid){return {canonicalPersonId:routeMap[uid]||''}},
  async resolvePersonId(id){return {canonicalPersonId:id==='person_T'?'person_K':id}}
};
const tokenDocs=[
 {id:'uid_T',data:{token:'t-old',uid:'uid_T',active:true,updatedAt:{toMillis:()=>100}}},
 {id:'uid_T__devA',data:{token:'t-new',uid:'uid_T',active:true,updatedAt:{toMillis:()=>200}}},
 {id:'uid_K__devB',data:{token:'t-keita',uid:'uid_K',active:true,updatedAt:{toMillis:()=>190}}},
 {id:'uid_T__devB',data:{token:'shared',uid:'uid_T',active:true,updatedAt:{toMillis:()=>50}}},
 {id:'uid_G__devC',data:{token:'shared',uid:'uid_G',active:true,updatedAt:{toMillis:()=>300}}},
 {id:'uid_G__devX',data:{token:'t-disabled',uid:'uid_G',active:false,updatedAt:{toMillis:()=>400}}}
].map(x=>({id:x.id,ref:{},data:()=>x.data}));
const db={collection(coll){return {
 doc(id){return {async get(){return {exists:!!personData[id],data:()=>personData[id]}}}},
 async get(){return {docs:tokenDocs}}
}}};
assert.equal(hasClearDifferentGivenName('空野 昴',personData.person_K),true);
assert.equal(hasClearDifferentGivenName('空野',personData.person_K),false);
const mismatched=await resolveDeliveryOwner({uid:'uid_T',participantKind:'self',name:'空野 昴'},resolver,db);
assert.equal(mismatched.issue,'full_name_conflict');
const proxy=await resolveDeliveryOwner({uid:'uid_K',participantKind:'proxy',name:'紹介した友達'},resolver,db);
assert.equal(proxy.personId,'person_K');
assert.equal(proxy.isSelf,false);
const selected=await collectDeliveryTokens(db,resolver,{uid:'uid_T',personId:'person_K'});
assert.deepEqual(selected.map(row=>row.token).sort(),[],'別人同士の疑わしい統合は通知を止める');
const fallback=await collectDeliveryTokens(db,resolver,{uid:'uid_G'});
assert.deepEqual(fallback.map(row=>row.token),['shared']);
const match=(id,date,name,person,uid)=>({id,date,category:'experienced',pair1:[{name,globalStableId:person,uid}],pair2:[],winner:'pair1',score:{pair1:3,pair2:0}});
const matches=[match('m_old','2026-09-05','空野 昴','person_T','uid_T'),match('m_conflict','2026-11-02','空野 昴','person_K','uid_T'),match('m_keita','2026-11-03','空野 星','person_K','uid_K')];
const projected=await projectMatchResultsForAdminStats(matches,{
  loadPerson:async id=>personData[id]||null,loadAccountLink:async()=>null
});
assert.equal(projected.results[0].pair1[0].uid,'person:person_T','異なる実名の旧IDを星に統合しない');
assert.equal(projected.results[1].pair1[0].uid,'','異名の試合を保留する');
assert.equal(projected.results[2].pair1[0].uid,'person:person_K');
assert.ok(projected.conflicts.length>=2);
console.log('PASS identity routing and notification ownership (mock data)');

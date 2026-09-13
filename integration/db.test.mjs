import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Db,serviceDb} from '../src/db.mjs';
import {processOne} from '../src/worker.mjs';
// Isolated local CI database only. Never point this destructive fixture at production.
const url=process.env.SUPABASE_URL||'';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw Error('Integration fixtures require local Supabase');
const admin=serviceDb();const users=[];
async function user(){
 const email=`test-${randomUUID()}@example.com`,password='Course-Test-9384!';
 const row=await admin.request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});users.push(row.id);
 const login=await admin.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 return {id:row.id,db:new Db(url,process.env.SUPABASE_ANON_KEY,login.access_token)};
}
test('real database: isolation, atomic jobs, fencing, idempotency, budget and worker',async()=>{
 const a=await user(),b=await user();
 const ticket=await a.db.rpc('submit_ticket',{p_body:'取消订阅后收到通知'});
 assert.equal((await b.db.request(`/rest/v1/tickets?id=eq.${ticket}`)).length,0,'RLS blocks another tenant');
 await assert.rejects(a.db.rpc('claim_job',{}),'users cannot claim jobs');
 const claims=await Promise.all([admin.rpc('claim_job',{}),admin.rpc('claim_job',{})]);
 assert.equal(claims.flat().length,1,'concurrent workers have one winner');const job=claims.flat()[0];
 await assert.rejects(admin.rpc('complete_job',{p_job:job.id,p_lease:randomUUID(),p_result:{}}),'stale lease denied');
 const result={status:'draft',text:'请核对取消时间与账单时间。',citations:['billing-delay']};
 await admin.rpc('complete_job',{p_job:job.id,p_lease:job.lease_token,p_result:result});
 await admin.rpc('complete_job',{p_job:job.id,p_lease:job.lease_token,p_result:result});
 assert.equal((await admin.request(`/rest/v1/replies?ticket_id=eq.${ticket}`)).length,1,'completion replay creates one reply');
 const ticket2=await a.db.rpc('submit_ticket',{p_body:'请检查订阅'});
 let turns=0;
 await processOne(admin,()=>async()=>JSON.stringify(++turns===1?{action:'search_help',args:{query:'订阅'}}:{action:'draft_reply',args:{text:'取消停止下一周期续费。',citations:['billing-cancel']}}));
 assert.equal((await a.db.request(`/rest/v1/jobs?ticket_id=eq.${ticket2}`))[0].status,'completed');
 const ticket3=await a.db.rpc('submit_ticket',{p_body:'预算测试'});const j=(await admin.rpc('claim_job',{}))[0];
 assert.equal(j.ticket_id,ticket3);
 await admin.request('/rest/v1/budgets',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:{owner_id:a.id,day:new Date().toISOString().slice(0,10),token_limit:100,used_tokens:0,reserved_tokens:0}});
 const reserves=await Promise.all([admin.rpc('reserve_usage',{p_job:j.id,p_lease:j.lease_token,p_tokens:60}),admin.rpc('reserve_usage',{p_job:j.id,p_lease:j.lease_token,p_tokens:60})]);
 assert.equal(reserves.filter(Boolean).length,1,'atomic budget prevents concurrent overspend');
 const rid=reserves.find(Boolean);
 await admin.rpc('settle_usage',{p_id:rid,p_tokens:30,p_cost:0,p_state:'measured'});
 await admin.rpc('settle_usage',{p_id:rid,p_tokens:30,p_cost:0,p_state:'measured'});
 assert.equal((await a.db.request('/rest/v1/budgets?select=used_tokens'))[0].used_tokens,30,'settlement replay charged once');
 await admin.request(`/rest/v1/jobs?id=eq.${j.id}`,{method:'PATCH',body:{lease_until:'2000-01-01T00:00:00Z'}});
 const reclaimed=(await admin.rpc('claim_job',{}))[0];assert.notEqual(reclaimed.lease_token,j.lease_token,'restart reclaims with fresh lease');
 await assert.rejects(admin.rpc('complete_job',{p_job:j.id,p_lease:j.lease_token,p_result:result}));
 await admin.rpc('fail_job',{p_job:reclaimed.id,p_lease:reclaimed.lease_token,p_reason:'budget_exhausted'});
 assert.equal((await a.db.request(`/rest/v1/jobs?id=eq.${reclaimed.id}`))[0].status,'blocked');
});

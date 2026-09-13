import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from '../src/model.mjs';
const env = {MODEL_BASE_URL:'http://model/v1',MODEL_NAME:'test',MODEL_INPUT_LIMIT:'100',MODEL_MAX_TOKENS:'10'};
function fixture(reservation='reservation') {
  const calls=[]; return {calls,rpc:async(name,args)=> {calls.push({name,args});return name==='reserve_usage'?reservation:null;}};
}
test('budget refusal occurs before upstream request', async () => {
  const db=fixture(null);let fetched=false;
  const model=createModel({db,job:{id:'a',lease_token:'l'},env,fetchImpl:async()=>{fetched=true;}});
  await assert.rejects(model([{role:'user',content:'Hi'}]),/budget_exhausted/);assert.equal(fetched,false);
});
test('timeout conservatively charges unknown consumption', async () => {
  const db=fixture(); const model=createModel({db,job:{},env,fetchImpl:async()=>{throw Error('timeout');}});
  await assert.rejects(model([{role:'user',content:'Hi'}]),/timeout/);
  assert.equal(db.calls[1].args.p_state,'unknown');assert.equal(db.calls[1].args.p_tokens,110);
});
test('successful response settles actual token usage', async () => {
  const db=fixture();const model=createModel({db,job:{},env,fetchImpl:async()=>({ok:true,json:async()=>({usage:{prompt_tokens:20,completion_tokens:5},choices:[{message:{content:'{}'}}]})})});
  assert.equal(await model([{role:'user',content:'Hi'}]),'{}'); assert.equal(db.calls[1].args.p_tokens,25);
});
test('oversize input never enters reservation or model', async()=>{
 const db=fixture(); await assert.rejects(createModel({db,job:{},env})([{role:'user',content:'x'.repeat(200)}]),/input_limit/);assert.equal(db.calls.length,0);
});

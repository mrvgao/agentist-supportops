import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent, validateFinal} from '../src/agent.mjs';
const ticket = {owner_id: 'tenant-a', body: '取消后收到扣费通知，帮我看看'};
const scripted = actions => async () => JSON.stringify(actions.shift());
test('tool-driven agent gathers evidence before drafting', async () => {
  const r = await runAgent({ticket, lookupSubscription: async () => null, model: scripted([
    {action:'search_help',args:{query:'账单'}},
    {action:'draft_reply',args:{text:'请核对账单时间，取消不撤销既有账单。',citations:['billing-cancel']}}
  ])}); assert.equal(r.status,'draft'); assert.deepEqual(r.citations,['billing-cancel']);
});
test('missing evidence cannot become a confident draft', () => {
  assert.throws(() => validateFinal({action:'draft_reply',args:{text:'已经处理',citations:[]}},new Set()),/missing_evidence/);
});
test('fabricated citations are rejected', () => {
  assert.throws(() => validateFinal({action:'draft_reply',args:{text:'已经处理',citations:['fake']}},new Set()),/unknown_citation/);
});
test('tenant identity cannot be supplied by model', async () => {
  let owner;
  await runAgent({ticket, lookupSubscription:async id => {owner=id; return null;},model:scripted([
    {action:'lookup_subscription',args:{owner_id:'tenant-b'}},
    {action:'handoff',args:{text:'请人工核实订阅状态',citations:[]}}
  ])}); assert.equal(owner,'tenant-a');
});
test('unknown destructive tool is denied', async () => {
  await assert.rejects(runAgent({ticket,model:scripted([{action:'refund',args:{amount:999}}])}),/forbidden_tool/);
});
test('tool loops have a hard turn limit', async () => {
  await assert.rejects(runAgent({ticket,maxTurns:2,model:async()=>JSON.stringify({action:'search_help',args:{query:'账单'}})}),/turn_limit/);
});
test('malformed output fails explicitly', async () => {
  await assert.rejects(runAgent({ticket,model:async()=> 'not JSON'}),/invalid_model_json/);
});

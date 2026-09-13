import {serviceDb} from './db.mjs';
import {runAgent} from './agent.mjs';
import {createModel} from './model.mjs';
import {pathToFileURL} from 'node:url';

export async function processOne(db = serviceDb(), modelFactory = createModel) {
  const jobs = await db.rpc('claim_job', {}); const job = jobs?.[0];
  if (!job) return false;
  let heartbeatError = null;
  const heartbeat = setInterval(() => {
    db.rpc('renew_lease', {p_job: job.id, p_lease: job.lease_token}).catch(e => {heartbeatError = e;});
  }, 15000);
  try {
    const tickets = await db.request(`/rest/v1/tickets?id=eq.${job.ticket_id}&owner_id=eq.${job.owner_id}&select=*`);
    if (!tickets?.[0]) throw new Error('ticket_missing');
    const result = await runAgent({ticket: tickets[0], model: modelFactory({db, job}),
      lookupSubscription: async owner => {
        const rows = await db.request(`/rest/v1/subscriptions?owner_id=eq.${owner}&select=status,cancelled_at,last_invoice_at`);
        return rows?.[0] || null;
      }});
    if (heartbeatError) throw heartbeatError;
    await db.rpc('complete_job', {p_job: job.id, p_lease: job.lease_token, p_result: result});
    console.log(JSON.stringify({job: job.id, event: 'completed', status: result.status}));
  } catch (error) {
    const reason = /budget_exhausted/.test(error.message) ? 'budget_exhausted' : 'processing_failed';
    await db.rpc('fail_job', {p_job: job.id, p_lease: job.lease_token, p_reason: reason});
    console.error(JSON.stringify({job: job.id, event: reason}));
  } finally { clearInterval(heartbeat); }
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let stopping = false;
  process.on('SIGTERM', () => {stopping = true;});
  process.on('SIGINT', () => {stopping = true;});
  while (!stopping) {
    try { if (await processOne()) continue; } catch { console.error('worker_poll_failed'); }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

export function createModel({db, job, fetchImpl = fetch, env = process.env}) {
  return async messages => {
    const inputLimit = Number(env.MODEL_INPUT_LIMIT || 8192);
    const maxTokens = Number(env.MODEL_MAX_TOKENS || 512);
    // UTF-8 bytes are a conservative admission estimate for this text-only demo.
    // The limit is an explicit assumption, not measured tokenizer output.
    const estimatedInput = Buffer.byteLength(messages.map(m => m.content).join('')) + messages.length * 64;
    if (estimatedInput > inputLimit) throw new Error('input_limit');
    const reservation = await db.rpc('reserve_usage', {p_job: job.id, p_lease: job.lease_token, p_tokens: inputLimit + maxTokens});
    if (!reservation) throw new Error('budget_exhausted');
    let settled = false;
    try {
      const headers = {'Content-Type': 'application/json', Authorization: `Bearer ${env.MODEL_API_KEY || ''}`};
      if (env.CF_ACCESS_CLIENT_ID) {
        headers['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
        headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
      }
      const r = await fetchImpl(`${env.MODEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers, signal: AbortSignal.timeout(Number(env.MODEL_TIMEOUT_MS || 20000)),
        body: JSON.stringify({model: env.MODEL_NAME || 'support-agent', messages, max_tokens: maxTokens,
          temperature: 0, response_format: {type: 'json_object'}}),
      });
      if (!r.ok) throw new Error(`model_http_${r.status}`);
      const data = await r.json(); const usage = data.usage;
      if (!Number.isInteger(usage?.prompt_tokens) || !Number.isInteger(usage?.completion_tokens) || usage.prompt_tokens < 0 || usage.completion_tokens < 0) throw new Error('missing_usage');
      const tokens = usage.prompt_tokens + usage.completion_tokens;
      const cost = (usage.prompt_tokens * Number(env.MODEL_RATE_INPUT_USD_PER_MILLION || 0)
        + usage.completion_tokens * Number(env.MODEL_RATE_OUTPUT_USD_PER_MILLION || 0)) / 1e6;
      await db.rpc('settle_usage', {p_id: reservation, p_tokens: tokens, p_cost: cost, p_state: 'measured'});
      settled = true;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('missing_content');
      return content;
    } finally {
      // A timeout does not prove that upstream did not consume tokens. Keep the
      // reservation charged as unknown; do not silently refund it and retry free.
      if (!settled) await db.rpc('settle_usage', {p_id: reservation, p_tokens: inputLimit + maxTokens, p_cost: 0, p_state: 'unknown'});
    }
  };
}

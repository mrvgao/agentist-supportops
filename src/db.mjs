export class Db {
  constructor(url, key, bearer = key) {
    if (!url || !key) throw new Error('Missing Supabase configuration');
    this.url = url.replace(/\/$/, ''); this.key = key; this.bearer = bearer;
  }
  async request(path, {method = 'GET', body, headers = {}} = {}) {
    const r = await fetch(this.url + path, {
      method, headers: {apikey: this.key, Authorization: `Bearer ${this.bearer}`,
        'Content-Type': 'application/json', ...headers},
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 180)}`);
    return text ? JSON.parse(text) : null;
  }
  rpc(name, args) { return this.request('/rest/v1/rpc/' + name, {method: 'POST', body: args}); }
}
export function serviceDb() { return new Db(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); }

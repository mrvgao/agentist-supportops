import {Db} from '../src/db.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({error: '不支持此操作'});
  const bearer = req.headers.authorization?.replace(/^Bearer /, '');
  if (!bearer) return res.status(401).json({error: '请先登录'});
  const db = new Db(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, bearer);
  try {
    // Verification is delegated to Auth; ownership is derived again in SQL.
    await db.request('/auth/v1/user');
  } catch { return res.status(401).json({error: '登录已过期，请重新登录'}); }
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const text = body?.body?.trim();
      if (!text || text.length > 4000) return res.status(400).json({error: '工单需为 1–4000 个字符'});
      const id = await db.rpc('submit_ticket', {p_body: text});
      return res.status(201).json({id});
    }
    const tickets = await db.request('/rest/v1/tickets?select=id,body,created_at,replies(status,text,citations),jobs(status,attempts,last_error)&order=created_at.desc&limit=30');
    return res.status(200).json({tickets});
  } catch { return res.status(503).json({error: '暂时无法处理，请稍后重试'}); }
}

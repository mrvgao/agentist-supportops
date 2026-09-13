import http from 'node:http';
import {readFile} from 'node:fs/promises';
import tickets from '../api/tickets.mjs';
import config from '../api/config.mjs';
try { process.loadEnvFile(); } catch {}
http.createServer(async (req, res) => {
  res.status = n => {res.statusCode = n; return res;};
  res.json = data => {res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));};
  try {
    if (req.url === '/api/config') return config(req, res);
    if (req.url === '/api/tickets') {
      let body = ''; for await (const chunk of req) {body += chunk; if (body.length > 20000) return res.status(413).json({error: '请求过大'});}
      req.body = body ? JSON.parse(body) : null;
      return await tickets(req, res);
    }
    if (req.url === '/health') return res.json({ok: true});
    if (req.url !== '/') {res.statusCode = 404; return res.end('Not found');}
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await readFile(new URL('../public/index.html', import.meta.url)));
  } catch {res.status(500).json({error: '请求处理失败'});}
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('SupportOps http://127.0.0.1:' + (process.env.PORT || 3000)));

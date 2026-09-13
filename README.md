# SupportOps Agent

Agentist 的 180 分钟现代技术栈课程案例。两条链贯穿课堂：用户提交工单后由后台 Agent 处理；Code Agent 提交 PR 后由 GitHub Actions 自动测试。

## 运行

Node.js 22+。`npm ci && npm test` 无外部账号依赖。

本地完整栈需要 Supabase CLI 和 Docker：

```bash
supabase start
node scripts/test-local-db.mjs
```

把 `.env.example` 复制为 `.env` 并填入你自己的 Supabase 与推理服务配置。`npm start` 启动网页，另一个终端 `npm run worker`。不要把 service role key 配置到浏览器。

## 项目结构

- `public/index.html`：登录、提交工单、结果轮询；DOM 内容使用 textContent。
- `api/`：Vercel API；验证用户后使用用户 JWT 访问数据库。
- `src/agent.mjs`：有限工具循环、证据校验、人工转交。
- `src/worker.mjs`：持久任务、租约续期、有限重试。
- `src/model.mjs`：OpenAI 兼容模型调用、原子预算预留、实际用量结算。
- `supabase/migrations/`：RLS、原子抢单、租约 fencing、幂等回复与用量结算。
- `.github/workflows/pr-tests.yml`：PR 和 main push 自动执行单元与真实本地数据库测试。
- `deploy/`：vLLM、Tunnel 和可选 LiteLLM 配置。
- `course/`：讲义、Course Studio slides、白板项目与 180 分钟教案。

## 验收与诚实边界

`npm run check`、`npm test`、`npm run test:mutation`；数据库与 worker 集成测试在隔离的本地 Supabase 中运行。CI 不读取生产账号，不依赖 GPU 或云端模型。真实推理需要单独 smoke test，不能用模型替身的通过结果替代。

课堂版是个人工作区（owner_id = 登录用户），不包含多成员企业组织。订阅表为课堂输入，不执行真实退款或发送邮件。引用存在性可以由代码验证，回复事实是否被引用支持仍需人工或独立 eval；不能宣称具备完整语义保障。

预算限制为 Token admission limit；上游超时保留预留，不假装没有消费。成本字段在未配置价格时为零，表示尚未估价，不表示推理免费。自托管 GPU 租金单独核算。

## 发布

PR 必须通过 `unit-and-mutation`、`database-and-worker`，再人工审阅。Vercel 预览不是生产发布。Render 采用 CI 通过后部署。数据库迁移使用向后兼容的 expand/contract 流程；回退代码不自动回退数据。

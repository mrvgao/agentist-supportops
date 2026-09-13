# SupportOps 实施与验收记录

更新：2026-09-12。此文件区分真实验证、可部署代码与待接入的平台。

## 已完成

- 180 分钟课程（含 10 分钟休息）：lecture-note.md / PDF、36 页 Course Studio slides、12 块白板。
- Course Studio 已保存独立草稿 `supportops-modern-stack`，标题「让 Agent 管理现代应用栈 · SupportOps（cohort-1）」；原课程未改动。入口：`/studio/course`，在课程列表选择该标题。
- 白板在真实 Teachboard 编辑器中导入，通过 12 块内容完整性与刷新后持久化检查。`whiteboard.project.json` 为项目文件；`build-board.js` 为新建项目的导入脚本。
- GitHub 公开课堂仓库：https://github.com/mrvgao/agentist-supportops 。用户已授权公开。
- PR #1：https://github.com/mrvgao/agentist-supportops/pull/1 。保留先红后绿的提交记录。
- 红灯记录：https://github.com/mrvgao/agentist-supportops/actions/runs/34728047918 。移除证据检查后，真实断言失败。
- 绿灯记录：https://github.com/mrvgao/agentist-supportops/actions/runs/34728260356 。`unit-and-mutation` 与 `database-and-worker` 均通过。
- main 启用 strict required checks：上述两个检查必过，规则包括管理员，禁止绕过红灯直接合并。
- GitHub Actions 使用本地 Supabase 测试 Auth、RLS、并发领取、租约隔离、幂等完成、worker、并发预算和重复结算。PR 不读取生产密钥。
- Daytona 真实沙箱执行 11 个行为测试及变异测试成功，已删除本次沙箱。见 `daytona-evidence.json`。
- Supabase 新建 `supportops-agent`，区域 us-west-1，项目 ref `yzbccqnkxcthjlmxiarg`；已应用数据库迁移。用户确认 US$10/月。
- Supabase 安全检查仅提示 authenticated 可执行 `submit_ticket` 的 security definer；这是有意开放的窄入口，使用固定 search_path、auth.uid 和服务端派生 ownership。

## 部署还需完成

- Vercel：正常 CLI 登录已恢复；课堂站点 https://agentist-supportops.vercel.app 已部署。首页与配置接口 HTTP 200，未登录工单 API 返回 401。Production 和本次 PR Preview 已设置公共配置。
- Supabase：本地 `.env` 已填 public URL / anon key；仍需该新项目的服务端 key，写入 `SUPABASE_SERVICE_ROLE_KEY`，不要放进公开仓库。
- Render：账号已验证可访问；background worker 尚未创建。模板为 `render.yaml`，应在数据库服务端 key 与模型 URL 就绪后部署。
- Cloudflare：提供 Tunnel / Access 模板；尚未配置真实独立域名。不要修改现有 parallight.ai DNS。
- vLLM：真实 runAgent → vLLM 验证通过，7B 模型先检索后输出引用草稿，共 436 Token；见 `gpu-evidence.json`。临时实例已释放，并已确认从实例列表移除；正式上线需要重新启动 GPU 并更新受保护地址。
- 完整浏览器 → Vercel → Supabase → Render → vLLM 在线链路尚未验收。

## 材料构建

在 Parallight 源码及依赖已安装的环境：

```bash
python3 course/author.py
PARALLIGHT_ROOT=/path/to/Parallight node course/build.mjs
python3 course/pdf.py
```

PDF 需要 reportlab。已构建 HTML 与 PDF 可直接使用。UI 验证脚本需要本地静态服务器 8765、Teachboard 5178 和 Chrome；设置 `PARALLIGHT_ROOT` 后运行 `node course/verify-ui.mjs`。

## 边界

- 业务 Agent 只生成草稿或转人工，不真实发信、退款或扣款。Stripe 为课程扩展。
- 引用存在性、工具白名单、租户范围与预算由代码约束；语义正确性及退款转人工仍需进一步产品化验证。
- 模型网关配置是可选示例，未启用自动 fallback。
- 模型超时或进程中断保留预算占用，避免误退款；不代表已有完善的对账恢复机制。

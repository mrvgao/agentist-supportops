from pathlib import Path
import json,html
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor,white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
P=Path(__file__).parent;pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
styles={
 'h':ParagraphStyle('h',fontName='STSong-Light',fontSize=23,leading=32,textColor=HexColor('#15252e'),spaceAfter=16),
 'sub':ParagraphStyle('sub',fontName='STSong-Light',fontSize=11,leading=18,textColor=HexColor('#51636d'),spaceAfter=14),
 'body':ParagraphStyle('body',fontName='STSong-Light',fontSize=11,leading=18,spaceAfter=10),
 'label':ParagraphStyle('label',fontName='STSong-Light',fontSize=13,leading=20,textColor=HexColor('#234bc4'),spaceBefore=10,spaceAfter=7),
 'code':ParagraphStyle('code',fontName='STSong-Light',fontSize=8,leading=12,spaceAfter=12),
}
flow=[]
def para(t,style='body'):return Paragraph(html.escape(t).replace('\n','<br/>'),styles[style])
flow +=[Spacer(1,60),para('让 Agent 管理现代应用栈','h'),para('SupportOps · Agentist cohort-1','sub'),para('从代码到上线，再到持续运行','h'),Spacer(1,22),para('180 分钟课堂讲义 · 2026-09-12','sub'),para('Vercel · Supabase · Render · Cloudflare · GitHub Actions · Lambda / vLLM · Daytona'),Spacer(1,20),para('贯穿案例：用户提交客服工单，后台 Agent 查询资料并保存回复草稿。Code Agent 编写测试、创建 PR、修复 CI 失败，再验证部署。'),para('本讲义区分已实现代码、部署模板与待实测操作。最新资源及验证状态见同目录 STATUS.md。'),PageBreak()]
chapters=json.loads((P/'chapters.json').read_text())
flow +=[para('课程地图','h'),para('上半场把应用部署上去；下半场让测试、发布、推理与预算形成可验证闭环。')]
for i,c in enumerate(chapters,1):flow.append(para(f'{i:02d}  {c[0]}  /  {c[1]}'))
flow +=[para('80–90 分钟休息。课前完成账号配置、模型下载和沙箱预热。','sub'),PageBreak()]
for i,(title,time,body,diagram,steps,code,prompt,check,limit) in enumerate(chapters,1):
 flow +=[para(f'{i:02d}  {title}','h'),para(time,'sub'),para(body),para(diagram,'sub'),para('操作路径','label')]
 flow +=[para('• '+x) for x in steps]
 flow +=[para('操作示例','label'),para(code,'code'),para('给 Code Agent 的任务','label'),para(prompt),para('验证成功的证据','label'),para(check),para('边界与常见误区','label'),para(limit),PageBreak()]
flow +=[para('复现与验收','h'),para('代码仓库：github.com/mrvgao/agentist-supportops'),para('本地：npm ci → npm run check → npm test → npm run test:mutation。数据库集成：supabase start → node scripts/test-local-db.mjs。'),para('必过检查','label'),para('unit-and-mutation：代码检查、行为测试、变异检测。database-and-worker：真实 Auth、RLS、并发领取、过期租约、幂等完成、并发预算和重复结算。'),para('发布前','label'),para('核对 commit、预览链接、环境变量、数据库迁移与用户隔离。真实模型 smoke test 单独记录，不能由替身测试替代。'),para('资源清理','label'),para('Lambda：只释放本次创建的实例 id。Daytona：只删除本次测试沙箱。Render 与 Supabase：长期保留需明确负责人和预算。'),para('参考文档','label')]
for t,u in [('GitHub PR 与必需检查','https://docs.github.com/en/pull-requests/reference/status-checks'),('Render 部署','https://render.com/docs/deploys'),('Supabase API key 与权限','https://supabase.com/docs/guides/getting-started/api-keys'),('vLLM 兼容接口','https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/'),('Cloudflare Tunnel','https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/')]:flow +=[para(t),Paragraph(f'<link href="{u}">{u}</link>',ParagraphStyle('url',parent=styles['sub'],fontName='Helvetica',fontSize=8,leading=11))]
def page(c,d):
 c.setTitle('SupportOps · 现代 Agent 技术栈');c.setAuthor('Agentist');c.setStrokeColor(HexColor('#d6dfe3'));c.line(44,802,551,802);c.setFont('Helvetica',9);c.setFillColor(HexColor('#51636d'));c.drawString(44,815,'AGENTIST / SUPPORTOPS');c.drawRightString(551,25,str(d.page))
SimpleDocTemplate(str(P/'lecture-note.pdf'),pagesize=(595,842),rightMargin=44,leftMargin=44,topMargin=60,bottomMargin=48).build(flow,onFirstPage=page,onLaterPages=page)
print('PDF generated')

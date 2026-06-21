# AI 顾投小助手 MVP

这是一个本地可运行的 To C AI 顾投小助手 MVP。当前版本以“产品浏览与交易”为默认入口，用户可以正常买入/卖出产品；系统在进入交易确认页时同步做冲突判断，并以非阻断浮层展示风险提示。

## 当前版本重点

- 默认进入产品页。
- 点击买入/卖出后进入交易确认页。
- 冲突提示不阻断交易确认流程。
- 中/高风险提示都提供“撤回操作”。
- 无追问的提示提供“撤回操作 / 继续操作”。
- 有追问的提示提供“撤回操作 / 打开对话回答 / 关闭提示”。
- 左侧“对话”栏目不切换页面，只打开悬浮 AI 对话框。
- 悬浮 AI 对话框里有两个独立输入区：
  - 仅在有追问时出现的“回答追问”输入框。
  - 始终可用的“问 AI 一个问题”输入框。
- 前端已移除指标页面；后端 `/api/metrics` 暂保留用于测试和后续扩展。

## 技术栈

- 前端：Next.js + TypeScript + Tailwind CSS
- UI：本地 shadcn/ui 风格轻量组件
- 后端：Next.js Route Handlers
- 数据库：SQLite
- ORM：Prisma
- 校验：Zod
- LLM：统一 Provider，默认 Mock，可切换 OpenAI-compatible API
- 测试：Vitest
- 包管理器：pnpm

## 快速启动

```bash
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

访问：

```bash
http://localhost:3000
```

Windows PowerShell 如果因为执行策略拦截 `pnpm.ps1`，使用等价命令：

```bash
pnpm.cmd install
pnpm.cmd prisma migrate dev
pnpm.cmd prisma db seed
pnpm.cmd dev
```

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
DATABASE_URL="file:./dev.db"
LLM_MODE="mock"
OPENAI_COMPATIBLE_BASE_URL="https://api.openai.com/v1"
OPENAI_COMPATIBLE_API_KEY=""
OPENAI_COMPATIBLE_MODEL="gpt-4.1-mini"
```

## LLM 模式

默认使用 Mock 模式，无需 API Key。

```bash
LLM_MODE="mock"
```

切换到 OpenAI-compatible API：

```bash
LLM_MODE="openai"
OPENAI_COMPATIBLE_BASE_URL="https://api.openai.com/v1"
OPENAI_COMPATIBLE_API_KEY="你的 key"
OPENAI_COMPATIBLE_MODEL="gpt-4.1-mini"
```

真实模型不可用、超时、JSON 异常或置信度不足时，系统会降级为 Mock 或安全模板，不中断页面流程。

## 演示数据

Seed 会创建演示用户“用户 A”和 5 个产品：

- 货币基金：低波动，T+1
- 债券基金：中低波动，T+2
- 指数基金：中高波动，T+3
- 高波动股票基金：高波动，T+7
- 封闭理财：180 天封闭期

初始化命令：

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

## 主要页面

### 产品页

默认首页。展示产品列表，每个产品有买入/卖出按钮。

交易流程：

1. 用户点击买入或卖出。
2. 后端执行确定性冲突判断。
3. 页面进入交易确认页。
4. 如果有中/高风险，右下角展示非阻断风险提示。
5. 用户可继续确认交易，也可通过提示浮层撤回操作。

### 交易确认页

展示：

- 交易方向
- 交易金额
- 产品类型
- 风险等级
- 历史最大回撤
- 赎回到账时间
- 同步风险提示摘要

按钮：

- 返回修改
- 确认提交

### 悬浮 AI 对话框

入口：

- 左侧“对话”栏目
- 左下角悬浮“对话”按钮
- 风险提示里的“打开对话回答”

能力：

- 回答系统追问。
- 主动问 AI 问题。
- 高冲突时提交回答并触发画像更新校验。
- 对话不阻断交易流程。

### 用户画像页

维护用户画像问卷字段，并展示后端派生字段。派生计算集中在：

```bash
src/domain/profile/deriveProfile.ts
```

### 日志页

展示：

- AI 调用日志
- 识别结果
- 画像路由日志
- 冲突判断日志
- 冲突互动日志
- 画像更新建议和更新结果
- 合规检测日志

支持展开查看 JSON，并导出 JSON。

## 领域规则

冲突规则位于：

```bash
src/domain/conflicts/
```

已实现规则：

1. 损失承受-历史回撤冲突
2. 期限-流动性冲突
3. 目标刚性-产品波动冲突
4. 中途用款-产品波动冲突
5. 风险缓冲弱-持仓风险冲突
6. 资金缺口-风险承担冲突
7. 恐慌卖出-长期目标冲突
8. 兴奋买入-风险承受冲突

规则由 TypeScript 纯函数实现，LLM 不参与冲突等级判断。

## 核心目录

```bash
app/api/                  Next.js API Routes
app/page.tsx              单页前端主界面
prisma/schema.prisma      Prisma 数据模型
prisma/seed.ts            演示数据
src/config/               字段和路由配置
src/domain/profile/       画像派生计算
src/domain/conflicts/     冲突规则引擎
src/domain/compliance/    合规检测
src/lib/llm/              LLM Provider
src/server/               后端编排服务
src/test/                 规则测试
```

## 验证命令

```bash
pnpm test
pnpm lint
pnpm build
```

Windows PowerShell：

```bash
pnpm.cmd test
pnpm.cmd lint
pnpm.cmd build
```

当前测试覆盖：

- 16 个冲突规则单元测试
- 4 个 API 测试

## 当前取舍

- 这是 MVP，不包含真实登录、真实账户、真实订单系统和支付清算。
- 交易“确认提交”是前端演示状态，不是真实下单。
- Prisma SQLite 当前版本不支持原生 Json 字段，项目使用 TEXT 保存序列化 JSON。
- 当前环境下 Prisma `migrate dev` 存在 schema-engine 兼容问题，因此项目通过 `scripts/prisma-wrapper.ts` 将 `pnpm prisma migrate dev` 包装为执行 migration SQL 并生成 Prisma Client。
- 指标页面已从前端删除，但后端 metrics API 暂保留。

## 生产化建议

- 接入真实登录、账户、持仓、订单和交易确认系统。
- 将交易撤回/继续与真实订单状态机打通。
- 增加不可篡改审计日志。
- 增加真实产品数据源和申赎日历。
- 增加 Prompt 版本、规则版本和字段版本管理。
- 增加端到端浏览器测试和模型质量评估集。

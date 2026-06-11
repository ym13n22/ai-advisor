# RiskMind AI PRD 对照查漏报告

本文基于 `C:\Users\Administrator\Downloads\finTech (2).pdf` 抽取内容与当前代码实现整理。注意：该 PDF 的中文文本层存在字体编码问题，抽取后部分中文乱码；以下对照主要依据可识别的章节标题、英文术语、公式、枚举、MVP/Roadmap 条目，以及当前项目代码行为。

## 1. 当前项目结论

当前版本已经覆盖 PRD 的 Core System MVP 主线：注册/登录、KYC、WOE + Logistic 评分卡、交易事中风控、产品推荐、增长漏斗、AI 解释、RBAC 和审计日志。技术栈与 PRD 设想不完全一致：PRD 倾向 `React/Next.js + FastAPI/Python + PostgreSQL/Redis/ClickHouse + Ollama/Gemini`，当前实现是 `React/Vite + Express/TypeScript + database.json + Mock/Ollama/Gemini`，更像轻量 MVP 沙盒。

## 2. PRD 功能对照

| PRD 模块 | PRD 要点 | 当前实现 | 状态 |
| --- | --- | --- | --- |
| Product Overview / MVP | AI 金融风控决策平台，覆盖 KYC、风控、交易、推荐、增长 | 前后端一体 MVP，Express 承载 API，Vite 承载页面 | 已覆盖 MVP 形态 |
| KYC System | `INIT` / `PENDING` / `VERIFIED` / `REJECTED` / `MANUAL_REVIEW` | 枚举和流程已实现；提交后 `PENDING`，审核可改三类状态 | 已实现 |
| WOE + Logistic Scorecard | Feature Binning、WOE、PD、0-100 risk score | 静态 WOE 映射、Logistic PD、score scaling 已实现 | 已实现，偏静态 |
| Risk Level | `LOW` 80-100，`MEDIUM` 50-80，`HIGH` 20-50，`CRITICAL` 0-20 | 阈值对应实现：`>=80`、`>=50`、`>=20`、`<20` | 已实现 |
| Transaction Risk | KYC Check、Scorecard Layer、实时特征、Rule Engine、Decision Engine | KYC、分数、黑名单、1 分钟频次、3 倍金额偏离、余额扣减 | 部分实现 |
| Decision Outputs | `ALLOW` / `REVIEW` / `STEP_UP` / `BLOCK` | 已有 `ALLOW`、`REVIEW`、`MANUAL_REVIEW`、`STEP_UP`、`BLOCK` | 已实现并扩展 |
| ML Risk Engine | PRD 提到 GBDT / anomaly detection 输出 `trade_risk_score` | 当前无真实 GBDT/异常检测模型 | 缺口 |
| Growth Analytics | Acquisition、Conversion、KYC、First Deposit、First Trade、DAU/留存等 | 有漏斗数据和指标，但大部分混入 mock 偏移值 | 部分实现 |
| A/B Testing | PRD 提到 A/B 实验、Treatment Group | 当前没有实验配置、分组、指标归因 | 缺口 |
| Product Engine | Risk Filtering、Similarity Matching、Ranking Model、LLM Reasoning | 有产品风险过滤、匹配分和 LLM 解释；无 embedding/GBDT/LTR | 部分实现 |
| AI Explanation | Ollama/Gemini 生成风险解释、增长报告、推荐理由 | 支持 `mock`、`ollama`、`gemini` provider | 已实现基础版 |
| AI Routing | PRD 提到 Router、Model Selection、Confidence、Execution Path | 当前用 `AI_PROVIDER` 简单选择，无 confidence/path 记录 | 部分实现 |
| Data Entities | User、KYCProfile、Transaction、RiskScore、Product、BehaviorLog | 类型和 JSON 数据层都存在 | 已实现 |
| Data Layer | Core/Event/Decision Layer | 逻辑上存在，但物理上都在 `database.json` | 部分实现 |
| RBAC | Admin、Risk Analyst、Growth Analyst、Trader、AI Service | 四类用户角色已实现；AI Service 不是独立角色 | 部分实现 |
| Model Registry / MLOps | 模型注册、版本治理 | 当前没有 model registry、版本、灰度、回滚 | 缺口 |
| Logging & Audit | User Behavior、Transaction、Risk Decision、Model Inference、Access Log | 有 BehaviorLog，记录关键成功动作；无独立 model/access log | 部分实现 |
| KPI | Risk/Growth/Recommendation/AI KPIs | 增长和部分交易统计可见；风险/AI KPI 未体系化计算 | 部分实现 |
| Compliance Export | PRD 提到合规导出 | 当前没有导出 CSV/PDF/Excel | 缺口 |

## 3. 关键差距与建议优先级

### P0：影响演示或验收的一致性问题

1. **前端交易页说明口径**
   - 文件：`src/App.tsx`
   - 现状：已同步为最新产品适当性规则：20-49 仅 LOW，50-79 可 LOW/MEDIUM，80+ 全部。
   - 后续：如要提升体验，可在产品下拉中直接展示产品风险等级。

2. **交易准入规则**
   - 文件：`src/server/rules.ts`
   - 现状：已清理旧 20-79 人工分支，交易准入按产品风险等级执行。
   - 后续：可增加单元测试覆盖 `LOW/MEDIUM/HIGH` 三类产品。

3. **当前没有安装依赖，无法直接 lint/build**
   - 现状：`node_modules` 不存在，`npm.cmd run lint` 报 `tsc is not recognized`。
   - 建议：先执行 `npm install` 或 `npm ci`，再跑 `npm.cmd run lint`。

### P1：PRD 明确提到但当前只做了轻量版

1. **数据层**
   - PRD：PostgreSQL、Redis、ClickHouse、ORM。
   - 当前：`database.json` 文件数据库。
   - 建议：MVP 可保留 JSON；若要接近 PRD，下一阶段迁移 PostgreSQL，并将行为日志/交易事件拆到事件表。

2. **ML Risk Engine**
   - PRD：GBDT / anomaly detection、`trade_risk_score`。
   - 当前：规则引擎为主。
   - 建议：先增加 `tradeRiskScore` 字段和 mock 模型接口，再替换成真实模型。

3. **推荐系统**
   - PRD：Risk Filtering + Similarity Matching + Ranking Model + LLM。
   - 当前：按风险等级过滤 + 简单 matching score + LLM 解释。
   - 建议：增加产品特征、用户偏好特征、排序分，并保留解释链路。

4. **AI Router**
   - PRD：Model Selection、Confidence Score、Execution Path。
   - 当前：按 `AI_PROVIDER` 静态选择。
   - 建议：返回 AI 调用元数据：provider、latency、fallback、confidence。

5. **审计系统**
   - PRD：User Behavior、Transaction、Risk Decision、Model Inference、Access Log。
   - 当前：统一 BehaviorLog。
   - 建议：至少增加 `model_inference` 和 `access` 两类日志，或在 BehaviorLog 增加 `logType`。

### P2：增强项

1. A/B 实验：增加实验配置、分组、实验指标。
2. KPI 面板：补 Risk KPIs、Recommendation KPIs、AI KPIs。
3. 合规导出：支持审计日志 CSV/Excel 导出。
4. Model Registry：增加模型版本、启停、灰度、回滚。
5. Docker Compose：按 PRD 增加容器化运行方式。

## 4. 当前运行方式

### 前置条件

- Node.js 18+，推荐 20+。
- 当前目录：`F:\1D\myj\产品\riskmind-ai`
- 首次运行必须安装依赖，因为当前工作区没有 `node_modules`。

### 开发模式

```powershell
cd "F:\1D\myj\产品\riskmind-ai"
npm install
npm run dev
```

Windows PowerShell 如果遇到 `npm.ps1` 执行策略报错，使用：

```powershell
npm.cmd install
npm.cmd run dev
```

启动后访问：

```text
http://localhost:3000
```

### 生产构建

```powershell
cd "F:\1D\myj\产品\riskmind-ai"
npm.cmd install
npm.cmd run build
npm.cmd run start
```

### 环境变量

默认不用配置即可跑 mock AI。需要真实 AI 时配置 `.env`：

```env
AI_PROVIDER=mock
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=
```

可选值：

- `AI_PROVIDER=mock`：本地模板解释，无外部依赖。
- `AI_PROVIDER=ollama`：调用本地 Ollama `llama3`。
- `AI_PROVIDER=gemini`：调用 Gemini API，需要 `GEMINI_API_KEY`。

### 测试账号

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `trader` | `trader123` | Trader |
| `vip_trader` | 任意 | Trader |
| `admin` | `admin123` | Admin |
| `risk` | `risk123` | Risk Analyst |
| `growth` | `growth123` | Growth Analyst |

当前登录逻辑只按用户名匹配，密码字段主要用于演示。

## 5. 建议下一步

最值得优先做的是：清理编码乱码和旧交易分支、安装依赖后跑一次 `lint/build`、把交易页提示改成最新产品适当性规则。这三步做完，演示一致性会明显更稳。

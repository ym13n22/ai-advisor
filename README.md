# RiskMind 金融 AI 风险控制与决策分析平台 MVP

RiskMind 是一款面向金融机构（金融风控合规、高势增长拓新及主动资产管理团队）的一站式 AI 驱动决策平台 MVP。系统深度融合了经典**风控评分卡（Logistic Scorecard）**与**大语言模型生成式 AI (Gemini 3.5)**。

---

## 🚀 核心功能模块

### 1. 简便极速场景测试 (Test Station Switcher)
- 系统底层由统一 `database.json` 作为动态文件数据库支持。
- 登录面板及控制台左下侧内置**“一键测试角色热流转台”**，允许调试员、风控分析师及合规主控官在 **Trader (内置交易员)**、**Admin (系统管理员)**、**Risk Analyst (风控分析组)**、**Growth Analyst (增长运营官)** 四种身份间秒级任意切换，零延迟即时测试并验证业务断层阻隔。

### 2. 双通道实名 KYC 准入合规验证
- 交易员可以向合规盾发起实名资料填报（包括姓名、身份证号码、出生国、出生日期等）。
- 实名进件提交后，系统会将状态流转到 `PENDING`。
- 登录中高阶审核角色（Admin 或 Risk 组）能进入专享**“实名合规复审队列”**对工单手动执行 `VERIFIED` / `REJECTED` / `MANUAL_REVIEW`，并填注合规意见，变更后智能评分卡和收益适配层秒级生效、全局传播。

### 3. WOE + Logistic 回归信用评分卡实验室
- 在前端“评分卡调试”板块，用户可以实时通过滑动条输入：**IP变化次数**、**设备环境跳转率**、**1分钟活跃机器频次**、及一键勾选入<b>反洗钱/欺诈黑名单库</b>。
- 点击测算后，后台精确运用 **证据权重 (Weight of Evidence, WOE) 离散分箱法** 与 **Logistic 逻辑回归模型** 跑出定量违约概率 (PD, Probability of Default)，并完美映射出标准个人信用评分 (risk_score, 0-100)：
  $$risk\_score = A - B \times \ln\left(\frac{PD}{1 - PD}\right)$$
- 智能合规 AI 经理（支持 Mock 模板 / Ollama / Gemini 3.5 三种模式）自动生成专属CRO风控长分析报告，阐释分箱底数因子。

### 4. 事中实时检测监控交易熔断引擎
- 当交易员提交理财或交易认购时，系统实时行使事中穿透：
  - **KYC未认证直接熔断 (BLOCK)**：必须首先在 KYC 板块取得 `VERIFIED`。
  - **极低评分防范 (BLOCK)**：WOE 评分卡处于 20 以下 Critical 极高风险。
  - **高危洗钱阻断 (BLOCK)**：命入欺诈黑名单直接拦截。
  - **高频刷单减速制停 (REVIEW)**：1分钟内连交 5 笔交易。
  - **异常大波偏离 (STEP_UP)**：单次申请额超出您历史均值交易额的 3 倍。强制发起 OTP 短信二次强安全增强。

### 5. 首席增长官 (CGO) 转化漏斗与 AI 洞察
- 数据看板精细统计真实用户的各阶段活跃：`Visit (网页访客) → Register (注册建立) → KYC Completed (实名核准) → First Deposit (首次入金) → First Trade (首次交易) → Active Trader (活跃复签)`。
- 配置 **Recharts** 绘制转化漏斗剖析，由大模型智能诊断生成 **《CGO 转化增长商业季报》** 指引。

### 6. 千人千面智能财富配置货架
- 基于交易户的信用等级 (LOW/MEDIUM/HIGH) 匹配贴合的底层稳健债权、混合Beta或是高阿尔法进取型对冲产品，并由财富专家 AI 给出长篇投资适度理财理由。

---

## 🔑 免注册一键测试账号 (Demo Credentials)

| 用户名 (Username) | 密码 (Password) | 默认系统角色 (RBAC Role) | 场景验证亮点 (Use Case Highlight) |
| :--- | :--- | :--- | :--- |
| **`trader`** | `trader123` | **Trader** *(普通交易户)* | 发起KYC审核流程、划扣模拟金、遭受大额 3x STEP_UP 二次阻断、选理财 |
| **`admin`** | `admin123` | **Admin** *(最高主控制管理)* | 审批所有KYC审核单、热插拔切换底层 Mock/Gemini 大语言模型引擎、看 Swagger |
| **`risk`** | `risk123` | **Risk Analyst** *(风控合规组)* | 在评分卡实验室里手动调节并调试 WOE 参数，查看全链路 BehaviorLogs |
| **`growth`** | `growth123` | **Growth Analyst** *(高增长运营)* | 调阅日活跃(DAU)、转化漏斗Recharts及 LLM 分析报告 |

---

## ⚙️ 统一 RESTful API 体系

### ApiResponse 统一标准出参：
```json
{
  "success": true,
  "data": {},
  "message": "执行反馈说明"
}
```

### 开放核心 API 路由：
- **`POST /api/auth/register`** - 无上锁用户注册
- **`POST /api/auth/login`** - 派发 session auth token 凭证
- **`POST /api/auth/deposit`** - 补仓/注入模拟证券本金（记录审计日志）
- **`POST /api/kyc/submit`** - 实名信息提报
- **`POST /api/kyc/audit`** - [Admin/Risk可用] 终审并热触发重新风控算分
- **`POST /api/risk/evaluate`** - 全要素 WOE 风控评分卡重新计算
- **`POST /api/transactions/apply`** - 事中多要素规则风控交易安全申购
- **`GET /api/growth/metrics`** - 获取转化增长漏斗及大模型诊断周报
- **`POST /api/ai/config`** - [Admin可用] 动态温和连入 Ollama / Gemini 3.5

---

## 📦 本地运行维护启动 (Production Commands)

```bash
# 1. 安装核心运行组件
npm install

# 2. 启动开发模式（前端热搭载中间件 + 后端 Express 监听 Port 3000）
npm run dev

# 3. 生产构包打包（Vite静态资源打包 + esbuild CJS 零依赖后端集成）
npm run build

# 4. standalone 启动生产 release 版本
npm run start
```

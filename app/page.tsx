"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, Database, Download, FileText, MessageSquare, Package, RefreshCw, Save, Send, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Tab = "dashboard" | "profile" | "chat" | "products" | "logs";
const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "首页", icon: <Activity size={16} /> },
  { key: "profile", label: "画像", icon: <UserCog size={16} /> },
  { key: "chat", label: "对话", icon: <MessageSquare size={16} /> },
  { key: "products", label: "产品", icon: <Package size={16} /> },
  { key: "logs", label: "日志", icon: <FileText size={16} /> }
];
const demoMessages = [
  "最近一直跌，我真的受不了了，准备今天全部卖掉。",
  "最近涨得太好了，我想把所有钱都投进去。",
  "这笔钱下个月买房，我可以买这个封闭产品吗？",
  "我其实最多只能接受亏损 5%。",
  "帮我复盘一下最近的投资情况。"
];

const money = (v: unknown) => `¥${Number(v ?? 0).toLocaleString()}`;
const pct = (v: unknown) => `${Math.round(Number(v ?? 0) * 100)}%`;
const fieldLabels: Record<string, string> = {
  amount: "交易金额",
  availableDays: "产品可用天数",
  buffer: "风险缓冲能力",
  currentPreparedAmount: "当前已准备金额",
  debtServiceRatio: "负债偿付率",
  drawdown: "历史最大回撤",
  earliestUseDate: "最早可能使用日期",
  effectiveInvestmentMonths: "有效投资期限",
  effectiveMaxLossAmount: "有效最大损失金额",
  effectiveMaxLossRatio: "有效最大损失比例",
  emotion: "情绪状态",
  fundingGap: "当前资金缺口",
  fundingGapRatio: "资金缺口率",
  goalCompletionRate: "目标完成率",
  goalFeasibility: "目标可实现度",
  goalPriority: "目标优先级",
  goalType: "目标类型",
  gap: "资金缺口率",
  gapDays: "流动性缺口天数",
  historicalMaxDrawdown: "历史最大回撤",
  interimFundingProbability: "中途用款概率",
  investmentExperienceLevel: "投资经验等级",
  lockupDays: "封闭期天数",
  maxDrawdownExperience: "最大实际亏损经历",
  monthlyInvestment: "每月可投入金额",
  needDays: "资金需要天数",
  postLossFundingNeed: "亏损后的资金需求",
  prob: "中途用款概率",
  productType: "产品类型",
  ratio: "交易资金占比",
  recoveryWaitMonths: "恢复等待期限",
  redeemArrivalDays: "赎回到账工作日",
  riskBufferAbility: "风险缓冲能力",
  selfDecisionLevel: "自主决策程度",
  tolerance: "可承受损失比例"
};
const labelField = (field: unknown) => fieldLabels[String(field)] ?? String(field);
const labelFields = (fields: unknown[] | undefined, fallback: string) => fields?.length ? fields.map(labelField).join("、") : fallback;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("products");
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("stock-fund");
  const [input, setInput] = useState(demoMessages[0]);
  const [chatResult, setChatResult] = useState<any>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("我其实最多只能接受亏损 5%。");
  const [logs, setLogs] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [tradeCheck, setTradeCheck] = useState<any>(null);
  const [tradeDone, setTradeDone] = useState<string | null>(null);
  const [pendingTrade, setPendingTrade] = useState<any>(null);
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/bootstrap");
    const json = await res.json();
    setData(json);
    setProducts(json.products);
    setSelectedProduct((prev) => prev || json.products?.[0]?.id);
  };
  useEffect(() => { refresh(); }, []);

  const derived = data?.derived ?? {};
  const profile = data?.profile ?? {};
  const goal = data?.goal ?? {};

  const submitChat = async () => {
    const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: data.user.id, conversationId: "demo-conversation", productId: selectedProduct, text: input }) });
    const json = await res.json();
    setChatResult(json);
    await refresh();
  };
  const submitClarify = async () => {
    const res = await fetch("/api/clarification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: data.user.id, conversationId: chatResult.conversationId, conflictPairId: chatResult.conflicts.conflictPairId, productId: selectedProduct, answer: clarifyAnswer }) });
    setChatResult({ ...chatResult, clarificationUpdate: await res.json() });
    await refresh();
  };
  const loadLogs = async () => setLogs(await (await fetch("/api/logs")).json());
  useEffect(() => { if (tab === "logs") loadLogs(); }, [tab]);

  const updateProfile = async (path: "profile" | "goal", key: string, value: unknown) => {
    setData((old: any) => ({ ...old, [path]: { ...old[path], [key]: value } }));
  };
  const saveProfile = async () => {
    setSaving(true);
    const res = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: data.user.id, profile: data.profile, goal: data.goal }) });
    setData(await res.json());
    setSaving(false);
  };
  const startTrade = async (productId: string, operationType: "买入" | "卖出") => {
    setTradeDone(null);
    setPendingTrade(null);
    const amount = operationType === "买入" ? Math.min(50000, Math.max(10000, Number(derived.currentPreparedAmount ?? 100000) * 0.5)) : Number(derived.currentPreparedAmount ?? 100000);
    const res = await fetch("/api/trade/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: data.user.id, productId, operationType, amount })
    });
    const json = await res.json();
    setPendingTrade({ ...json, operationType, amount });
    setTab("products");
    if (json.canSubmitDirectly) {
      setTradeDone(null);
      await refresh();
      return;
    }
    setTradeCheck({ ...json, operationType });
    setTradeDone(null);
    await refresh();
  };
  const closeTradeDialog = async () => {
    setTradeCheck(null);
  };
  const handleTradePromptAction = async (action: "撤回操作" | "继续操作") => {
    if (tradeCheck?.conflictPairId) {
      await fetch("/api/trade/interaction", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ userId: data.user.id, conflictPairId: tradeCheck.conflictPairId, action })
      });
    }
    if (action === "撤回操作") {
      setPendingTrade(null);
      setTradeDone("已撤回本次交易操作。");
    }
    setTradeCheck(null);
    await refresh();
  };
  const confirmPendingTrade = async () => {
    if (!pendingTrade) return;
    setTradeDone(`${pendingTrade.operationType}确认已提交。`);
    setPendingTrade(null);
    setTradeCheck(null);
    await refresh();
  };

  if (!data) return <main className="p-8 text-sm text-slate-600">正在加载演示数据，请先执行数据库初始化和 seed。</main>;

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-xl font-semibold">AI 顾投小助手 MVP</h1>
            <p className="text-sm text-slate-500">确定性规则 + 可替换 LLM Provider + 完整审计链路</p>
          </div>
          <Button variant="outline" onClick={refresh}><RefreshCw size={16} />刷新</Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-[180px_1fr] gap-5 px-5 py-5">
        <nav className="space-y-2">
          {tabs.map((item) => <Button key={item.key} variant={(tab === item.key && item.key !== "chat") || (item.key === "chat" && floatingChatOpen) ? "default" : "ghost"} className="w-full justify-start" onClick={() => item.key === "chat" ? setFloatingChatOpen(true) : setTab(item.key)}>{item.icon}{item.label}</Button>)}
        </nav>
        <section className="space-y-5">
          {tab === "dashboard" && <Dashboard data={data} setTab={setTab} />}
          {tab === "profile" && (
            <div className="space-y-5">
              <Card>
                <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">用户画像问卷</h2><Button onClick={saveProfile} disabled={saving}><Save size={16} />保存画像</Button></div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    ["应急资金", "emergencyFund"], ["每月必要支出", "monthlyNecessaryExpense"], ["每月固定还款", "monthlyDebtPayment"], ["每月税后收入", "monthlyAfterTaxIncome"], ["其他可用资金", "otherAvailableFunds"], ["最大可承受损失金额", "maxLossAmount"], ["最大可承受损失比例", "maxLossRatio"], ["中途用款概率", "interimFundingProbability"], ["投资年限", "investmentYears"], ["恢复等待期限", "recoveryWaitMonths"]
                  ].map(([label, key]) => <Field key={key} label={label}><Input type="number" value={profile[key] ?? ""} onChange={(e) => updateProfile("profile", key, Number(e.target.value))} /></Field>)}
                  {[
                    ["收入稳定性", "incomeStability"], ["亏损后的资金需求", "postLossFundingNeed"], ["最大实际亏损经历", "maxDrawdownExperience"], ["市场周期经历", "marketCycleExperience"], ["自主决策程度", "selfDecisionLevel"], ["主要陪伴类型", "companionType"], ["主动触达偏好", "proactiveContactPreference"], ["期限可延后程度", "delayTolerance"]
                  ].map(([label, key]) => <Field key={key} label={label}><Input value={profile[key] ?? ""} onChange={(e) => updateProfile("profile", key, e.target.value)} /></Field>)}
                  {["earliestUseDate", "goalUseDate"].map((key) => <Field key={key} label={key === "earliestUseDate" ? "最早可能使用日期" : "目标使用日期"}><Input type="date" value={String(profile[key] ?? "").slice(0, 10)} onChange={(e) => updateProfile("profile", key, e.target.value)} /></Field>)}
                </div>
              </Card>
              <Card>
                <h2 className="mb-4 font-semibold">目标信息</h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    ["目标类型", "goalType", "text"], ["目标金额", "targetAmount", "number"], ["目标期限（月）", "targetMonths", "number"], ["当前已准备金额", "currentPreparedAmount", "number"], ["每月可投入金额", "monthlyInvestment", "number"], ["一次性追加金额", "oneTimeAdditional", "number"], ["可延期评分", "postponeScore", "number"], ["金额调整评分", "amountAdjustScore", "number"], ["替代方案评分", "fallbackScore", "number"], ["后果影响评分", "consequenceScore", "number"]
                  ].map(([label, key, type]) => <Field key={key} label={label}><Input type={type} value={goal[key] ?? ""} onChange={(e) => updateProfile("goal", key, type === "number" ? Number(e.target.value) : e.target.value)} /></Field>)}
                </div>
              </Card>
              <DerivedPanel derived={derived} />
            </div>
          )}
          {tab === "products" && (pendingTrade ? <TradeConfirmPage trade={pendingTrade} onBack={() => setPendingTrade(null)} onConfirm={confirmPendingTrade} /> : <Products products={products} setProducts={setProducts} onTrade={startTrade} tradeDone={tradeDone} />)}
          {tab === "chat" && (
            <div className="grid grid-cols-[320px_1fr] gap-5">
              <Card><h2 className="mb-3 font-semibold">当前画像摘要</h2><Summary derived={derived} /></Card>
              <div className="space-y-4">
                <Card>
                  <Field label="产品选择器"><select className="h-9 w-full rounded-md border px-3 text-sm" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                  <div className="mt-4 flex flex-wrap gap-2">{demoMessages.map((msg) => <Button key={msg} variant="outline" onClick={() => setInput(msg)}>{msg.slice(0, 14)}</Button>)}</div>
                  <div className="mt-4 space-y-2"><Textarea value={input} onChange={(e) => setInput(e.target.value)} /><Button onClick={submitChat}><Send size={16} />发送</Button></div>
                </Card>
                {chatResult && <ChatResult result={chatResult} clarifyAnswer={clarifyAnswer} setClarifyAnswer={setClarifyAnswer} submitClarify={submitClarify} />}
              </div>
            </div>
          )}
          {tab === "logs" && <Logs logs={logs} loadLogs={loadLogs} />}
        </section>
      </div>
      {tradeCheck && <TradeConflictDialog result={tradeCheck} onClose={closeTradeDialog} onOpenChat={() => setFloatingChatOpen(true)} onAction={handleTradePromptAction} />}
      <FloatingAssistant
        open={floatingChatOpen}
        setOpen={setFloatingChatOpen}
        userId={data.user.id}
        products={products}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        pendingQuestion={tradeCheck?.clarification?.question ?? null}
      />
    </main>
  );
}

function Dashboard({ data, setTab }: { data: any; setTab: (tab: Tab) => void }) {
  const d = data.derived;
  const cards = [
    ["用户", data.user.name], ["当前目标", d.goalType], ["当前资金", money(d.currentPreparedAmount)], ["风险缓冲能力", d.riskBufferAbility], ["有效投资期限", `${d.effectiveInvestmentMonths} 个月`], ["有效最大损失比例", pct(d.effectiveMaxLossRatio)]
  ];
  return <div className="space-y-5"><div className="grid grid-cols-3 gap-4">{cards.map(([k, v]) => <Card key={k}><p className="text-xs text-slate-500">{k}</p><p className="mt-2 text-xl font-semibold">{v}</p></Card>)}</div><Card><h2 className="mb-3 font-semibold">运行状态</h2><div className="grid grid-cols-3 gap-4 text-sm"><p>最近识别：{data.lastRecognition?.intent ?? "暂无"} / {data.lastRecognition?.emotion ?? "暂无"}</p><p>未完成冲突：{data.openConflict?.overallConflictLevel ?? "暂无"}</p><p>最近 AI：{data.lastAi?.success ? "成功" : "暂无"}</p></div></Card><div className="flex gap-2">{(["profile", "chat", "products", "logs"] as Tab[]).map((t) => <Button key={t} variant="outline" onClick={() => setTab(t)}>{t}</Button>)}</div></div>;
}

function Summary({ derived }: { derived: any }) {
  return <div className="space-y-2 text-sm text-slate-700">{[["目标优先级", derived.goalPriority], ["资金缺口率", pct(derived.fundingGapRatio)], ["目标完成率", pct(derived.goalCompletionRate)], ["经验等级", derived.investmentExperienceLevel], ["应急覆盖", `${derived.emergencyCoverageMonths?.toFixed?.(1) ?? 0} 月`]].map(([k, v]) => <div key={k} className="flex justify-between border-b py-2"><span>{k}</span><b>{v}</b></div>)}</div>;
}

function DerivedPanel({ derived }: { derived: any }) {
  return <Card><h2 className="mb-4 font-semibold">自动计算字段</h2><div className="grid grid-cols-4 gap-3 text-sm">{[["负债偿付率", pct(derived.debtServiceRatio)], ["应急资金覆盖月数", derived.emergencyCoverageMonths?.toFixed?.(1)], ["风险缓冲能力", derived.riskBufferAbility], ["当前资金缺口", money(derived.fundingGap)], ["资金缺口率", pct(derived.fundingGapRatio)], ["目标完成率", pct(derived.goalCompletionRate)], ["目标可实现度", derived.goalFeasibility], ["有效投资期限", `${derived.effectiveInvestmentMonths} 月`], ["有效最大损失金额", money(derived.effectiveMaxLossAmount)], ["有效最大损失比例", pct(derived.effectiveMaxLossRatio)], ["经验广度", derived.experienceBreadth], ["投资经验等级", derived.investmentExperienceLevel], ["目标优先级", derived.goalPriority]].map(([k, v]) => <div key={k} className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><p className="font-semibold">{v}</p></div>)}</div></Card>;
}

function ChatResult({ result, clarifyAnswer, setClarifyAnswer, submitClarify }: any) {
  const top = result.conflicts.topConflict;
  const levelClass = result.conflicts.overallConflictLevel === "high" ? "border-rose-300 bg-rose-50" : result.conflicts.overallConflictLevel === "medium" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white";
  return <div className="space-y-4"><Card><h2 className="mb-2 font-semibold">AI 回答</h2><p className="text-sm leading-6">{result.answer.content}</p></Card><Card><h2 className="mb-2 font-semibold">模型识别结果调试面板</h2><pre className="max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify({ recognition: result.recognition, routing: result.routing, conflicts: result.conflicts }, null, 2)}</pre></Card>{top && <Card className={levelClass}><div className="flex items-start gap-3"><AlertTriangle className="mt-1" size={20} /><div><h2 className="font-semibold">检测到{top.conflictType}</h2><p className="mt-2 text-sm">你当前的{labelFields(top.relatedUserFields, "画像信息")}与{labelFields(top.relatedProductFields, "行为")}存在不一致，可能影响资金安排。</p><p className="mt-2 text-sm">{top.reasons.join("；")}</p><div className="mt-3 flex gap-2"><Button variant="outline">撤回操作</Button><Button>继续操作</Button></div></div></div></Card>}{result.clarification && <Card className="border-rose-300"><h2 className="font-semibold">确认问题</h2><p className="mt-2 text-sm">{result.clarification.question}</p><Textarea className="mt-3" value={clarifyAnswer} onChange={(e) => setClarifyAnswer(e.target.value)} /><Button className="mt-2" onClick={submitClarify}>提交并更新画像</Button>{result.clarificationUpdate && <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(result.clarificationUpdate, null, 2)}</pre>}</Card>}</div>;
}

function Products({ products, setProducts, onTrade, tradeDone }: { products: any[]; setProducts: (p: any[]) => void; onTrade: (productId: string, operationType: "买入" | "卖出") => void; tradeDone: string | null }) {
  void setProducts;
  return <div className="space-y-4"><Card><h2 className="font-semibold">产品与交易</h2><p className="text-sm text-slate-500">To C 交易入口：买入/卖出会同步进行冲突判断并展示提醒，但提醒不阻断交易继续。</p>{tradeDone && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{tradeDone}</p>}</Card><div className="grid grid-cols-2 gap-4">{products.map((p) => <Card key={p.id}><h3 className="font-semibold">{p.name}</h3><p className="mt-1 text-sm text-slate-600">{p.description}</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>类型：{p.productType}</span><span>回撤：{pct(p.historicalMaxDrawdown)}</span><span>封闭：{p.hasLockup ? `${p.lockupDays} 天` : "无"}</span><span>到账：T+{p.redeemArrivalDays}</span><span>风险：{p.riskLevel}</span></div><div className="mt-4 flex gap-2"><Button onClick={() => onTrade(p.id, "买入")}>买入</Button><Button variant="outline" onClick={() => onTrade(p.id, "卖出")}>卖出</Button></div></Card>)}</div></div>;
}

function TradeConfirmPage({ trade, onBack, onConfirm }: { trade: any; onBack: () => void; onConfirm: () => void }) {
  const top = trade.conflicts?.topConflict;
  const level = trade.conflicts?.overallConflictLevel ?? "none";
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-medium text-slate-500">交易确认页</p>
        <h2 className="mt-1 text-xl font-semibold">确认{trade.operationType} {trade.product?.name}</h2>
        <p className="mt-2 text-sm text-slate-600">冲突提示不会阻断交易。请核对以下信息后继续提交。</p>
      </Card>
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <Card>
          <h3 className="font-semibold">交易信息</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">交易方向</p><p className="font-semibold">{trade.operationType}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">交易金额</p><p className="font-semibold">{money(trade.amount)}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">产品类型</p><p className="font-semibold">{trade.product?.productType}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">风险等级</p><p className="font-semibold">{trade.product?.riskLevel}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">历史最大回撤</p><p className="font-semibold">{pct(trade.product?.historicalMaxDrawdown)}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">赎回到账</p><p className="font-semibold">T+{trade.product?.redeemArrivalDays}</p></div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>返回修改</Button>
            <Button onClick={onConfirm}>确认提交</Button>
          </div>
        </Card>
        <Card className={level === "high" ? "border-rose-300 bg-rose-50" : level === "medium" ? "border-amber-300 bg-amber-50" : "bg-white"}>
          <h3 className="font-semibold">同步风险提示</h3>
          <p className="mt-2 text-sm text-slate-700">当前冲突等级：{level}</p>
          {top ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="font-medium">{top.conflictType}</p>
              <p>{top.reasons?.join("；")}</p>
            </div>
          ) : <p className="mt-3 text-sm text-slate-600">暂无需要特别提示的冲突。</p>}
        </Card>
      </div>
    </div>
  );
}

function TradeConflictDialog({ result, onClose, onOpenChat, onAction }: { result: any; onClose: () => void; onOpenChat: () => void; onAction: (action: "撤回操作" | "继续操作") => void }) {
  const top = result.conflicts.topConflict;
  const level = result.conflicts.overallConflictLevel;
  const title = top ? `检测到${top.conflictType}` : "交易前冲突提示";
  const hasQuestion = Boolean(result.clarification?.question);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 w-[min(92vw,520px)]">
      <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className={level === "high" ? "text-rose-700" : "text-amber-700"} size={24} />
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500">交易提示，不阻断操作</p>
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              本次交易流程已继续推进；以下内容仅用于风险提醒和审计留痕。
            </p>
            <p className="text-sm leading-6 text-slate-700">
              你当前的{labelFields(top?.relatedUserFields, "画像信息")}与{labelFields(top?.relatedProductFields, "本次交易行为")}存在不一致，可能影响资金安排。
            </p>
            {top?.reasons?.length ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{top.reasons.join("；")}</p> : null}
            {hasQuestion ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs font-medium text-rose-900">确认问题</p>
                <p className="mt-1 text-sm text-rose-950">{result.clarification.question}</p>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              {hasQuestion ? (
                <>
                  <Button variant="outline" onClick={() => onAction("撤回操作")}>撤回操作</Button>
                  <Button onClick={onOpenChat}><MessageSquare size={16} />打开对话回答</Button>
                  <Button variant="outline" onClick={onClose}>关闭提示</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onAction("撤回操作")}>撤回操作</Button>
                  <Button onClick={() => onAction("继续操作")}>继续操作</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingAssistant({
  open,
  setOpen,
  userId,
  products,
  selectedProduct,
  setSelectedProduct,
  pendingQuestion
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  userId: string;
  products: any[];
  selectedProduct: string;
  setSelectedProduct: (id: string) => void;
  pendingQuestion: string | null;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "你可以在这里回答风险确认问题，也可以直接问我任何投资相关问题。这个对话不会阻断交易。" }
  ]);
  const [askText, setAskText] = useState("");
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);
  const [clarifyText, setClarifyText] = useState("我其实最多只能接受亏损 5%。");
  const [loading, setLoading] = useState(false);
  const [answeredTradeQuestion, setAnsweredTradeQuestion] = useState<string | null>(null);
  const activePendingQuestion = pendingQuestion && answeredTradeQuestion !== pendingQuestion ? pendingQuestion : null;

  useEffect(() => {
    if (pendingQuestion && pendingQuestion !== answeredTradeQuestion) setPendingAnswer("");
  }, [pendingQuestion, answeredTradeQuestion]);

  const sendText = async (nextText = askText) => {
    const content = nextText.trim();
    if (!content) return;
    setLoading(true);
    setMessages((old) => [...old, { role: "user", content }]);
    setAskText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ userId, conversationId: "demo-conversation", productId: selectedProduct, text: content })
      });
      if (!res.ok) throw new Error("CHAT_REQUEST_FAILED");
      const json = await res.json();
      setLastResult(json);
      setMessages((old) => [...old, { role: "assistant", content: json.answer?.content ?? "我已经记录并处理了你的问题。" }]);
    } catch {
      setMessages((old) => [...old, { role: "assistant", content: "这次问题没有发送成功，请稍后再试。" }]);
    } finally {
      setLoading(false);
    }
  };

  const answerPendingQuestion = async () => {
    if (!activePendingQuestion || !pendingAnswer.trim()) return;
    await sendText(`针对刚才的确认问题：${activePendingQuestion}\n我的回答：${pendingAnswer.trim()}`);
    setAnsweredTradeQuestion(activePendingQuestion);
    setPendingAnswer("");
  };

  const submitClarification = async () => {
    if (!lastResult?.clarification || !clarifyText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/clarification", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          userId,
          conversationId: lastResult.conversationId,
          conflictPairId: lastResult.conflicts.conflictPairId,
          productId: selectedProduct,
          answer: clarifyText
        })
      });
      if (!res.ok) throw new Error("CLARIFICATION_REQUEST_FAILED");
      const update = await res.json();
      setMessages((old) => [...old, { role: "user", content: clarifyText }, { role: "assistant", content: update.updated ? "已根据你的回答校验并更新画像，同时重新计算了冲突。" : "你的回答已记录，但暂未满足自动更新画像的条件。" }]);
      setLastResult({ ...lastResult, clarification: null, clarificationUpdate: update });
    } catch {
      setMessages((old) => [...old, { role: "assistant", content: "这次回答没有提交成功，请稍后再试。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          className="fixed bottom-5 left-5 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
          onClick={() => setOpen(true)}
        >
          <Bot size={18} /> 对话
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 left-5 z-50 flex h-[min(78vh,640px)] w-[min(92vw,420px)] flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-semibold">AI 顾投对话</h2>
              <p className="text-xs text-slate-500">可回答追问，也可主动提问</p>
            </div>
            <Button variant="ghost" onClick={() => setOpen(false)}><X size={16} /></Button>
          </div>
          <div className="border-b px-4 py-3">
            <Label>关联产品</Label>
            <select className="mt-1 h-9 w-full rounded-md border px-3 text-sm" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-3 overflow-auto bg-slate-50 px-4 py-3">
            {activePendingQuestion && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
                <p className="text-xs font-medium text-rose-900">当前追问</p>
                <p className="mt-1 text-rose-950">{activePendingQuestion}</p>
                <Textarea className="mt-2 bg-white" value={pendingAnswer} onChange={(e) => setPendingAnswer(e.target.value)} placeholder="在这里输入你对这个问题的回答" />
                <Button className="mt-2" onClick={answerPendingQuestion} disabled={loading || !pendingAnswer.trim()}>提交回答</Button>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-8 rounded-md bg-slate-900 p-3 text-sm text-white" : "mr-8 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm"}>
                {message.content}
              </div>
            ))}
            {lastResult?.clarification && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-950">AI 需要你确认</p>
                <p className="mt-1 text-amber-950">{lastResult.clarification.question}</p>
                <Textarea className="mt-2 bg-white" value={clarifyText} onChange={(e) => setClarifyText(e.target.value)} />
                <Button className="mt-2" onClick={submitClarification} disabled={loading}>提交回答</Button>
              </div>
            )}
          </div>
          <div className="border-t bg-white p-3">
            <Label>问 AI 一个问题</Label>
            <Textarea className="mt-1" value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="在这里输入你想问 AI 的问题" />
            <div className="mt-2 flex justify-end gap-2">
              <Button onClick={() => sendText()} disabled={loading || !askText.trim()}><Send size={16} />发送问题</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Logs({ logs, loadLogs }: { logs: any; loadLogs: () => void }) {
  const entries = useMemo(() => logs ? Object.entries(logs).flatMap(([type, rows]: any) => rows.map((row: any) => ({ type, ...row }))) : [], [logs]);
  return <Card><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">日志审计</h2><div className="flex gap-2"><Button variant="outline" onClick={loadLogs}><Database size={16} />刷新</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(JSON.stringify(logs, null, 2))}><Download size={16} />导出 JSON</Button></div></div><div className="space-y-2">{entries.map((row: any) => <details key={`${row.type}-${row.id}`} className="rounded border bg-white p-3 text-sm"><summary className="cursor-pointer">{row.type} / {row.createdAt} / {row.success ? "成功" : row.errorCode}</summary><pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(row, null, 2)}</pre></details>)}</div></Card>;
}

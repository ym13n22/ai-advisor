import type { LlmProvider } from "./provider";
import type { AnswerInput, AnswerOutput, ClarificationInput, ClarificationOutput, ProfileUpdateInput, ProfileUpdateOutput, RecognitionInput, RecognitionOutput } from "./schemas";

export class MockLlmProvider implements LlmProvider {
  async recognizeState(input: RecognitionInput): Promise<RecognitionOutput> {
    const text = input.text;
    if (/全部卖掉|清仓|受不了了/.test(text)) return { intent: "卖出", emotion: "恐慌", executionStage: "即将执行", confidence: 0.94, evidence: "出现清仓/受不了等表达" };
    if (/涨得太好了|所有钱|全部投进去/.test(text)) return { intent: "买入", emotion: "兴奋", executionStage: "即将执行", confidence: 0.92, evidence: "出现追涨和全部投入表达" };
    if (/买房|封闭|可以买/.test(text)) return { intent: "买入", emotion: "焦虑", executionStage: "考虑中", confidence: 0.86, evidence: "询问买入封闭产品且涉及买房用款" };
    if (/最多只能接受亏损\s*5%|接受亏损 5%|亏损5%/.test(text)) return { intent: "调整", emotion: "平静", executionStage: "考虑中", confidence: 0.91, evidence: "明确表达风险承受变更" };
    if (/复盘/.test(text)) return { intent: "复盘", emotion: "平静", executionStage: "了解中", confidence: 0.9, evidence: "复盘诉求" };
    if (/要不要买|能买吗|可以买/.test(text)) return { intent: "买入", emotion: "平静", executionStage: "考虑中", confidence: 0.72, evidence: "询问买入可行性" };
    return { intent: "了解", emotion: "平静", executionStage: "了解中", confidence: 0.65, evidence: "未出现强交易或情绪关键词" };
  }

  async generateAnswer(input: AnswerInput): Promise<AnswerOutput> {
    if (input.responseMode === "informational_only") {
      return {
        responseMode: "informational_only",
        content: `我可以先帮你梳理 ${input.productName ?? "该产品"} 的风险、期限和流动性信息。当前存在需要进一步确认的资金安排或风险承受信息，因此先暂停给出明确操作建议。建议先回答下方确认问题，再一起看是否匹配你的目标。`
      };
    }
    return {
      responseMode: "normal",
      content: `从目标、期限、风险承受和流动性看，可以把 ${input.productName ?? "所选产品"} 放在备选项里比较。重点核对历史回撤、赎回到账时间、目标使用日期和你可接受的波动范围，避免只根据短期涨跌做决定。`
    };
  }

  async generateClarification(input: ClarificationInput): Promise<ClarificationOutput> {
    if (/损失|风险|兴奋/.test(input.conflictType)) return { question: "这笔资金如果短期出现 10% 以上回撤，你是否仍然不影响原定目标和必要支出？" };
    if (/流动性|期限|中途/.test(input.conflictType)) return { question: "这笔钱最早什么时候必须可用，能否接受产品封闭期内无法赎回？" };
    return { question: "为了继续判断，请确认这笔资金的使用时间和最多可接受亏损比例。" };
  }

  async extractProfileUpdate(input: ProfileUpdateInput): Promise<ProfileUpdateOutput> {
    const five = input.answer.match(/(?:最多|只能|接受|亏损).*?5%|5%/);
    if (five) {
      return {
        updateRequired: true,
        targetUserField: "maxLossRatio",
        currentValue: input.currentProfile.maxLossRatio,
        newValue: 0.05,
        status: "confirmed",
        confidence: 0.9,
        evidence: "用户明确表示最多只能接受亏损 5%"
      };
    }
    return { updateRequired: false, targetUserField: null, currentValue: null, newValue: null, status: "uncertain", confidence: 0.4, evidence: "未识别到可更新画像字段" };
  }
}

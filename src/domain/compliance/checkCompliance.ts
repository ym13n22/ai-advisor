export function checkCompliance(content: string) {
  const containsProhibitedTradeInstruction = /必须|一定要|立刻|马上|全仓|清仓|买入|卖出|加仓|减仓/.test(content) && /建议你|你应该|执行/.test(content);
  const containsGuaranteedReturnStatement = /保证收益|稳赚|确定上涨|必然上涨|不会亏/.test(content);
  const containsInternalLabels = /ruleCode|conflictLevel|informational_only|JSON|内部字段/.test(content);
  const passed = !containsProhibitedTradeInstruction && !containsGuaranteedReturnStatement && !containsInternalLabels;
  return { containsProhibitedTradeInstruction, containsGuaranteedReturnStatement, containsInternalLabels, passed };
}

export const safeAnswerTemplate = "我可以提供信息梳理和风险提示，但不能给出确定性的交易指令。请先核对目标期限、资金用途、可承受亏损和产品流动性，再决定是否继续。";

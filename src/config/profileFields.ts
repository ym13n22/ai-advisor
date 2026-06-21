import { z } from "zod";

export type ProfileFieldConfig = {
  key: string;
  label: string;
  fieldType: "number" | "string" | "enum" | "date" | "stringArray";
  allowedValues?: string[];
  constraints?: Record<string, unknown>;
  updatable: boolean;
  schema: z.ZodTypeAny;
};

export const profileFields: ProfileFieldConfig[] = [
  { key: "maxLossRatio", label: "最大可承受损失比例", fieldType: "number", constraints: { min: 0, max: 1 }, updatable: true, schema: z.number().min(0).max(1) },
  { key: "maxLossAmount", label: "最大可承受损失金额", fieldType: "number", constraints: { min: 0 }, updatable: true, schema: z.number().min(0) },
  { key: "earliestUseDate", label: "最早可能使用日期", fieldType: "date", updatable: true, schema: z.coerce.date() },
  { key: "interimFundingProbability", label: "中途用款概率", fieldType: "number", constraints: { min: 0, max: 100 }, updatable: true, schema: z.number().min(0).max(100) },
  { key: "recoveryWaitMonths", label: "恢复等待期限", fieldType: "number", constraints: { min: 0 }, updatable: true, schema: z.number().min(0) },
  { key: "postLossFundingNeed", label: "亏损后的资金需求", fieldType: "enum", allowedValues: ["立即使用", "短期使用", "中期使用", "无明确需求"], updatable: true, schema: z.enum(["立即使用", "短期使用", "中期使用", "无明确需求"]) },
  { key: "incomeStability", label: "收入稳定性", fieldType: "enum", allowedValues: ["稳定", "一般", "不稳定"], updatable: true, schema: z.enum(["稳定", "一般", "不稳定"]) },
  { key: "riskBufferAbility", label: "风险缓冲能力", fieldType: "enum", allowedValues: ["弱", "中", "强"], updatable: false, schema: z.enum(["弱", "中", "强"]) }
];

export const profileFieldMap = Object.fromEntries(profileFields.map((field) => [field.key, field]));

import { z } from "zod";

export const recognitionOutputSchema = z.object({
  intent: z.enum(["了解", "买入", "卖出", "调整", "复盘", "unknown"]),
  emotion: z.enum(["平静", "恐慌", "兴奋", "焦虑", "unknown"]),
  executionStage: z.enum(["了解中", "考虑中", "即将执行", "已执行", "unknown"]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().nullable()
});

export const answerOutputSchema = z.object({
  responseMode: z.enum(["normal", "informational_only"]),
  content: z.string()
});

export const clarificationOutputSchema = z.object({
  question: z.string()
});

export const profileUpdateOutputSchema = z.object({
  updateRequired: z.boolean(),
  targetUserField: z.string().nullable(),
  currentValue: z.unknown(),
  newValue: z.unknown(),
  status: z.enum(["confirmed", "uncertain", "rejected"]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().nullable()
});

export type RecognitionOutput = z.infer<typeof recognitionOutputSchema>;
export type AnswerOutput = z.infer<typeof answerOutputSchema>;
export type ClarificationOutput = z.infer<typeof clarificationOutputSchema>;
export type ProfileUpdateOutput = z.infer<typeof profileUpdateOutputSchema>;

export type RecognitionInput = { text: string };
export type AnswerInput = { text: string; responseMode: "normal" | "informational_only"; conflictSummary: string | null; productName: string | null };
export type ClarificationInput = { conflictType: string; reasons: string[] };
export type ProfileUpdateInput = { answer: string; currentProfile: Record<string, unknown> };

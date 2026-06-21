import type { ConflictLevel, ConflictResult } from "../types";

export function result(ruleCode: string, conflictType: string, conflictLevel: ConflictLevel, reasons: string[], relatedUserFields: string[], relatedProductFields: string[], evidence: Record<string, unknown>): ConflictResult {
  return { ruleCode, conflictType, conflictLevel, reasons, relatedUserFields, relatedProductFields, evidence };
}

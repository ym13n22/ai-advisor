import type { AnswerInput, AnswerOutput, ClarificationInput, ClarificationOutput, ProfileUpdateInput, ProfileUpdateOutput, RecognitionInput, RecognitionOutput } from "./schemas";
import { MockLlmProvider } from "./mockProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";

export interface LlmProvider {
  recognizeState(input: RecognitionInput): Promise<RecognitionOutput>;
  generateAnswer(input: AnswerInput): Promise<AnswerOutput>;
  generateClarification(input: ClarificationInput): Promise<ClarificationOutput>;
  extractProfileUpdate(input: ProfileUpdateInput): Promise<ProfileUpdateOutput>;
}

export function getLlmProvider(): LlmProvider {
  if (process.env.LLM_MODE === "openai") return new OpenAICompatibleProvider();
  return new MockLlmProvider();
}

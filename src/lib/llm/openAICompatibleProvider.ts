import type { LlmProvider } from "./provider";
import { answerOutputSchema, clarificationOutputSchema, profileUpdateOutputSchema, recognitionOutputSchema, type AnswerInput, type AnswerOutput, type ClarificationInput, type ClarificationOutput, type ProfileUpdateInput, type ProfileUpdateOutput, type RecognitionInput, type RecognitionOutput } from "./schemas";
import { MockLlmProvider } from "./mockProvider";

export class OpenAICompatibleProvider implements LlmProvider {
  private fallback = new MockLlmProvider();

  private async jsonCall<T>(messages: unknown[], schema: { parse: (value: unknown) => T }, fallback: T): Promise<T> {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
    const model = process.env.OPENAI_COMPATIBLE_MODEL ?? "gpt-4.1-mini";
    if (!baseUrl || !apiKey) return fallback;
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" }, messages }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return schema.parse(JSON.parse(content));
    } catch {
      return fallback;
    }
  }

  async recognizeState(input: RecognitionInput): Promise<RecognitionOutput> {
    const fb = await this.fallback.recognizeState(input);
    return this.jsonCall([{ role: "system", content: "识别投资意图、情绪、执行阶段，只输出 JSON。" }, { role: "user", content: input.text }], recognitionOutputSchema, fb);
  }
  async generateAnswer(input: AnswerInput): Promise<AnswerOutput> {
    const fb = await this.fallback.generateAnswer(input);
    return this.jsonCall([{ role: "system", content: "生成合规投资陪伴回答，只输出 JSON。" }, { role: "user", content: JSON.stringify(input) }], answerOutputSchema, fb);
  }
  async generateClarification(input: ClarificationInput): Promise<ClarificationOutput> {
    const fb = await this.fallback.generateClarification(input);
    return this.jsonCall([{ role: "system", content: "生成一个关键澄清问题，只输出 JSON。" }, { role: "user", content: JSON.stringify(input) }], clarificationOutputSchema, fb);
  }
  async extractProfileUpdate(input: ProfileUpdateInput): Promise<ProfileUpdateOutput> {
    const fb = await this.fallback.extractProfileUpdate(input);
    return this.jsonCall([{ role: "system", content: "从用户回答抽取画像更新建议，只输出 JSON。" }, { role: "user", content: JSON.stringify(input) }], profileUpdateOutputSchema, fb);
  }
}

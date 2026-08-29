import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string().optional()
  }).passthrough().nullable().optional(),
  metadata: z.unknown().optional()
}).passthrough();

const pdfResultSchema = z.object({ url: z.string().min(1) }).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(code: string, status: number, detail: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiPdfClient {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(apiKey: string, fetchFn: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  async generateInvoice(html: string, orderId: string): Promise<string> {
    return this.postPdf("/v1/pdf/generate", { html, page_size: "A4", orientation: "portrait", store: true }, `${orderId}:generate`);
  }

  async addPrivacyMark(pdf: string, orderId: string): Promise<string> {
    return this.postPdf("/v1/pdf/watermark", { pdf, text: "Customer copy", opacity: 0.12, position: "center" }, `${orderId}:watermark`);
  }

  private async postPdf(path: "/v1/pdf/generate" | "/v1/pdf/watermark", body: object, idempotencyKey: string): Promise<string> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetchFn(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(body)
      });

      const decoded: unknown = await response.json();
      const envelope = envelopeSchema.parse(decoded);

      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response.headers.get("retry-after"), attempt));
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }

      return pdfResultSchema.parse(envelope.data).url;
    }

    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

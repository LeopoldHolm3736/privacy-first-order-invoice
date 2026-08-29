import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiPdfClient } from "./infrai_pdf.js";
import { checkoutOrderSchema } from "./order_contract.js";
import { processCheckout } from "./receipt_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const pdf = new InfraiPdfClient(apiKey);
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const body = await readJson(request);
    let order;
    try {
      order = checkoutOrderSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        send(response, 400, { error: "Invalid checkout body", issues: error.issues });
        return;
      }
      throw error;
    }
    const update = await processCheckout(order, pdf);
    send(response, 200, update);
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, detail: error.detail });
      return;
    }
    send(response, 500, { error: "Request could not be completed" });
  }
}).listen(port, () => {
  console.log(`Order update service listening on http://localhost:${port}`);
});

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void }, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

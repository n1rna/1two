/**
 * Cloudflare Email Worker — handles both inbound and outbound emails.
 *
 * Inbound: receives emails at life@1tt.dev → forwards to API → sends reply
 * Outbound: POST /send endpoint for the API to trigger emails (verification codes, etc.)
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

export interface Env {
  API_URL: string;
  EMAIL_WEBHOOK_SECRET: string;
  SEB: SendEmail;
}

interface SendEmail {
  send(message: EmailMessage): Promise<void>;
}

interface ApiResponse {
  processed?: boolean;
  ignored?: boolean;
  reply?: string;
  subject?: string;
  error?: string;
}

export default {
  // ── Inbound email handler ─────────────────────────────────────────────
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get("subject") ?? "";

    if (!to.toLowerCase().includes("life@")) {
      message.setReject("Unknown recipient");
      return;
    }

    const rawEmail = await readStream(message.raw);
    let body = extractPlainText(rawEmail);
    if (!body) body = "(no text content)";

    try {
      const resp = await fetch(env.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.EMAIL_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({ from, subject, body }),
      });

      if (!resp.ok) {
        console.error(`API error: ${resp.status} ${await resp.text()}`);
        return;
      }

      const data = (await resp.json()) as ApiResponse;
      if (data.reply) {
        await sendEmail(env, from, subject ? `Re: ${subject}` : "Life Tool — Response", data.reply);
      }
    } catch (err) {
      console.error("Failed to process email:", err);
    }
  },

  // ── HTTP handler for outbound emails from the API ─────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Authenticate
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${env.EMAIL_WEBHOOK_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = (await request.json()) as {
        to: string;
        subject: string;
        text: string;
      };

      if (!body.to || !body.subject || !body.text) {
        return Response.json({ error: "to, subject, and text are required" }, { status: 400 });
      }

      await sendEmail(env, body.to, body.subject, body.text);
      return Response.json({ sent: true });
    } catch (err) {
      console.error("Failed to send email:", err);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
};

// ── Shared email sending ────────────────────────────────────────────────

async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<void> {
  const msg = createMimeMessage();
  msg.setSender({ name: "1tt Life", addr: "life@1tt.dev" });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/plain", data: text });

  const emailMessage = new EmailMessage("life@1tt.dev", to, msg.asRaw());
  await env.SEB.send(emailMessage);
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (value) chunks.push(value);
    if (done) break;
  }
  reader.releaseLock();
  const merged = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function extractPlainText(raw: string): string {
  const boundaryMatch = raw.match(/boundary="?([^\s"]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split("--" + boundary);
    for (const part of parts) {
      if (part.toLowerCase().includes("content-type: text/plain")) {
        const headerEnd = part.indexOf("\r\n\r\n");
        const altEnd = part.indexOf("\n\n");
        const end = headerEnd > 0 ? headerEnd + 4 : altEnd > 0 ? altEnd + 2 : -1;
        if (end > 0) return part.slice(end).trim();
      }
    }
  }
  const headerEnd = raw.indexOf("\r\n\r\n");
  const altEnd = raw.indexOf("\n\n");
  const end = headerEnd > 0 ? headerEnd + 4 : altEnd > 0 ? altEnd + 2 : -1;
  if (end > 0) {
    let body = raw.slice(end);
    body = body.replace(/<[^>]*>/g, "");
    return body.trim().slice(0, 5000);
  }
  return "";
}

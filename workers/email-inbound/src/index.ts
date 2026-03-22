/**
 * Cloudflare Email Worker — receives emails at life@1tt.dev, forwards them
 * to the 1tt API for processing, and sends the agent's reply back via email.
 *
 * Setup:
 * 1. Configure Email Routing in Cloudflare dashboard for 1tt.dev
 * 2. Route life@1tt.dev → this worker
 * 3. Set EMAIL_WEBHOOK_SECRET via `wrangler secret put EMAIL_WEBHOOK_SECRET`
 * 4. The send_email binding allows replying from life@1tt.dev
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
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get("subject") ?? "";

    // Only process emails to life@1tt.dev
    if (!to.toLowerCase().includes("life@")) {
      message.setReject("Unknown recipient");
      return;
    }

    // Read the raw email body
    const rawEmail = await readStream(message.raw);

    // Extract plain text body
    let body = extractPlainText(rawEmail);
    if (!body) {
      body = "(no text content)";
    }

    // Forward to API
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
        const text = await resp.text();
        console.error(`API error: ${resp.status} ${text}`);
        return;
      }

      const data = (await resp.json()) as ApiResponse;

      // If the API returned a reply, send it back as an email
      if (data.reply) {
        await sendReply(env, from, subject, data.reply);
      }
    } catch (err) {
      console.error("Failed to process email:", err);
    }
  },
};

async function sendReply(
  env: Env,
  to: string,
  originalSubject: string,
  replyText: string
): Promise<void> {
  const replySubject = originalSubject
    ? `Re: ${originalSubject}`
    : "Life Tool — Response";

  const msg = createMimeMessage();
  msg.setSender({ name: "1tt Life", addr: "life@1tt.dev" });
  msg.setRecipient(to);
  msg.setSubject(replySubject);
  msg.addMessage({
    contentType: "text/plain",
    data: replyText,
  });

  const emailMessage = new EmailMessage("life@1tt.dev", to, msg.asRaw());

  try {
    await env.SEB.send(emailMessage);
  } catch (err) {
    console.error("Failed to send reply email:", err);
  }
}

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (value) chunks.push(value);
    if (done) break;
  }
  const merged = new Uint8Array(
    chunks.reduce((acc, c) => acc + c.length, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function extractPlainText(raw: string): string {
  // Try to find text/plain part in multipart email
  const boundaryMatch = raw.match(/boundary="?([^\s"]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split("--" + boundary);
    for (const part of parts) {
      if (part.toLowerCase().includes("content-type: text/plain")) {
        const headerEnd = part.indexOf("\r\n\r\n");
        const altEnd = part.indexOf("\n\n");
        const end = headerEnd > 0 ? headerEnd + 4 : altEnd > 0 ? altEnd + 2 : -1;
        if (end > 0) {
          return part.slice(end).trim();
        }
      }
    }
  }

  // Fallback: body after headers
  const headerEnd = raw.indexOf("\r\n\r\n");
  const altEnd = raw.indexOf("\n\n");
  const end = headerEnd > 0 ? headerEnd + 4 : altEnd > 0 ? altEnd + 2 : -1;
  if (end > 0) {
    let body = raw.slice(end);
    body = body.replace(/<[^>]*>/g, ""); // strip HTML
    return body.trim().slice(0, 5000);
  }

  return "";
}

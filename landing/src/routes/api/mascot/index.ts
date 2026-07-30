import { Context } from "hono";

import { getMascotComment } from "../../../services/mascot";

// Cloudflare sits in front of the Render-hosted server, so CF-Connecting-IP
// is the trustworthy client IP (x-forwarded-for is attacker-controllable).
// This is a lightweight per-IP cooldown on top of the site's existing
// general rate limiter, specifically because this route calls a paid LLM API.
const COOLDOWN_MS = 8000;
const lastRequestAt = new Map<string, number>();

function clientIp(c: Context) {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export default async function handler(c: Context) {
  const ip = clientIp(c);
  const now = Date.now();
  const last = lastRequestAt.get(ip);

  if (last && now - last < COOLDOWN_MS) {
    return c.json({ error: "Too many requests" }, 429);
  }
  lastRequestAt.set(ip, now);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const { logs, pageText, lang } = body || {};

  if (!Array.isArray(logs) || logs.length === 0) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  try {
    const result = await getMascotComment({
      logs,
      pageText: typeof pageText === "string" ? pageText : "",
      lang: typeof lang === "string" ? lang : "en",
    });

    // Everything that can fail before this point (bad body, cooldown, Kimi
    // not configured) answers with JSON `{ error }`, which is what the client
    // parses to put a real message in its toast. From here on the headers are
    // already on the wire, so a mid-stream failure can only end the body
    // early; the client treats an empty result as a failure by itself.
    return result.toTextStreamResponse({
      headers: {
        // Cloudflare fronts this server: without these it will happily cache
        // or buffer the whole body and the reply lands in one lump, which
        // defeats the point of streaming it.
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.log({ step: "mascotHandler", error });
    return c.json({ error: "Could not generate a comment" }, 500);
  }
}

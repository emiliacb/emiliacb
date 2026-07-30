import { Context } from "hono";
import { createTextStreamResponse } from "ai";

import { getMascotComment, MascotUnavailableError } from "../../../services/mascot";

// Cloudflare sits in front of the Render-hosted server, so CF-Connecting-IP
// is the trustworthy client IP (x-forwarded-for is attacker-controllable).
// This is a lightweight per-IP cooldown on top of the site's existing
// general rate limiter, specifically because this route calls a paid LLM API.
const COOLDOWN_MS = 8000;
// The cooldown is only charged for a generation that actually produced a
// reply, so on its own it would let someone whose requests all fail hammer the
// upstream. A single in-flight generation per IP closes that: the second click
// is refused while the first is still running, whatever the first one does.
// An entry older than this is a leaked one (a request whose body was never
// read to the end) rather than a live generation, so it stops counting.
const IN_FLIGHT_MAX_MS = 30000;

const lastRequestAt = new Map<string, number>();
const inFlightSince = new Map<string, number>();

// The client shows these strings verbatim in its toast, so they have to be in
// the visitor's language. `unavailable` is deliberately the same sentence
// mascot-bot.js falls back to on its own, so the toast reads identically
// whether the message came from here or from the client.
const COPY = {
  en: {
    tooManyRequests: "Give me a few seconds before asking again.",
    invalidRequest: "Something was off about that request.",
    unavailable: "Couldn't come up with anything to say, try again in a bit.",
  },
  es: {
    tooManyRequests: "Dame unos segundos antes de volver a preguntar.",
    invalidRequest: "Algo salió mal con esa solicitud.",
    unavailable: "No se me ocurrió nada que decir, probá de nuevo en un rato.",
  },
} as const;

type Lang = keyof typeof COPY;

function pickLang(value: unknown): Lang {
  const code = typeof value === "string" ? value.slice(0, 2) : "";
  return code in COPY ? (code as Lang) : "en";
}

function clientIp(c: Context) {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// Neither map was ever pruned, so both grew for the lifetime of the process.
// Every entry stops mattering once it ages past its window, so drop them.
function prune(now: number) {
  for (const [ip, at] of lastRequestAt) {
    if (now - at >= COOLDOWN_MS) lastRequestAt.delete(ip);
  }
  for (const [ip, at] of inFlightSince) {
    if (now - at >= IN_FLIGHT_MAX_MS) inFlightSince.delete(ip);
  }
}

function jsonError(c: Context, status: 400 | 429 | 500, message: string) {
  // Without this these replies inherit `public, max-age=1800,
  // stale-while-revalidate=21600` from generalCacheMiddleware.
  c.header("Cache-Control", "no-store");
  return c.json({ error: message }, status);
}

/**
 * Passes a stream through unchanged while reporting when it settles, whichever
 * way it settled: closed, errored, or cancelled because the socket went away.
 * A mid-stream error is re-raised on the outgoing stream rather than swallowed,
 * which is the whole point: the body has to terminate abnormally so the
 * client's reader rejects instead of resolving `done` on half a sentence.
 */
function whenSettled(
  stream: ReadableStream<string>,
  settled: () => void
): ReadableStream<string> {
  const reader = stream.getReader();
  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          settled();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        settled();
        controller.error(error);
      }
    },
    cancel(reason) {
      settled();
      return reader.cancel(reason);
    },
  });
}

export default async function handler(c: Context) {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, COPY.en.invalidRequest);
  }

  const { logs, pageText, lang } = body || {};
  // Parsed before the cooldown check on purpose: the 429 body is shown to the
  // visitor, so it has to be in the language they asked for.
  const copy = COPY[pickLang(lang)];

  if (!Array.isArray(logs) || logs.length === 0) {
    return jsonError(c, 400, copy.invalidRequest);
  }

  const ip = clientIp(c);
  const now = Date.now();
  prune(now);

  if (inFlightSince.has(ip)) {
    return jsonError(c, 429, copy.tooManyRequests);
  }

  const last = lastRequestAt.get(ip);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return jsonError(c, 429, copy.tooManyRequests);
  }

  inFlightSince.set(ip, now);

  try {
    const textStream = await getMascotComment({
      logs,
      pageText: typeof pageText === "string" ? pageText : "",
      lang: typeof lang === "string" ? lang : "en",
      requestSignal: c.req.raw.signal,
    });

    // The cooldown is charged here rather than at the top of the handler: a
    // generation that never produced a token cost the visitor 20 seconds of
    // thinking dots and gave them nothing, and locking them out for another 8
    // on top of that is punishing them for our failure. Reaching this line
    // means a first token is already in hand, so a real reply is on its way
    // and a real API call has been billed. It is refreshed again when the
    // stream settles, so the 8 seconds are counted from the end of the reply,
    // and a stream that breaks at second 19 still charges for the call it
    // made (that is what stops click-and-dismiss from being free).
    const touch = () => lastRequestAt.set(ip, Date.now());
    touch();

    const body = whenSettled(textStream, () => {
      inFlightSince.delete(ip);
      touch();
    });

    // Everything that can fail before this point (bad body, cooldown, Kimi not
    // configured, no first token, an upstream that errored before saying
    // anything) answers with JSON `{ error }`, which is what the client parses
    // to put a real message in its toast. From here on the headers are on the
    // wire, so a failure can only be reported by breaking the body, which is
    // what the stream from getMascotComment does.
    return createTextStreamResponse({
      textStream: body,
      headers: {
        // Cloudflare fronts this server: without these it will happily cache
        // or buffer the whole body and the reply lands in one lump, which
        // defeats the point of streaming it. x-accel-buffering is also what
        // makes @hono/node-server stream the body out chunk by chunk instead
        // of buffering it into a single Content-Length response.
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    inFlightSince.delete(ip);
    // MascotUnavailableError has already been logged in detail by the service;
    // logging it again here would double every failure line.
    if (!(error instanceof MascotUnavailableError)) {
      console.log({ step: "mascotHandler", error });
    }
    return jsonError(c, 500, copy.unavailable);
  }
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { smoothStream, streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { getSiteMap } from "./sitemap";

// The prompt and the profile it draws facts from are content, not code: they
// need to be editable (and, above all, fact-checkable against the rest of the
// site) without a deploy. `content/` is already `cp -R`'d into `dist/` by the
// build, so the same relative path resolves in dev (tsx, __dirname under
// src/services) and in prod (node, __dirname under dist/src/services).
const PROMPT_DIR = join(__dirname, "../../content/prompts");

let cachedPromptTemplate: string | null = null;
let cachedProfile: string | null = null;

// Read once and cached, not at import time and not per request. Not per
// request: this is the hot path of a route already paying for a paid API call
// and racing a 5s first-token deadline, for two files that cannot change
// between deploys anyway. Not at import time: a missing or unreadable file
// then takes the whole server down at boot instead of degrading just this one
// feature, and a bad prompt file throwing here surfaces as the same
// `MascotUnavailableError` any other failure in this function does.
function loadPromptTemplate(): string {
  if (cachedPromptTemplate === null || process.env.NODE_ENV !== "production") {
    cachedPromptTemplate = readFileSync(join(PROMPT_DIR, "mascot-comment.md"), "utf-8");
  }
  return cachedPromptTemplate;
}

function loadProfile(): string {
  if (cachedProfile === null || process.env.NODE_ENV !== "production") {
    cachedProfile = readFileSync(join(PROMPT_DIR, "emilia-profile.md"), "utf-8");
  }
  return cachedProfile;
}

// The prompt template is filled with visitor-controlled text (logged click
// labels, selected text, page content). Plain String#replace interprets
// "$&"/"$`"/"$'" in the replacement string, so a visitor-controlled value
// containing one of those sequences could corrupt the template. A replacer
// function sidesteps that entirely.
function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (match, key) => values[key] ?? match);
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
};

// Hard caps so a long-lived session (a large `logs` array) can't blow up
// prompt size or cost; only the most recent activity is relevant anyway.
const MAX_LOGS = 10;
const MAX_BLOG_CONTENT_CHARS = 3000;
// Overall ceiling on a generation that is working but slow: once tokens are
// arriving the visitor is watching words appear, so there is room to wait.
//
// ponytail: both deadlines are tuned against a fast hosted API (production);
// a local model behind KIMI_API_ENDPOINT can take 10+ seconds just to prefill
// the real prompt (measured ~13s), which the production deadlines would
// always kill before a single token arrives. Relaxed outside production
// rather than raised globally, since the 5s production deadline is doing real
// work below -- see FIRST_TOKEN_TIMEOUT_MS.
const REQUEST_TIMEOUT_MS = process.env.NODE_ENV === "production" ? 20000 : 60000;
// Deadline for the *first* token. An upstream that accepts the connection and
// then says nothing used to hold the visitor on the thinking dots for the full
// REQUEST_TIMEOUT_MS; failing at 5s instead is still early enough that no
// bytes of the reply have been sent, so the route can answer with the JSON
// `{ error }` the client turns into a real toast.
//
// This costs nothing visually: mascot-bot.js calls openBubble() (which paints
// the thinking dots) before it even calls fetch(), so the bubble is already
// open and animating while we wait for the first token. Holding the response
// back until we have one is invisible to the visitor.
//
// With the word-level pacing below in place, what this actually measures is the
// time to the first complete *word*, not to the first token: a lone token with
// no boundary after it yet is still sitting in the transform's buffer. That is
// the more honest of the two measures, because commit() in mascot-bot.js holds a
// partial word back for the same reason, so a first token that is not yet a
// whole word leaves the thinking dots exactly where they were. The headroom it
// costs is one inter-token interval, which on any model that is streaming at all
// is tens of milliseconds, so a slow-but-working model does not start tripping a
// deadline it used to clear.
const FIRST_TOKEN_TIMEOUT_MS = process.env.NODE_ENV === "production" ? 5000 : 20000;
// Thinking is disabled below, so this only has to cover the comment (up to 35
// words) plus the `[[OPTIONS]]` delimiter plus up to three short follow-up
// lines -- comfortably under 300 tokens in practice, but `finishReason:
// "length"` is treated as a failure (see isCleanFinish below), so the cap
// needs headroom rather than a tight fit: a reply that is otherwise complete
// should not lose its follow-ups, or itself, to running out of tokens.
const MAX_OUTPUT_TOKENS = 500;
// How long each word waits before the next one is released. Nothing guarantees
// the upstream sends fine-grained deltas, and streaming the transport perfectly
// is not enough on its own: measured end to end, a one-sentence reply that
// arrives as a single delta reaches the client inside one animation frame, and
// so does the same sentence split into 22 sub-word deltas sent back to back. In
// both cases every word appears at the same instant, which is the "I don't see
// the streaming" report. Re-chunking on word boundaries and pacing them here
// makes the reveal look the same whether the model sent one delta or fifty.
//
// 50ms is picked against the client's own animation constants: mascot-bot.js
// fades each word in over 300ms and transitions the bubble's width and height
// over 300ms. Releasing a word every 50ms keeps roughly six of them mid-fade at
// any moment, so the reveal reads as one wave rather than a row of separate
// blinks, and it retargets the box transition long before it can settle, so the
// bubble grows in a single motion instead of taking one visible step per word.
// It is also comfortably faster than reading speed (~250ms/word), so the visitor
// is watching text arrive rather than waiting on it: the reply is one sentence,
// so a 15-word one lands in ~0.7s and a 30-word one in ~1.5s.
const WORD_REVEAL_DELAY_MS = 50;

/**
 * A generation that failed before a single byte of the reply was written, and
 * that has already been logged here with the detail of why. The route turns it
 * into a JSON `{ error }` reply without logging a second line for it.
 */
export class MascotUnavailableError extends Error {
  readonly logged = true;

  constructor(reason: string) {
    super(reason);
    this.name = "MascotUnavailableError";
  }
}

// @types/node is pinned at 20.11 here, which predates the AbortSignal.any
// declaration, and the Dockerfile builds on node:18-alpine where the method
// only exists from 18.17 on. Feature-detect rather than assume, and fall back
// to wiring the listeners by hand so a slightly old runtime degrades instead
// of throwing on every request.
type SignalCombiner = { any?: (signals: AbortSignal[]) => AbortSignal };

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const native = (AbortSignal as unknown as SignalCombiner).any;
  if (typeof native === "function") {
    return native.call(AbortSignal, signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort((signal as { reason?: unknown }).reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort((signal as { reason?: unknown }).reason), {
      once: true,
    });
  }
  return controller.signal;
}

type MascotCommentInput = {
  logs: unknown[];
  pageText: string;
  lang: string;
  // Where this visitor first came from, kept for the whole session (see
  // activity-logger.js's `origin`). LOGS only holds the tail of the session, so
  // by the time an engaged visitor clicks, the `visited` event that carried
  // this may already have scrolled out of it -- this is how the prompt still
  // gets to say "you came from LinkedIn" three pages in.
  referrer?: string;
  // The incoming request's own signal, so a visitor who dismissed the bubble
  // (or scrolled away, which auto-closes it) hangs up on the paid API call
  // instead of leaving it running to the timeout.
  requestSignal?: AbortSignal;
};

// Sentinel for the first-token race, so a real `undefined` part can't be
// mistaken for the deadline firing.
const FIRST_TOKEN_DEADLINE = Symbol("first-token-deadline");

/**
 * Returns a text stream that has already produced its first token, or throws.
 *
 * The contract with the client is deliberately narrow: mascot-bot.js treats an
 * empty body as a failure and *any* non-empty body that ends cleanly as a
 * finished comment. So a stream that stops halfway is worse than no stream at
 * all: the visitor gets shown half a thought as if it were the whole thing,
 * and the client writes that fragment into its activity log. The only way to
 * tell it "this is not a comment" once bytes are on the wire is to make the
 * body terminate abnormally, which is what the returned stream does via
 * `controller.error()`. `textStream` (what `toTextStreamResponse()` serves)
 * cannot do that: it forwards `text-delta` parts only and drops the `error`
 * and `abort` parts entirely, so a failed run reaches the client as a clean
 * end-of-body. Hence consuming `fullStream` by hand here.
 */
export async function getMascotComment({
  logs,
  pageText,
  lang,
  referrer,
  requestSignal,
}: MascotCommentInput): Promise<ReadableStream<string>> {
  const endpoint = process.env.KIMI_API_ENDPOINT;
  const apiKey = process.env.KIMI_API_KEY;
  const modelId = process.env.KIMI_MODEL || "kimi-k2-0711-preview";

  if (!endpoint || !apiKey) {
    throw new Error("Kimi API is not configured");
  }

  const kimi = createOpenAICompatible({
    name: "kimi",
    baseURL: endpoint,
    apiKey,
    // Hybrid-thinking models (kimi-k2.5+) default to spending output
    // tokens on an internal chain-of-thought first; a one-sentence reply
    // doesn't need that, so switch to Kimi's "instant" (non-thinking) mode.
    transformRequestBody: (body) => ({ ...body, thinking: { type: "disabled" } }),
  });

  const recentLogs = logs.slice(-MAX_LOGS);
  const truncatedBlogContent = (pageText || "").slice(0, MAX_BLOG_CONTENT_CHARS);
  const siteMap = await getSiteMap(lang);

  const prompt = fillTemplate(loadPromptTemplate(), {
    logs: JSON.stringify(recentLogs),
    site_map: siteMap,
    blog_content: truncatedBlogContent,
    profile: loadProfile(),
    referrer: referrer || "unknown",
    language: LANGUAGE_NAMES[lang] || "English",
  });

  // Exactly one line per generation, whatever happened. Every failure path
  // funnels through here (rather than through onError/onFinish, which do not
  // fire at all for an abort or for a socket that dies mid-stream) so that no
  // outcome is silent and no outcome is logged twice.
  let logged = false;
  const logOnce = (fields: Record<string, unknown>) => {
    if (logged) return;
    logged = true;
    console.log({ step: "getMascotComment", modelId, ...fields });
  };

  // Our own handle on the upstream request, used to hang up when the
  // first-token deadline expires or when the client walks away.
  const hangUp = new AbortController();
  const overallTimeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const abortSignal = combineSignals(
    requestSignal
      ? [hangUp.signal, overallTimeout, requestSignal]
      : [hangUp.signal, overallTimeout]
  );

  // AbortSignal.any collapses everything into one signal, so ask the sources
  // which of them actually fired to keep the log line diagnostic.
  const abortCause = () => {
    if (requestSignal?.aborted) return "client disconnected";
    if (overallTimeout.aborted) return "overall timeout";
    if (hangUp.signal.aborted) return "hung up locally";
    return "unknown";
  };

  const result = streamText({
    model: kimi.chatModel(modelId),
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal,
    // No retries. The SDK's default is two, with a 2s/4s backoff, which cannot
    // fit inside FIRST_TOKEN_TIMEOUT_MS: a refused connection failed instantly
    // and then sat in the backoff until the deadline expired, so the visitor
    // waited the full 5s and the log said "no first token" instead of naming
    // the real error. Failing immediately surfaces the actual cause, and the
    // retry the visitor cares about is the one they make themselves by
    // clicking again, which a failed generation no longer blocks.
    maxRetries: 0,
    // Sits between the model and the fullStream loop below without changing what
    // that loop sees. Verified against the installed source and by measurement:
    // text is only ever buffered from one `text-delta` to the next, and every
    // other part type flushes the buffer before it is forwarded, so `error`,
    // `abort`, `text-end` and `finish` all come through, in order, and no text
    // can land after a `finish`. The one thing it does move is *when* a failure
    // is reported: a truncated reply now finishes typing out before the body is
    // broken, because the finish part is behind the words it has yet to release.
    experimental_transform: smoothStream({
      delayInMs: WORD_REVEAL_DELAY_MS,
      chunking: "word",
    }),
    // A no-op on purpose: the default onError writes a bare stack to
    // console.error, and every error part is already logged through logOnce
    // below. onFinish is dropped for the same reason.
    onError: () => {},
  });

  const reader = result.fullStream.getReader();

  const stopUpstream = () => {
    hangUp.abort();
    void reader.cancel().catch(() => {});
  };

  // The value handed to `controller.error()`. It never reaches the visitor (a
  // broken body carries no message), it exists purely to break the stream, and
  // @hono/node-server console.error()s it on its way out. Trimming the stack
  // keeps that to a single line instead of a page of internals, next to the
  // one structured line logOnce already wrote.
  const streamFailure = (message: string) => {
    const error = new Error(message);
    error.stack = `Error: ${message}`;
    return error;
  };

  // `finishReason: "length"` is treated as a failure. MAX_OUTPUT_TOKENS already
  // has headroom over what a comment plus its follow-ups needs, so hitting the
  // cap does not mean "a long but complete answer", it means the model was
  // still talking when we cut it off: the half-thought this whole path exists
  // to suppress. Same for every other non-"stop" reason (content filter, error,
  // tool calls we never asked for): if the model did not decide it was done,
  // the visitor should not be shown the fragment as if it had.
  const isCleanFinish = (finishReason: string) => finishReason === "stop";

  let firstChunk = "";
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const firstTokenDeadline = new Promise<typeof FIRST_TOKEN_DEADLINE>((resolve) => {
    deadlineTimer = setTimeout(() => resolve(FIRST_TOKEN_DEADLINE), FIRST_TOKEN_TIMEOUT_MS);
  });

  try {
    // Phase one: nothing is on the wire yet, so every failure here can still
    // become a JSON `{ error }` the client shows in a toast.
    for (;;) {
      const step = await Promise.race([reader.read(), firstTokenDeadline]);

      if (step === FIRST_TOKEN_DEADLINE) {
        logOnce({ error: "no first token before deadline", firstTokenTimeoutMs: FIRST_TOKEN_TIMEOUT_MS });
        stopUpstream();
        throw new MascotUnavailableError("no first token before deadline");
      }

      if (step.done) {
        logOnce({ warning: "stream ended before any text" });
        throw new MascotUnavailableError("stream ended before any text");
      }

      const part = step.value;

      if (part.type === "text-delta") {
        if (!part.text) continue;
        firstChunk = part.text;
        break;
      }

      if (part.type === "error") {
        logOnce({ error: part.error });
        stopUpstream();
        throw new MascotUnavailableError("upstream error before first token");
      }

      if (part.type === "abort") {
        logOnce({ error: "aborted before first token", cause: abortCause(), reason: part.reason });
        stopUpstream();
        throw new MascotUnavailableError("aborted before first token");
      }

      if (part.type === "finish") {
        // Finished without ever emitting text: an empty reply.
        logOnce({
          warning: "empty text from Kimi",
          finishReason: part.finishReason,
          usage: part.totalUsage,
        });
        throw new MascotUnavailableError("empty text from Kimi");
      }
    }
  } finally {
    clearTimeout(deadlineTimer);
  }

  // Phase two: the reply is real and the response is about to open. From here
  // the only honest way to report a failure is to break the body.
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(firstChunk);
    },

    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            // Every clean path returns from the "finish" case below, so
            // reaching the end of the stream here means it stopped without
            // the model ever saying it was done.
            logOnce({ error: "stream ended before the model finished" });
            controller.error(streamFailure("mascot stream ended before the model finished"));
            return;
          }

          switch (value.type) {
            case "text-delta":
              if (value.text) {
                controller.enqueue(value.text);
                return;
              }
              break;

            case "error":
              logOnce({ error: value.error });
              controller.error(streamFailure("mascot generation failed mid-stream"));
              return;

            case "abort":
              logOnce({ error: "aborted mid-stream", cause: abortCause(), reason: value.reason });
              controller.error(streamFailure("mascot generation aborted mid-stream"));
              return;

            case "finish":
              if (!isCleanFinish(value.finishReason)) {
                logOnce({
                  error: "generation did not finish normally",
                  finishReason: value.finishReason,
                  usage: value.totalUsage,
                });
                controller.error(streamFailure("mascot generation did not finish normally"));
                return;
              }
              logOnce({ finishReason: value.finishReason, usage: value.totalUsage });
              controller.close();
              return;

            default:
              break;
          }
        }
      } catch (error) {
        logOnce({ error });
        controller.error(error);
      }
    },

    // @hono/node-server cancels the response stream as soon as the socket
    // closes, and measurement says that, not c.req.raw.signal, is what actually
    // fires when a visitor dismisses the bubble: node-server 1.12.0 only aborts
    // the request signal when the *request* errored (`incoming.errored`), so a
    // plain client-side abort leaves it un-aborted. Hanging up from here is what
    // stops the paid call from running on to the timeout with nobody listening.
    cancel(reason) {
      logOnce({ error: "client went away mid-stream", reason });
      stopUpstream();
    },
  });
}

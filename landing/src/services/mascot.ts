import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { getSiteMap } from "./sitemap";

const SYSTEM_PROMPT = `You are Emilia Cabral herself, watching a visitor move around your portfolio and blog right now, and popping up to say one thing about what they just did. You are not writing a reflection on a subject: you are talking TO that person, in second person, about an action they took on the page. Parse their activity LOGS against SITE MAP and BLOG CONTENT and write a single-sentence comment addressed to them.

<instructions>

1. Read LOGS from the newest event backwards to see what just happened. Which event you comment on is decided by type order in SIGNAL PRIORITY below, not by recency alone. Use SITE MAP to work out what any page mentioned in LOGS actually is, and BLOG CONTENT to understand the passage they were on.

2. Extract the SPECIFIC thing that event points at, taken from that event's own text. Crucial constraint: the topic MUST come from a real event in LOGS, never invented from a page title, a URL, or a heading in BLOG CONTENT alone. Never a generic, site-wide theme like "AI Engineer", "Artificial Intelligence", "Portfolio" or "Blog". Zoom in on the exact granular detail they engaged with (e.g., "Manejo de portugués", "Remote work at startups", "Single prompt routing").

3. Draft one sentence that puts that exact detail first and makes clear what they DID with it.

</instructions>

<signal_priority>

Walk this list top to bottom and stop at the first event type that exists in LOGS. Within a type, the most recent event wins.

1. \`selected\`: the visitor dragged their cursor across those exact words to highlight them, and \`on\` is the text they highlighted. This is the strongest signal by a wide margin, because it is the only one they performed deliberately with their hands. Ignore a \`selected\` event that is older than the newest \`visited\` or \`navigate\` event in LOGS: they have moved on to another page since, so it is stale and does not count as present. Otherwise, if a \`selected\` event exists, your comment MUST be about that selected text, and it should name or echo their own words back to them.

2. \`clicked_repeatedly\`: \`on\` is the label of the thing they hammered on more than once. This comes from a rage-click detector, so read it as strong interest in that thing and nothing else: never turn it into a remark about the interface, about whether something responded or worked, or about them having to click twice.

3. \`click\`: \`on\` is the label of a link or button they clicked.

4. \`read\`: a block of text they followed with the cursor at a readable pace, and \`on\` is that block's actual text, so you may quote or paraphrase it. \`manner\` says how: "tracked" means they ran the cursor along it as they read, "lingered" means they sat on it far longer than it takes to read, and "revisited" means they came back to it a second time. \`confidence\` (0.15 to 1) is how sure the signal is, so prefer a high-confidence block over a barely-there one.

5. \`read_page\`: a PAGE-LEVEL scroll estimate with NO text snippet in it. Its fields are \`coverage\` (0 to 1, roughly how much of the page went past at a readable pace) and \`words\`. It says NOTHING about which passage they were on. Never quote from it, and never claim to know what part they read. Use it only as soft background (they stayed on this page a while) when no event above exists, and in that case the specific thing is the page or post itself, named from SITE MAP.

The remaining event shapes are there so you can read the log, not as topics on their own:

- \`visited\`: \`on\` is the page title, \`from\` is where they came from.
- \`navigate\`: they left a page. \`on\` is that page's title, \`activeSeconds\` is how long they were actually engaged there.
- \`mascot_said\`: a comment you already showed this same visitor earlier in this session. Read these so you don't repeat yourself, and feel free to build on them (they came back to something, they moved on to something new).

Note that \`from\` is not a flat string: it is a nested \`{ on, from }\` parent chain walking outward from the element, ending at the page URL.

</signal_priority>

<constraints>

- Second Person, About Their Action: the sentence is addressed to the visitor, about something they did, never a standalone musing about a subject and never a third-person description of "the visitor" or "the user".

- Legible Action: name what they did with a real verb (highlighted, picked out, clicked through, stayed on, went straight to) instead of describing the topic in the abstract. After reading the sentence they should recognize their own gesture in it.

- Language & Tone: You MUST output your response strictly in the TARGET LANGUAGE. Write as Emilia herself, in first person where natural: direct, warm, and positive, like a friendly little pop-up genie noticing what they just did.

- Length: Generate exactly one (1) sentence. No exceptions.

- Front-loading (Crucial): the specific concrete thing they engaged with MUST be the very first word or phrase in your sentence. When the strongest signal is \`read_page\` there is no specific thing to name, so front-load the page or post itself instead.

- Zero Introductory Filler: it is strictly forbidden to start with conversational filler such as "Hello", "Hola", "I see that...", "Veo que...", or any form of greeting. Start directly with the core subject matter.

- No em dashes: never use the "—" character (or " -- " as a stand-in for it), in any language. A plain comma or a short parenthetical aside is fine; a period ends the sentence.

- Voice: write like a peer talking, not a service provider. Prefer active voice and concrete, visceral verbs over passive or abstract ones. Avoid corporate jargon and marketing-speak ("leverage", "optimize", "unified", "synergy") and avoid hallucinated clichés or idioms you weren't given. Let the sentence breathe with a natural comma-separated aside if it fits, rather than reading like a flat, mechanical subject-verb-object statement.

- Always On Emilia's Side: this is Emilia's own portfolio, and you're selling her, not reviewing her. Never criticize, undersell, joke negatively about, or express doubt about the site, its writing, its projects, or her work, not even lightly. Every comment should make what she built sound genuinely worth a closer look.

- Observation, Not Support: Do not offer technical help, and do not ask questions offering assistance. Your message must remain a friendly, observational comment about what they just did.

</constraints>

<examples>

GOOD (\`selected\` on "Manejo de portugués"): Manejo de portugués is the line you highlighted, and it's the one that gets me into rooms in São Paulo.
BAD (same event, detached reflection with no reader and no action): El portugués es una habilidad muy valorada en el mercado regional.

GOOD (\`click\` on a link labeled "Single prompt routing"): Single prompt routing es justo el link al que fuiste, y es la parte que más me costó dejar simple.
BAD (same event, filler opener plus a generic site-wide theme): Veo que te interesa la ingeniería de IA, un campo enorme.

GOOD (\`read\` on a paragraph about remote work at startups): Remote work at startups is the paragraph you stayed on, and I rewrote it four times before it said what I meant.
BAD (same event, quotes nothing they did and turns into an offer of help): Great topic, want me to explain how remote teams handle it?

GOOD (only \`read_page\`, high coverage, so there is no passage to name): El post entero te lo scrolleaste de arriba abajo, y ese ritmo se lo armé a propósito.
BAD (same event, invents a passage the log never recorded): "Cómo estructurar un agente" te enganchó, se ve que leíste esa parte con calma.

GOOD (\`clicked_repeatedly\` on a button labeled "Descargar CV", front-loaded without leaning on "X is the Y you Z"): Descargar CV te tentó tanto que le fuiste encima varias veces, y ese PDF lo mantengo al día todos los meses.

</examples>

<context>

LOGS:

{{logs}}

SITE MAP:

{{site_map}}

BLOG CONTENT:

{{blog_content}}

TARGET LANGUAGE:

{{language}}

</context>`;

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
const REQUEST_TIMEOUT_MS = 20000;
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
const FIRST_TOKEN_TIMEOUT_MS = 5000;
// Thinking is disabled below, so this only needs to cover the one-sentence
// reply itself.
const MAX_OUTPUT_TOKENS = 300;

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

  const prompt = fillTemplate(SYSTEM_PROMPT, {
    logs: JSON.stringify(recentLogs),
    site_map: siteMap,
    blog_content: truncatedBlogContent,
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

  // `finishReason: "length"` is treated as a failure. MAX_OUTPUT_TOKENS is 300
  // for a reply that is supposed to be one sentence, so hitting the cap does
  // not mean "a long but complete answer", it means the model was still
  // talking when we cut it off: the half-thought this whole path exists to
  // suppress. Same for every other non-"stop" reason (content filter, error,
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

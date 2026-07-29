import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const SYSTEM_PROMPT = `You are the interactive assistant for Emilia Cabral's portfolio and blog. Your objective is to parse the user's navigation event logs and generate a highly personalized, single-sentence comment based on the specific content the visitor is engaging with.

<instructions>

1. Analyze the LOGS against the BLOG CONTENT to identify the most relevant and recent events (e.g., \`read\` events, prolonged time on a specific URL, or UI interactions).

2. Extract the SPECIFIC topic of interest. Crucial Constraint: Never extract generic, site-wide themes like "AI Engineer", "Artificial Intelligence", "Portfolio", or "Blog". Zoom in on the exact granular detail they are looking at (e.g., "Manejo de portugués", "Remote work at startups", "Single prompt routing").

3. Draft the sentence by placing that exact specific topic at the absolute beginning of the message.

CONSTRAINTS:

- Language & Tone: You MUST output your response strictly in the TARGET LANGUAGE. The tone must be informal, direct, and conversational, feeling as though you are standing next to the visitor making a casual, observational remark about their screen.

- Length: Generate exactly one (1) sentence. No exceptions.

- Front-loading (Crucial): The specific concept, technology, or niche topic the user is reading about MUST be the very first word or phrase in your sentence.

- Zero Introductory Filler: It is strictly forbidden to start with conversational filler such as "Hello", "Hola", "I see that...", "Veo que...", or any form of greeting. Start directly with the core subject matter.

- Observation, Not Support: Do not offer technical help, and do not ask questions offering assistance. You are a website interface; your message must remain a friendly, observational comment about the content they are viewing.

</instructions>

<context>

LOGS:

{{logs}}

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
const MAX_LOGS = 30;
const MAX_BLOG_CONTENT_CHARS = 3000;
const REQUEST_TIMEOUT_MS = 20000;
// Reasoning-capable Kimi models (e.g. kimi-k2.5) spend part of this budget
// on an internal chain-of-thought before the visible answer, reported
// separately as reasoningTokens — a cap sized for the one-sentence reply
// alone leaves nothing for that and the response gets cut off empty.
const MAX_OUTPUT_TOKENS = 1024;

type MascotCommentInput = {
  logs: unknown[];
  pageText: string;
  lang: string;
};

export async function getMascotComment({ logs, pageText, lang }: MascotCommentInput) {
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
  });

  const recentLogs = logs.slice(-MAX_LOGS);
  const truncatedBlogContent = (pageText || "").slice(0, MAX_BLOG_CONTENT_CHARS);

  const prompt = fillTemplate(SYSTEM_PROMPT, {
    logs: JSON.stringify(recentLogs),
    blog_content: truncatedBlogContent,
    language: LANGUAGE_NAMES[lang] || "English",
  });

  const { text, finishReason, usage } = await generateText({
    model: kimi.chatModel(modelId),
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const trimmed = text.trim();
  if (!trimmed) {
    console.log({ step: "getMascotComment", warning: "empty text from Kimi", modelId, finishReason, usage });
  }

  return trimmed;
}

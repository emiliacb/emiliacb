import type { Lang } from "./lang";

/** POST /api/mascot-comment. The mascot is off (AI_FEATURE_ENABLED); the endpoint comes back in phase 5. */
export const MASCOT_ENDPOINT = "/api/mascot-comment";

export type MascotRequest = {
  logs: unknown;
  pageText: string;
  lang: Lang;
  referrer?: string;
};

/** Body of every non-2xx response. A 2xx response is the reply streamed as plain text. */
export type MascotError = { error: string };

// The client shows these verbatim in its toast, so they are in the visitor's
// language. `unavailable` doubles as the client's own fallback, so the toast
// reads the same whether the message came from the server or the browser.
export const MASCOT_COPY: Record<Lang, { tooManyRequests: string; invalidRequest: string; unavailable: string }> = {
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
};

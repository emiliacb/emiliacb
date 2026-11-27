import { LANGS } from "../../shared/lang";
import { WEBMCP_ENABLED } from "../enabled";
import { DOCS_ALIAS_PATH, DOCS_PATH } from "./routes";

/**
 * Lines for dist/_redirects. The docs page for agents answers to /webmcp as
 * well as /mcp: the alias, its Markdown version and the old WebMCP lab all
 * redirect (301) to it (the old lab's language-less URL included). The language-less /webmcp goes to the language-less
 * /mcp, which the Worker then sends to the visitor's language.
 */
export function renderRedirects(): string[] {
  if (!WEBMCP_ENABLED) return [];
  return [
    `${DOCS_ALIAS_PATH} ${DOCS_PATH} 301`,
    `${DOCS_ALIAS_PATH}.md ${DOCS_PATH}.md 301`,
    // The old lab, language-less: /labs/* reaches the Worker, which falls through to the assets and this line.
    `/labs${DOCS_ALIAS_PATH} ${DOCS_PATH} 301`,
    ...LANGS.flatMap((lang) => [
      `/${lang}${DOCS_ALIAS_PATH} /${lang}${DOCS_PATH} 301`,
      `/${lang}${DOCS_ALIAS_PATH}.md /${lang}${DOCS_PATH}.md 301`,
      `/${lang}/labs/webmcp /${lang}${DOCS_PATH} 301`,
    ]),
  ];
}

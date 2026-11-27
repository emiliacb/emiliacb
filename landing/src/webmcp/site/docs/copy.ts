import type { Lang } from "../../../shared/lang";

/**
 * The words of the /mcp docs page, in both languages. They live here and not
 * in the site's dictionaries (src/shared/i18n) so that the page leaves with the
 * rest of WebMCP. The tools' own names and summaries are not here: they come
 * from the tool definitions (catalog.ts) and are in English, as an agent sees
 * them. The page is short on purpose: the detail of each tool is in its own
 * description and the detail of how to work with them is in the skills.
 */
export type DocsCopy = {
  /** <title> and the page's H1. */
  title: string;
  /** The footer's link to the page, on every page of the site: just the name of the protocol, since the footer's links are single words. */
  footerLink: string;
  /** What that link is, for a screen reader and a tooltip, which the one word does not say. */
  footerLinkLabel: string;
  description: string;
  /** What this is: two or three sentences, under the H1. */
  intro: string;
  connect: { heading: string; script: string; notes: string[] };
  skills: { heading: string; body: string };
  tools: { heading: string; intro: string };
  /** The title of each tool group, by the group's id (client/tools/index.js). */
  groups: Record<string, string>;
  safety: { heading: string; items: string[] };
  notServer: { heading: string; body: string };
};

const en: DocsCopy = {
  title: "WebMCP tools for agents",
  footerLink: "MCP",
  footerLinkLabel: "MCP: tools for AI agents",
  description:
    "The tools this site exposes to a visitor's browser agent through WebMCP, how to call them, and the skills that teach an agent to use them well.",
  intro:
    "This site offers its page to the browser agent of whoever is visiting (Claude in Chrome, Gemini and the like) as " +
    "[WebMCP](https://webmachinelearning.github.io/webmcp/) tools, in `document.modelContext`: restyle the page, click " +
    "around, read the site's Markdown pages, open a sidebar. The agent runs on the visitor's side, so there is no " +
    "endpoint, API key or account, and every change stays in the visitor's tab.",

  connect: {
    heading: "How an agent connects",
    script:
      "A browser with native WebMCP shows the tools to its agent as they are. Without it the page installs its own " +
      "`document.modelContext`, and an agent that can run JavaScript in the tab lists and calls them like this:",
    notes: [
      "`executeTool` resolves to a JSON string, `{ content: [{ type: \"text\", text }] }` (parse it; `text` is usually JSON " +
        "too). A tool that fails rejects with an Error whose message says what happened and what to do.",
      "A link that leaves the page navigates the tab; the new page registers the same tools, so wait a moment and call " +
        "`getTools()` again.",
    ],
  },

  skills: {
    heading: "Skills",
    body:
      "WebMCP has no skill primitive, so the skills are tools: `list_skills`, then `read_skill({ name })` (and " +
      "`file` for the others in its folder). Read the one that fits before you start. They are also published for " +
      "agents that install skills:",
  },

  tools: {
    heading: "Tools",
    intro:
      "Every tool, by group. Each tool's own description (in `getTools()`) says what it takes and returns. To restyle, " +
      "call `get_variables` first, change the tokens with `set_variables` and write CSS only for what they do not cover.",
  },

  groups: {
    css: "Style the page",
    interaction: "Look and click",
    fonts: "Fonts",
    content: "The site's content",
    dom: "Elements and sidebars",
    theme: "Theme",
    "tree-song": "The tree's song",
    "black-hole": "The black hole",
    skills: "Skills",
  },

  safety: {
    heading: "Safety",
    items: [
      "**Local to the tab.** CSS, fonts, colour mode and articles are kept in the tab's `sessionStorage` while the " +
        "visitor navigates the site in it, and a reload restores the original. An article is kept across pages but " +
        "shown again only by `create_article` with `show`. Inserted elements, changed text and a custom sidebar " +
        "(`insert_element`, `set_text_content`, `open_custom_sidebar`) last only on their page: navigating clears them. " +
        "Nothing is sent to the site or shared with another tab or visit.",
      "**Sanitized HTML.** What `insert_element`, `open_custom_sidebar` and `create_article` receive is parsed " +
        "inertly and filtered through an allowlist: no scripts, styles, frames, forms, event handlers or `javascript:` " +
        "URLs. The result lists what was removed.",
      "**The shield.** Changes that would make the page unusable (main content hidden, text with no contrast, a " +
        "full-screen layer that eats the clicks) are rolled back and reported only to the agent, with how to fix them. " +
        "`force: true` (`set_css`, `set_css_by_selector`, `set_variables`) applies a change anyway and shows the " +
        "visitor a notice to restore the original style: use it only when the effect is intended.",
      "**Few hosts, easy undo.** `read_md_page` reads only this site; `set_google_font` contacts " +
        "`fonts.googleapis.com` (the stylesheet) and `fonts.gstatic.com` (the font files). `reset_css`, " +
        "`set_theme_mode` with `system` and a reload put the page back.",
    ],
  },

  notServer: {
    heading: "What this is not",
    body:
      "These tools are **not a remote MCP server**: there is no JSON-RPC, streamable HTTP, SSE, API key or OAuth at " +
      "`/mcp`, which is documentation. They exist only inside a browser tab that has the site open.",
  },
};

const es: DocsCopy = {
  title: "Herramientas WebMCP para agentes",
  footerLink: "MCP",
  footerLinkLabel: "MCP: herramientas para agentes de IA",
  description:
    "Las herramientas que este sitio expone al agente del navegador de quien lo visita mediante WebMCP, cómo llamarlas y las skills que enseñan a usarlas bien.",
  intro:
    "Este sitio ofrece su página al agente del navegador de quien lo visita (Claude in Chrome, Gemini y similares) como " +
    "herramientas [WebMCP](https://webmachinelearning.github.io/webmcp/), en `document.modelContext`: cambiar el " +
    "estilo, hacer clic, leer las páginas del sitio en Markdown, abrir un panel lateral. El agente corre del lado del " +
    "visitante, así que no hay endpoint, API key ni cuenta, y todo cambio queda en la pestaña del visitante.",

  connect: {
    heading: "Cómo se conecta un agente",
    script:
      "Un navegador con WebMCP nativo muestra las herramientas a su agente tal cual. Sin él, la página instala su propio " +
      "`document.modelContext`, y un agente que puede ejecutar JavaScript en la pestaña las lista y llama así:",
    notes: [
      "`executeTool` resuelve a un string JSON, `{ content: [{ type: \"text\", text }] }` (parsealo; `text` suele ser JSON " +
        "también). Una herramienta que falla rechaza con un Error cuyo mensaje dice qué pasó y qué hacer.",
      "Un link que sale de la página navega la pestaña; la página nueva registra las mismas herramientas, así que esperá " +
        "un momento y llamá a `getTools()` de nuevo.",
    ],
  },

  skills: {
    heading: "Skills",
    body:
      "WebMCP no tiene una primitiva de skill, así que las skills son herramientas: `list_skills`, y después " +
      "`read_skill({ name })` (con `file` para los otros archivos de su carpeta). Leé la que corresponda antes de " +
      "empezar. También están publicadas para los agentes que instalan skills:",
  },

  tools: {
    heading: "Herramientas",
    intro:
      "Todas las herramientas, por grupo. La descripción de cada una (en `getTools()`) dice qué recibe y qué devuelve. " +
      "Para cambiar el estilo, llamá primero a `get_variables`, cambiá los tokens con `set_variables` y escribí CSS solo " +
      "para lo que no cubren.",
  },

  groups: {
    css: "Cambiar el estilo",
    interaction: "Mirar y hacer clic",
    fonts: "Fuentes",
    content: "El contenido del sitio",
    dom: "Elementos y paneles",
    theme: "Tema",
    "tree-song": "La canción del árbol",
    "black-hole": "El agujero negro",
    skills: "Skills",
  },

  safety: {
    heading: "Seguridad",
    items: [
      "**Local a la pestaña.** El CSS, las fuentes, el modo de color y los artículos se guardan en el `sessionStorage` " +
        "de la pestaña mientras el visitante navega el sitio en ella, y recargar restaura el original. Un artículo se " +
        "conserva entre páginas, pero solo `create_article` con `show` lo vuelve a mostrar. Los elementos insertados, " +
        "el texto cambiado y un panel propio (`insert_element`, `set_text_content`, `open_custom_sidebar`) duran solo en " +
        "su página: navegar los borra. No se envía nada al sitio ni se comparte con otra pestaña o visita.",
      "**HTML sanitizado.** Lo que reciben `insert_element`, `open_custom_sidebar` y `create_article` se parsea de " +
        "forma inerte y se filtra con una lista de permitidos: sin scripts, estilos, frames, formularios, manejadores " +
        "de eventos ni URLs `javascript:`. El resultado lista lo quitado.",
      "**El escudo.** Los cambios que dejarían la página inutilizable (contenido principal oculto, texto sin contraste, " +
        "una capa a pantalla completa que se come los clics) se deshacen y se informan solo al agente, con cómo " +
        "arreglarlos. `force: true` (`set_css`, `set_css_by_selector`, `set_variables`) aplica el cambio igual y le " +
        "muestra al visitante un aviso para restaurar el estilo original: usalo solo si el efecto es buscado.",
      "**Pocos hosts, deshacer fácil.** `read_md_page` lee solo este sitio; `set_google_font` llega a " +
        "`fonts.googleapis.com` (la hoja de estilos) y `fonts.gstatic.com` (los archivos de la fuente). `reset_css`, " +
        "`set_theme_mode` con `system` y recargar devuelven la página.",
    ],
  },

  notServer: {
    heading: "Qué no es esto",
    body:
      "Estas herramientas **no son un servidor MCP remoto**: en `/mcp` no hay JSON-RPC, HTTP streameable, SSE, API key " +
      "ni OAuth, es documentación. Existen solo dentro de una pestaña del navegador que tiene el sitio abierto.",
  },
};

export const DOCS_COPY: Record<Lang, DocsCopy> = { en, es };

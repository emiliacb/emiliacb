import type { Lang } from "../../../shared/lang";

/**
 * The words of the /mcp docs page, in both languages. They live here and not
 * in the site's dictionaries (src/shared/i18n) so that the page leaves with the
 * rest of WebMCP. The tools' own names and descriptions are not here: they come
 * from the tool definitions (catalog.ts) and are in English, as an agent sees
 * them.
 */
export type DocsCopy = {
  /** <title> and the page's H1. */
  title: string;
  /** The footer's link to the page, on every page of the site: just the name of the protocol, since the footer's links are single words. */
  footerLink: string;
  /** What that link is, for a screen reader and a tooltip, which the one word does not say. */
  footerLinkLabel: string;
  description: string;
  intro: string;
  what: { heading: string; body: string[] };
  connect: {
    heading: string;
    nativeHeading: string;
    native: string;
    scriptHeading: string;
    script: string;
    scriptNotes: string[];
    start: string;
  };
  skills: { heading: string; body: string[]; listIntro: string };
  tools: { heading: string; intro: string; none: string; input: string; type: string; required: string; description: string; yes: string; no: string };
  /** Title and one line for each tool group, by the group's id (client/tools/index.js). */
  groups: Record<string, { title: string; blurb: string }>;
  safety: { heading: string; items: string[] };
  notServer: { heading: string; body: string[] };
};

const en: DocsCopy = {
  title: "WebMCP tools for agents",
  footerLink: "MCP",
  footerLinkLabel: "MCP: tools for AI agents",
  description:
    "The tools this site exposes to a visitor's browser agent through WebMCP, how to call them, and the skills that teach an agent to use them well.",
  intro:
    "This site exposes its page to the browser agent of whoever is visiting (Claude in Chrome, Gemini and the like) " +
    "as WebMCP tools. An agent can restyle the page, click around, read the site's Markdown pages, insert elements or " +
    "open a sidebar. Every change is local to the visitor's tab: nothing is sent to the site or stored on it, it is kept " +
    "while the visitor navigates the site in this tab, and a reload restores the original.",

  what: {
    heading: "What this is",
    body: [
      "[WebMCP](https://webmachinelearning.github.io/webmcp/) is a proposed web standard that lets a page offer tools to " +
        "the agent of the browser it is open in, as `document.modelContext`. The agent runs on the visitor's side, so " +
        "there is no endpoint to call, no API key and no account.",
      "The tools below are registered on every page of the site. The visitor who asked their agent to \"make this page " +
        "look like a terminal\" or \"show me what Emilia does\" gets the page changed in front of them, in their own tab.",
    ],
  },

  connect: {
    heading: "How an agent connects",
    nativeHeading: "Native WebMCP",
    native:
      "A browser that implements WebMCP shows the page's tools to its agent directly, and there is nothing to do: " +
      "each tool is registered with `document.modelContext.registerTool()` when the page loads.",
    scriptHeading: "From JavaScript in the tab",
    script:
      "Without native WebMCP (most browsers today) the page installs its own `document.modelContext` with the part of " +
      "the API an agent needs. An agent that can run JavaScript in the tab (Claude in Chrome, for one) lists and calls " +
      "the tools like this:",
    scriptNotes: [
      "`document.modelContext.polyfill` is `true` when it is the page's own. `getTools()` returns the exact JSON Schema " +
        "of each tool's input; the tables below show the same in short.",
      "`executeTool` resolves to a JSON string of the spec's result, `{ content: [{ type: \"text\", text }] }`. A tool " +
        "that fails rejects, and its message says what happened and what to try: it is the whole error.",
      "A link that leaves the page navigates the tab. The new page registers the same tools, so wait a moment and call " +
        "`getTools()` again. Styles, fonts, articles and the colour mode an agent set are kept while the visitor navigates the site in this tab; a reload restores the original.",
    ],
    start:
      "Where to start: call `list_skills` and read the one that fits what the visitor asked for with `read_skill`. " +
      "The tool descriptions point at them too.",
  },

  skills: {
    heading: "Skills",
    body: [
      "WebMCP has no \"prompt\" or \"skill\" primitive, so the skills are tools: `list_skills` returns the name and " +
        "description of each, and `read_skill` with a `name` returns its Markdown. Nothing needs installing.",
      "They are plain agent skills (a `SKILL.md` with `name` and `description` in its frontmatter), also published at " +
        "the URLs below for agents that can install skills. That is optional: `read_skill` is the way in.",
    ],
    listIntro: "The skills:",
  },

  tools: {
    heading: "Tools",
    intro:
      "Every tool of the page, as it registers, by group. The descriptions are the ones an agent reads (in English); " +
      "this list is generated from the same definitions, so it does not drift from them. To restyle the page, " +
      "call `get_variables` first, change the design tokens with `set_variables` and only then write CSS for what " +
      "the tokens do not cover.",
    none: "Takes no input.",
    input: "Input",
    type: "Type",
    required: "Required",
    description: "Description",
    yes: "yes",
    no: "no",
  },

  groups: {
    css: { title: "Style the page", blurb: "Read the design tokens and the CSS, and change them: the whole stylesheet or one selector." },
    interaction: { title: "Look and click", blurb: "List the links and buttons of the page and click one, as a visitor would." },
    fonts: { title: "Fonts", blurb: "Load a Google Font and see which are loaded, to apply them with the CSS tools." },
    content: { title: "The site's content", blurb: "Read the site's Markdown pages, and show an article of your own styled as a post." },
    dom: { title: "Elements and sidebars", blurb: "Insert sanitized elements, change text and open a sidebar like the site's own." },
    theme: { title: "Theme", blurb: "Read the colour mode and force light, dark, or the system's." },
    "tree-song": { title: "The tree's song", blurb: "Play a melody on the tree's own voice, on the home page." },
    "black-hole": { title: "The black hole", blurb: "Set off the gradient's black hole, on desktop pages that have the gradient." },
    skills: { title: "Skills", blurb: "Procedures for working well on this site, as tools." },
  },

  safety: {
    heading: "Safety",
    items: [
      "**Local to the tab.** The agent's CSS, fonts, articles and colour mode are kept in the tab's `sessionStorage` " +
        "while the visitor navigates the site in this tab (links, back and forward); a reload restores the original, " +
        "and they never reach another tab or a later visit. Inserted elements and changed text last until the page is " +
        "reloaded. The tools do not send anything to the site.",
      "**Sanitized HTML.** What an agent sends to `insert_element`, `open_custom_sidebar` and `create_article` is parsed " +
        "inertly and filtered through an allowlist: no scripts, styles, frames, forms, event handlers or `javascript:` " +
        "URLs. Whatever is not known is dropped, and the result lists what was removed.",
      "**The shield.** After every CSS change the page is checked: the main content hidden or off-screen, text with no " +
        "contrast against its background, a full-screen layer that eats the clicks. If the change broke the page it is " +
        "rolled back silently and the call is rejected, telling the agent what broke and how to fix it; the visitor sees " +
        "nothing. Read the problems and send a corrected change. `force: true` on `set_css` and `set_css_by_selector` " +
        "applies a change anyway, returns the problems as warnings and shows the visitor a small notice to restore the " +
        "original style: use it only when the effect is intended.",
      "**Reads stay on the site.** `read_md_page` only reads this site's own pages; the one other host a tool contacts " +
        "is Google Fonts, for `set_google_font`.",
      "**Undo.** `reset_css` removes the agent's CSS, `set_theme_mode` with `system` hands the colour mode back, and a " +
        "reload brings back the page as designed.",
    ],
  },

  notServer: {
    heading: "What this is not",
    body: [
      "These tools are **not a remote MCP server**. There is no `/mcp` JSON-RPC endpoint, no streamable HTTP or SSE, " +
        "no API key and no OAuth: this URL is documentation, in HTML and in Markdown. Do not point an MCP client at it.",
      "The tools exist only inside a browser tab that has the site open, and they run there, for the agent of the " +
        "person looking at it.",
    ],
  },
};

const es: DocsCopy = {
  title: "Herramientas WebMCP para agentes",
  footerLink: "MCP",
  footerLinkLabel: "MCP: herramientas para agentes de IA",
  description:
    "Las herramientas que este sitio expone al agente del navegador de quien lo visita mediante WebMCP, cómo llamarlas y las skills que enseñan a usarlas bien.",
  intro:
    "Este sitio expone su página al agente del navegador de quien lo visita (Claude in Chrome, Gemini y similares) " +
    "como herramientas WebMCP. Un agente puede cambiar el estilo de la página, hacer clic, leer las páginas del sitio en " +
    "Markdown, insertar elementos o abrir un panel lateral. Todo cambio es local a la pestaña del visitante: no se " +
    "envía nada al sitio ni se guarda en él, se conserva mientras el visitante navega el sitio en esa pestaña, y recargar restaura el original.",

  what: {
    heading: "Qué es esto",
    body: [
      "[WebMCP](https://webmachinelearning.github.io/webmcp/) es una propuesta de estándar web para que una página " +
        "ofrezca herramientas al agente del navegador en el que está abierta, como `document.modelContext`. El agente " +
        "corre del lado del visitante: no hay un endpoint al que llamar, ni API key, ni cuenta.",
      "Las herramientas de abajo están registradas en todas las páginas del sitio. Quien le pide a su agente \"hacé que " +
        "esta página parezca una terminal\" o \"mostrame a qué se dedica Emilia\" ve cambiar la página delante suyo, " +
        "en su propia pestaña.",
    ],
  },

  connect: {
    heading: "Cómo se conecta un agente",
    nativeHeading: "WebMCP nativo",
    native:
      "Un navegador que implementa WebMCP muestra las herramientas de la página directamente a su agente, y no hay nada " +
      "que hacer: cada herramienta se registra con `document.modelContext.registerTool()` al cargar la página.",
    scriptHeading: "Desde JavaScript en la pestaña",
    script:
      "Sin WebMCP nativo (la mayoría de los navegadores hoy) la página instala su propio `document.modelContext` con la " +
      "parte de la API que un agente necesita. Un agente que puede ejecutar JavaScript en la pestaña (Claude in " +
      "Chrome, por ejemplo) lista y llama las herramientas así:",
    scriptNotes: [
      "`document.modelContext.polyfill` es `true` cuando es el de la propia página. `getTools()` devuelve el JSON " +
        "Schema exacto de la entrada de cada herramienta; las tablas de abajo muestran lo mismo, resumido.",
      "`executeTool` resuelve a un string JSON con el resultado de la spec, `{ content: [{ type: \"text\", text }] }`. " +
        "Una herramienta que falla rechaza la promesa, y su mensaje dice qué pasó y qué probar: es todo el error.",
      "Un link que sale de la página navega la pestaña. La página nueva registra las mismas herramientas: esperá un " +
        "momento y llamá a `getTools()` de nuevo. Los estilos, las fuentes, los artículos y el modo de color que un agente puso se conservan mientras el visitante " +
        "navega el sitio en esa pestaña; recargar restaura el original.",
    ],
    start:
      "Por dónde empezar: llamá a `list_skills` y leé con `read_skill` la que corresponda a lo que pidió el visitante. " +
      "Las descripciones de las herramientas también las señalan.",
  },

  skills: {
    heading: "Skills",
    body: [
      "WebMCP no tiene una primitiva de \"prompt\" ni de \"skill\", así que las skills son herramientas: `list_skills` " +
        "devuelve el nombre y la descripción de cada una, y `read_skill` con un `name` devuelve su Markdown. No hace " +
        "falta instalar nada.",
      "Son skills de agente comunes (un `SKILL.md` con `name` y `description` en el frontmatter), publicadas también " +
        "en las URLs de abajo para los agentes que pueden instalar skills. Es opcional: `read_skill` es la entrada.",
    ],
    listIntro: "Las skills:",
  },

  tools: {
    heading: "Herramientas",
    intro:
      "Todas las herramientas de la página, como se registran, por grupo. Las descripciones son las que lee un agente " +
      "(en inglés); esta lista se genera de las mismas definiciones, así que no se desfasa de ellas. Para cambiar el " +
      "estilo de la página, llamá primero a `get_variables`, cambiá los tokens de diseño con `set_variables` y recién " +
      "después escribí CSS para lo que los tokens no cubren.",
    none: "No recibe entrada.",
    input: "Entrada",
    type: "Tipo",
    required: "Obligatorio",
    description: "Descripción",
    yes: "sí",
    no: "no",
  },

  groups: {
    css: { title: "Cambiar el estilo", blurb: "Leer los tokens de diseño y el CSS, y cambiarlos: la hoja de estilos entera o un selector." },
    interaction: { title: "Mirar y hacer clic", blurb: "Listar los links y botones de la página y hacer clic en uno, como un visitante." },
    fonts: { title: "Fuentes", blurb: "Cargar una Google Font y ver cuáles están cargadas, para aplicarlas con las herramientas de CSS." },
    content: { title: "El contenido del sitio", blurb: "Leer las páginas del sitio en Markdown y mostrar un artículo propio con el estilo de un post." },
    dom: { title: "Elementos y paneles", blurb: "Insertar elementos sanitizados, cambiar texto y abrir un panel lateral como los del sitio." },
    theme: { title: "Tema", blurb: "Leer el modo de color y forzar claro, oscuro o el del sistema." },
    "tree-song": { title: "La canción del árbol", blurb: "Tocar una melodía con la voz del propio árbol, en la página de inicio." },
    "black-hole": { title: "El agujero negro", blurb: "Desatar el agujero negro del gradiente, en las páginas de escritorio que lo tienen." },
    skills: { title: "Skills", blurb: "Procedimientos para trabajar bien en este sitio, como herramientas." },
  },

  safety: {
    heading: "Seguridad",
    items: [
      "**Local a la pestaña.** El CSS, las fuentes, los artículos y el modo de color del agente se guardan en el `sessionStorage` de la " +
        "pestaña mientras el visitante navega el sitio (links, atrás y adelante); recargar restaura el original y " +
        "nunca llegan a otra pestaña ni a una visita posterior. Los elementos insertados y el texto cambiado duran " +
        "hasta recargar la página. Las herramientas no envían nada al sitio.",
      "**HTML sanitizado.** Lo que un agente manda a `insert_element`, `open_custom_sidebar` y `create_article` se " +
        "parsea de forma inerte y se filtra con una lista de permitidos: sin scripts, estilos, frames, formularios, " +
        "manejadores de eventos ni URLs `javascript:`. Lo que no se conoce se descarta, y el resultado lista lo quitado.",
      "**El escudo.** Después de cada cambio de CSS se revisa la página: el contenido principal oculto o fuera de " +
        "pantalla, texto sin contraste con su fondo, una capa a pantalla completa que se come los clics. Si el cambio " +
        "rompió la página se deshace en silencio y la llamada se rechaza, diciéndole al agente qué se rompió y cómo " +
        "arreglarlo; el visitante no ve nada. Leé los problemas y mandá un cambio corregido. `force: true` en " +
        "`set_css` y `set_css_by_selector` aplica el cambio igual, devuelve los problemas como advertencias y le " +
        "muestra al visitante un aviso chico para restaurar el estilo original: usalo solo si el efecto es buscado.",
      "**Las lecturas se quedan en el sitio.** `read_md_page` solo lee páginas del propio sitio; el único otro host " +
        "al que llega una herramienta es Google Fonts, por `set_google_font`.",
      "**Deshacer.** `reset_css` quita el CSS del agente, `set_theme_mode` con `system` devuelve el modo de color, y " +
        "recargar trae de vuelta la página como fue diseñada.",
    ],
  },

  notServer: {
    heading: "Qué no es esto",
    body: [
      "Estas herramientas **no son un servidor MCP remoto**. No hay un endpoint JSON-RPC en `/mcp`, ni HTTP " +
        "streameable ni SSE, ni API key ni OAuth: esta URL es documentación, en HTML y en Markdown. No apuntes un " +
        "cliente MCP a ella.",
      "Las herramientas existen solo dentro de una pestaña del navegador que tiene el sitio abierto, y corren ahí, para " +
        "el agente de la persona que lo está mirando.",
    ],
  },
};

export const DOCS_COPY: Record<Lang, DocsCopy> = { en, es };

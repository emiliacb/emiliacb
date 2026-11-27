// WebMCP tools that let an agent do what a visitor does with a pointer: find
// the links and buttons on the page, and click one. The agent never needs a CSS
// selector for the common case: it lists, then clicks by the id it was given
// (or by the visible text). Clicks are the page's own: a real element.click(),
// so the site's handlers (the contact sidebars, the menu, the loading bar) run
// exactly as for a person.
import { fail, ok } from "../core/result.js";
import { ANSWER_HINT } from "../skills/hints.js";

// Everything a visitor can press. dropdown-trigger is the site's menu: its real
// button lives in a shadow root, so the host element stands for it.
const INTERACTIVE =
  'a[href], button, [role="button"], summary, dropdown-trigger, input[type="button"], input[type="submit"]';
const ID_ATTRIBUTE = "data-webmcp-id";
const MAX_ITEMS = 200;
const MAX_NAME_CHARS = 80;
// How long to watch for a sidebar to open: its drawer bundle downloads on the first use.
const SIDEBAR_WAIT_MS = 4000;
const SETTLE_MS = 300;
// A navigating click is made after the result has been returned, so the agent
// receives it before the page unloads.
const NAVIGATION_DELAY_MS = 150;

const LANDMARKS = [
  ["ui-drawer", "sidebar"],
  ["dialog, [role='dialog']", "dialog"],
  ["nav, [role='navigation']", "nav"],
  ["header, [role='banner']", "header"],
  ["footer, [role='contentinfo']", "footer"],
  ["aside, [role='complementary']", "aside"],
  ["main, [role='main']", "main"],
];

let nextId = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function squash(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function cut(text) {
  return text.length > MAX_NAME_CHARS ? `${text.slice(0, MAX_NAME_CHARS - 1)}…` : text;
}

/** The accessible name as far as it can be told without the full algorithm: aria-label, aria-labelledby, text, alt, title. */
function nameOf(el) {
  if (el.localName === "dropdown-trigger") return squash(el.getAttribute("label"));
  const label = squash(el.getAttribute("aria-label"));
  if (label) return label;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = squash(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
    if (text) return text;
  }
  const text = squash(el.localName === "input" ? el.value : el.textContent);
  if (text) return text;
  const alt = squash(el.querySelector("img[alt]")?.getAttribute("alt"));
  return alt || squash(el.getAttribute("title"));
}

function kindOf(el) {
  if (el.localName === "dropdown-trigger") return "menu";
  if (el.localName === "summary") return "disclosure";
  if (el.localName === "a") return el.hasAttribute("data-sidebar") ? "sidebar-trigger" : "link";
  return "button";
}

function landmarkOf(el) {
  for (const [selector, name] of LANDMARKS) {
    if (el.closest(selector)) return name;
  }
  return "page";
}

function isHidden(el) {
  if (el.closest("[inert]") || el.closest('[aria-hidden="true"]')) return true;
  const visible = el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  if (!visible) return true;
  const rect = el.getBoundingClientRect();
  return rect.width === 0 || rect.height === 0;
}

function isDisabled(el) {
  return el.matches(":disabled") || el.getAttribute("aria-disabled") === "true";
}

function inViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function hrefInfo(el) {
  if (el.localName !== "a") return null;
  const url = new URL(el.href, location.href);
  if (url.protocol === "mailto:") return { href: url.href, scope: "mailto" };
  if (url.protocol === "tel:") return { href: url.href, scope: "tel" };
  return { href: url.href, scope: url.origin === location.origin ? "internal" : "external" };
}

/** The element's id for the agent: stable across listings because it lives on the element. */
function idOf(el) {
  let id = el.getAttribute(ID_ATTRIBUTE);
  if (!id) {
    id = `w${nextId}`;
    nextId += 1;
    el.setAttribute(ID_ATTRIBUTE, id);
  }
  return id;
}

function describe(group) {
  const el = pickCopy(group);
  const item = { id: idOf(el), kind: kindOf(el), name: cut(nameOf(el)) };
  if (group.length > 1) item.alsoAt = group.filter((copy) => copy !== el).map(idOf);
  const link = hrefInfo(el);
  if (link) {
    item.href = link.href;
    item.scope = link.scope;
    if (el.target === "_blank") item.opensNewTab = true;
  }
  if (el.dataset.sidebar) item.opensSidebar = el.dataset.sidebar;
  const expanded = el.localName === "dropdown-trigger" ? el.hasAttribute("open") : el.getAttribute("aria-expanded");
  if (expanded === true || expanded === "true") item.expanded = true;
  if (isDisabled(el)) item.disabled = true;
  item.in = landmarkOf(el);
  item.inViewport = inViewport(el);
  return item;
}

function collect(includeHidden) {
  return Array.from(document.querySelectorAll(INTERACTIVE)).filter((el) => includeHidden || !isHidden(el));
}

/**
 * What a visitor gets by pressing the element: the same name and the same
 * destination (address or sidebar). The page has several real copies of its
 * contact and footer triggers (the contact row in the content and the footer's
 * column, both on screen at once), so two elements with the same key are one
 * choice, not an ambiguity. Menus, buttons and disclosures have no destination
 * to compare and are never grouped.
 */
function targetKey(el) {
  const link = hrefInfo(el);
  if (!link) return null;
  return `${nameOf(el).toLowerCase()}|${link.href}|${el.dataset.sidebar ?? ""}`;
}

/** The elements in page order, each run of the same target as one group: [first, ...copies]. */
function groupByTarget(elements) {
  const groups = [];
  const byKey = new Map();
  for (const el of elements) {
    const key = targetKey(el);
    const group = key === null ? undefined : byKey.get(key);
    if (group) {
      group.push(el);
      continue;
    }
    const created = [el];
    groups.push(created);
    if (key !== null) byKey.set(key, created);
  }
  return groups;
}

/** True when the element is on screen and nothing covers its centre (the footer sits behind the content sheet until scrolled to). */
function isReachable(el) {
  if (!inViewport(el)) return false;
  const rect = el.getBoundingClientRect();
  const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return top !== null && (el === top || el.contains(top) || top.contains(el));
}

/** Of one group, the copy a visitor could press right now; else one on screen; else the first. */
function pickCopy(group) {
  return group.find(isReachable) ?? group.find(inViewport) ?? group[0];
}

function matchesFilter(el, needle) {
  const link = hrefInfo(el);
  return `${nameOf(el)} ${link?.href ?? ""}`.toLowerCase().includes(needle);
}

function candidatesLine(elements) {
  return elements
    .slice(0, 8)
    .map((el) => `${idOf(el)} ${kindOf(el)} "${cut(nameOf(el))}" (${landmarkOf(el)})`)
    .join("; ");
}

function elementById(id) {
  const el = document.querySelector(`[${ID_ATTRIBUTE}="${CSS.escape(id)}"]`);
  if (!el) {
    throw fail(`No element has the id "${id}" on this page now. Ids belong to the page they were listed on; call get_links_and_buttons again.`);
  }
  return el;
}

function elementBySelector(selector) {
  let found;
  try {
    found = Array.from(document.querySelectorAll(selector));
  } catch {
    throw fail(`"${selector}" is not a valid CSS selector. Use get_links_and_buttons and click by id instead.`);
  }
  if (found.length === 0) throw fail(`The selector "${selector}" matches no element on this page. Try get_links_and_buttons to see what is there.`);
  const visible = found.filter((el) => !isHidden(el));
  const pool = visible.length > 0 ? visible : found;
  if (pool.length > 1) {
    throw fail(`The selector "${selector}" matches ${pool.length} elements: ${candidatesLine(pool)}. Click one by its id, or make the selector more specific.`);
  }
  return pool[0];
}

function elementByText(text) {
  const wanted = squash(text).toLowerCase();
  const visible = collect(false);
  const exact = visible.filter((el) => nameOf(el).toLowerCase() === wanted);
  const pool = exact.length > 0 ? exact : visible.filter((el) => nameOf(el).toLowerCase().includes(wanted));
  if (pool.length === 0) {
    throw fail(`No visible link or button has the text "${text}". Call get_links_and_buttons (with includeHidden: true to see the hidden ones too).`);
  }
  const groups = groupByTarget(pool);
  if (groups.length > 1) {
    throw fail(`"${text}" matches ${groups.length} links or buttons: ${candidatesLine(groups.map(pickCopy))}. Click one by its id.`);
  }
  return pickCopy(groups[0]);
}

function resolveTarget(input) {
  const given = ["id", "selector", "text"].filter((key) => typeof input?.[key] === "string" && input[key].trim() !== "");
  if (given.length === 0) throw fail('Give one of "id" (from get_links_and_buttons), "text" (the visible text) or "selector".');
  if (given.length > 1) throw fail(`Give only one of "id", "selector" and "text", not ${given.join(" and ")}.`);
  const [key] = given;
  const value = input[key].trim();
  if (key === "id") return elementById(value);
  if (key === "selector") return elementBySelector(value);
  return elementByText(value);
}

function checkClickable(el, label) {
  if (isDisabled(el)) throw fail(`${label} is disabled, so a visitor could not click it. Nothing was clicked.`);
  if (isHidden(el)) {
    throw fail(
      `${label} is not visible (hidden, collapsed, transparent or zero-sized), so a visitor could not click it. Nothing was clicked. ` +
        "If it is inside a menu, click the menu's trigger first.",
    );
  }
}

/** True when a plain click on this link leaves the page (so the page, and these tools, are replaced). */
function leavesPage(el) {
  if (el.localName !== "a" || el.hasAttribute("data-sidebar") || el.hasAttribute("download")) return false;
  if (el.target && el.target !== "_self") return false;
  const url = new URL(el.href, location.href);
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const samePage = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
  return !(samePage && url.hash !== "");
}

/** Resolves true as soon as the drawer is open and showing, false once the time is up. */
function waitForSidebar(drawer, deadline = Date.now() + SIDEBAR_WAIT_MS) {
  if (drawer.open === true && drawer.checkVisibility?.()) return Promise.resolve(true);
  if (Date.now() >= deadline) return Promise.resolve(drawer.open === true);
  return sleep(100).then(() => waitForSidebar(drawer, deadline));
}

function clickTarget(el) {
  // The menu's real button is in its shadow root; the host itself has no click handler.
  const inner = el.localName === "dropdown-trigger" ? el.shadowRoot?.querySelector("button") : null;
  (inner ?? el).click();
}

function clickedDescription(el) {
  return { id: idOf(el), kind: kindOf(el), name: cut(nameOf(el)), in: landmarkOf(el) };
}

async function clickSidebar(el) {
  const drawer = document.getElementById(el.dataset.sidebar);
  const before = location.href;
  clickTarget(el);
  if (!drawer) return { happened: "Clicked. The sidebar element was not found, so the link may have done its default action." };
  const opened = await waitForSidebar(drawer);
  const external = hrefInfo(el)?.scope === "external";
  return {
    happened: opened
      ? `The "${el.dataset.sidebar}" sidebar opened. Its content is part of the page now; call get_links_and_buttons to see its links and buttons.`
      : `The "${el.dataset.sidebar}" sidebar did not open within ${SIDEBAR_WAIT_MS / 1000} s` +
        (external ? "; the link may have opened its destination instead." : "."),
    sidebarOpen: opened,
    urlChanged: location.href !== before,
  };
}

async function clickMenu(el) {
  clickTarget(el);
  await sleep(SETTLE_MS);
  const open = el.hasAttribute("open");
  return {
    happened: open
      ? "The menu opened. Its links are visible now; call get_links_and_buttons to list them."
      : "The menu closed.",
    menuOpen: open,
  };
}

async function clickInPage(el) {
  const before = location.href;
  const hadExpanded = el.getAttribute("aria-expanded");
  clickTarget(el);
  await sleep(SETTLE_MS);
  const result = { happened: "Clicked." };
  if (location.href !== before) {
    result.happened = `Clicked. The address changed within the page to ${location.href}.`;
    result.url = location.href;
  }
  const expanded = el.getAttribute("aria-expanded");
  if (expanded !== hadExpanded && expanded !== null) {
    result.happened += expanded === "true" ? " It is now expanded." : " It is now collapsed.";
  }
  return result;
}

function clickNewTab(el) {
  clickTarget(el);
  return {
    happened:
      `Clicked. The link opens ${new URL(el.href, location.href).href} in a new tab. This page stays as it is. ` +
      "The browser may block a new tab that was not opened by a person; if so, nothing opened.",
  };
}

function clickNavigation(el) {
  const target = new URL(el.href, location.href).href;
  // Returned first, clicked a moment later: the click unloads this page, and
  // with it the promise the agent is waiting on.
  setTimeout(() => clickTarget(el), NAVIGATION_DELAY_MS);
  return {
    happened:
      `Clicked. The page is navigating to ${target}. This page and its tools go away; the new page registers the same tools again ` +
      "(wait a moment, then call get_links_and_buttons or any tool on the new page).",
    navigatingTo: target,
  };
}

async function performClick(el) {
  if (el.localName === "dropdown-trigger") return clickMenu(el);
  if (el.localName === "a" && el.hasAttribute("data-sidebar")) return clickSidebar(el);
  if (el.localName === "a" && el.target === "_blank") return clickNewTab(el);
  if (leavesPage(el)) return clickNavigation(el);
  return clickInPage(el);
}

const getLinksAndButtons = {
  name: "get_links_and_buttons",
  summary: "the links and buttons a visitor could click, with ids",
  title: "List the links and buttons",
  description:
    "Lists the interactive elements on the current page that a visitor could click: links, buttons, the menu " +
    "triggers, expandable summaries and the contact sidebar triggers (GitHub, LinkedIn, e-mail, calendar). " +
    "Hidden ones (display none, invisible, transparent, zero-sized, inert or aria-hidden, such as the links of a closed " +
    "menu or sidebar) are left out unless `includeHidden` is true. " +
    "Input: optional `filter` (text matched case-insensitively against the name and the address) and optional " +
    "`includeHidden` (boolean, default false). " +
    "Returns `count` and `items`, each with: `id` (pass it to click_link_or_button; it is stable while the page stays " +
    "open), `kind` (link, button, menu, disclosure or sidebar-trigger), `name` (visible text or aria-label), for links " +
    "`href` (absolute) and `scope` (internal, external, mailto or tel), `opensNewTab`, `opensSidebar`, `expanded`, " +
    "`disabled`, `alsoAt` (ids of identical copies, such as the footer's), `in` (the section it is in: nav, header, main, footer, sidebar, dialog, aside or page) and " +
    "`inViewport`. Read-only: it changes nothing except tagging elements with a data-webmcp-id attribute. " +
    "It describes the page as it is now; call it again after a click that opens a menu or sidebar.",
  inputSchema: {
    type: "object",
    properties: {
      filter: { type: "string", description: "Only elements whose name or href contains this text (case-insensitive)." },
      includeHidden: { type: "boolean", description: "Also list elements a visitor cannot see right now (default false)." },
    },
  },
  annotations: { readOnlyHint: true },
  execute(input) {
    const needle = typeof input?.filter === "string" ? input.filter.trim().toLowerCase() : "";
    const found = collect(input?.includeHidden === true).filter((el) => needle === "" || matchesFilter(el, needle));
    const groups = groupByTarget(found);
    const shown = groups.slice(0, MAX_ITEMS).map(describe);
    const result = { page: location.href, count: groups.length, items: shown };
    if (groups.length > shown.length) result.note = `Only the first ${MAX_ITEMS} are listed; use "filter" to narrow it.`;
    return Promise.resolve(ok(result));
  },
};

const clickLinkOrButton = {
  name: "click_link_or_button",
  summary: "click a link or button by id, text or selector",
  title: "Click a link or button",
  description:
    "Clicks a link or button on the page the way a visitor would: scrolls it into view and fires a real click, so the " +
    "site's own behavior runs. Give exactly one of: `id` (from get_links_and_buttons, the reliable choice), `text` " +
    "(the visible text; exact match first, then contains, case-insensitive; identical copies, such as the footer's and " +
    "the contact row's, are one choice and the one on screen is clicked; an error lists the candidates if they differ) or `selector` (a CSS selector that must match one element). " +
    "Returns what was clicked and what happened. Side effects depend on the element: an internal link NAVIGATES this " +
    "tab (the page and its tools are replaced; the new page registers the same tools, so wait a moment and call them " +
    "again); a link with target=_blank asks the browser for a new tab (it may be blocked); an in-page anchor (#section) " +
    "scrolls and changes the address; a sidebar trigger opens the contact sidebar (the result says whether it opened); " +
    "a menu trigger opens or closes the menu. mailto: links hand off to the visitor's mail app. " +
    "Refuses, without clicking, a disabled element or one a visitor cannot see (click the menu trigger first for links " +
    "inside a menu)." +
    " " +
    ANSWER_HINT,
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The id of an element from get_links_and_buttons." },
      text: { type: "string", description: "The visible text of the link or button (case-insensitive)." },
      selector: { type: "string", description: "A CSS selector matching exactly one element." },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
  async execute(input) {
    const el = resolveTarget(input);
    const label = `"${cut(nameOf(el)) || el.localName}"`;
    checkClickable(el, label);
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const outcome = await performClick(el);
    return ok({ clicked: clickedDescription(el), ...outcome });
  },
};

export const interactionTools = [getLinksAndButtons, clickLinkOrButton];

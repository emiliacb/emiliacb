import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { ArrowUpRight, X } from "lucide-static";

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

/** The contact panels. Links with data-sidebar="<id>" open the one with that id (src/client/sidebars.js). */
export const SIDEBAR_IDS = {
  github: "github-sidebar",
  linkedin: "linkedin-sidebar",
  email: "email-sidebar",
  calendar: "calendar-sidebar",
} as const;

export type SidebarId = (typeof SIDEBAR_IDS)[keyof typeof SIDEBAR_IDS];

type SidebarProps = {
  id: SidebarId;
  title: string;
  /** Said small next to the title: the handle, the length of a meeting. */
  aside?: string;
  close: string;
  body: Html;
  /** The footer's small print, left of its button. */
  note: Html | string;
  /** The footer's button, built with sidebarLink. */
  action: Html;
};

/**
 * The shell every contact panel shares: a ui-sdk drawer, a sidebar from the
 * right on a desktop and a bottom sheet on a phone (the client sets `side`
 * before each opening; "right" is a placeholder). The title and its aside on
 * top, the body scrolling under them, and a footer with a note and one
 * button. Content and backdrop start hidden, so nothing shows before the
 * elements upgrade, and they only upgrade once a contact link is approached,
 * when the client loads the drawer.
 */
export function sidebar({ id, title, aside, close, body, note, action }: SidebarProps) {
  return html`
    <ui-drawer id="${id}" side="right" class="sidebar">
      <ui-drawer-backdrop hidden class="sidebar-backdrop"></ui-drawer-backdrop>
      <ui-drawer-content hidden class="sidebar-sheet text-stone-800 dark:text-stone-100">
        <div class="sidebar-grip" aria-hidden="true"></div>
        <!-- The X stays in the corner, on the title's first line, however many
             lines the title and its aside take. -->
        <header class="flex items-start justify-between gap-4 px-6 pt-6 md:pt-10 pb-3 md:pb-4">
          <div class="flex flex-wrap items-baseline gap-x-3 min-w-0">
            <ui-drawer-title class="block text-2xl md:text-3xl font-light">${title}</ui-drawer-title>
            ${aside ? html`<span class="text-sm truncate">${aside}</span>` : null}
          </div>
          <ui-drawer-close class="shrink-0">
            <button
              type="button"
              aria-label="${close}"
              class="sidebar-close interactive relative flex shrink-0 items-center justify-center size-8 -mr-2 md:mt-0.5
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-current [&>svg]:w-5 [&>svg]:h-5"
            >
              ${raw(X)}
            </button>
          </ui-drawer-close>
        </header>

        <div class="sidebar-scroll flex flex-col gap-4 sm:gap-6 md:gap-8 px-6 pb-4">${body}</div>

        <footer class="sidebar-actions flex items-center justify-between gap-4 px-6 py-3 border-t border-stone-400">
          <span class="text-xs opacity-75 min-w-0">${note}</span>
          ${action}
        </footer>
      </ui-drawer-content>
    </ui-drawer>
  `;
}

const buttonClass = `sidebar-invert interactive flex shrink-0 items-center gap-1 whitespace-nowrap w-fit border border-black dark:border-white px-3 py-1.5 text-sm
  focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black
  [&>svg]:w-4 [&>svg]:h-4`;

/** The footer's bordered button. Off-site links open in a new tab with the arrow; others (mailto:) in place. */
export function sidebarLink(label: string, href: string) {
  const external = href.startsWith("http");
  return external
    ? html`<a class="${buttonClass}" href="${href}" target="_blank" rel="noopener noreferrer">${label} ${raw(ArrowUpRight)}</a>`
    : html`<a class="${buttonClass}" href="${href}">${label}</a>`;
}

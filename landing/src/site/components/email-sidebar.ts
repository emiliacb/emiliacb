import { html, raw } from "hono/html";
import { ArrowUpRight, Check, Copy, Mail } from "lucide-static";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import { GMAIL_SVG, SUPERHUMAN_LOGO_DARK, SUPERHUMAN_LOGO_LIGHT } from "./email-link";
import { SIDEBAR_IDS, sidebar, sidebarLink } from "./sidebar";

// Rows over the sheet's own ground, so on hover they only darken a step
// instead of inverting: the brand logos keep the ground they were made for.
const rowClass = `sidebar-row interactive flex w-full items-center gap-3 px-1 py-2.5 text-sm text-left
  focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current
  [&_svg]:size-4 [&_svg]:shrink-0`;

const external = html`<span class="ml-auto opacity-75">${raw(ArrowUpRight)}</span>`;

/**
 * The address, big, and what the old email menu offered as rows with each
 * app's own mark: copy it, or write from Gmail, Superhuman or the system's
 * mail app. The copy button is wired by src/client/email-link.js, like the menu's.
 */
export default function emailSidebar(ctx: RenderCtx) {
  const { email: t } = ctx.t;
  const address = CONTACT.email;
  const [user, domain] = address.split("@");
  const to = encodeURIComponent(address);

  return sidebar({
    id: SIDEBAR_IDS.email,
    title: t.title,
    close: ctx.t.sidebar.close,
    body: html`
      <p class="border-b border-stone-400 pb-4">
        <span class="sidebar-number sidebar-word block break-all">${user}<br />@${domain}</span>
      </p>
      <ul class="-mt-4 sm:-mt-6 md:-mt-8 [&>li]:border-b [&>li]:border-stone-400">
        <li>
          <button type="button" class="${rowClass}" data-copy-value="${address}" data-copied-label="${t.copied}">
            <span class="copy-icon !inline-flex" aria-hidden="true">${raw(Copy)}</span>
            <span class="check-icon !hidden" aria-hidden="true">${raw(Check)}</span>
            <span class="copy-label">${t.copy}</span>
          </button>
        </li>
        <li>
          <a class="${rowClass}" href="https://mail.google.com/mail/?view=cm&fs=1&to=${to}" target="_blank" rel="noopener noreferrer"
            >${raw(GMAIL_SVG)}${t.gmail}${external}</a
          >
        </li>
        <li>
          <a class="${rowClass}" href="superhuman://compose?to=${to}">
            <!-- The red mark on the light sheet, the wisteria one on the dark. -->
            <img src="${SUPERHUMAN_LOGO_DARK}" alt="" class="size-4 shrink-0 dark:hidden" />
            <img src="${SUPERHUMAN_LOGO_LIGHT}" alt="" class="size-4 shrink-0 hidden dark:inline-block" />
            ${t.superhuman}
          </a>
        </li>
        <li>
          <a class="${rowClass}" href="mailto:${address}">${raw(Mail)}${t.mailApp}</a>
        </li>
      </ul>
    `,
    note: t.note,
    action: sidebarLink(t.write, `mailto:${address}`),
  });
}

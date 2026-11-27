import { html } from "hono/html";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import { SIDEBAR_IDS, sidebar, sidebarLink } from "./sidebar";

/**
 * Cal.com's booker, embedded: src/client/sidebars.js loads Cal.com's embed
 * script into #calendar-embed the first time this sidebar opens, never before.
 * Until then, and if it can't load, the placeholder says so and the footer
 * button books on Cal.com itself.
 */
export default function calendarSidebar(ctx: RenderCtx) {
  const { calendar: t } = ctx.t;
  // "emiliacb/general": the embed takes the link without its origin.
  const calLink = new URL(CONTACT.calendar).pathname.slice(1);

  return sidebar({
    id: SIDEBAR_IDS.calendar,
    title: t.title,
    aside: t.length,
    close: ctx.t.sidebar.close,
    body: html`
      <div id="calendar-embed" class="calendar-embed -mx-6" data-cal-link="${calLink}">
        <p class="calendar-embed-wait px-6 text-sm opacity-75" role="status">${t.loading}</p>
      </div>
    `,
    note: t.where,
    action: sidebarLink(t.openInCal, CONTACT.calendar),
  });
}

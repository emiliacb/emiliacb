import { html } from "hono/html";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import { githubStats, type GithubStats } from "../github/stats";
import { SIDEBAR_IDS, sidebar, sidebarLink } from "./sidebar";

const DAY_MS = 86_400_000;
const utc = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`);

/** Merged PRs per month as bars with their count on top; the current month, still running, in the accent. */
function monthlyChart(ctx: RenderCtx, stats: GithubStats) {
  const { github: t } = ctx.t;
  const months = stats.prsByMonth;
  const max = Math.max(1, ...months.map((m) => m.count));
  const fmt = new Intl.NumberFormat(ctx.lang);
  const short = new Intl.DateTimeFormat(ctx.lang, { month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(ctx.lang, { month: "long", year: "numeric", timeZone: "UTC" });
  const name = (month: string) => short.format(utc(`${month}-15`)).replace(".", "").slice(0, 3);

  const summary = t.monthSummary
    .replace("{from}", long.format(utc(`${months[0].month}-15`)))
    .replace("{to}", long.format(utc(`${months[months.length - 1].month}-15`)))
    .replace("{max}", fmt.format(max));

  return html`
    <figure>
      <figcaption class="text-sm sm:text-base italic mb-2">${t.monthsTitle}</figcaption>
      <div role="img" aria-label="${summary}">
        <div class="gh-months" aria-hidden="true">
          ${months.map(
            (m, i) => html`<div
              class="${i === months.length - 1 ? "gh-month gh-month-now" : "gh-month"}"
              style="height:${((m.count / max) * 100).toFixed(1)}%"
              title="${t.monthLabel.replace("{month}", long.format(utc(`${m.month}-15`))).replace("{count}", fmt.format(m.count))}"
            ><span>${fmt.format(m.count)}</span></div>`,
          )}
        </div>
        <div class="gh-month-names" aria-hidden="true">
          ${months.map((m) => html`<span>${name(m.month)}</span>`)}
        </div>
      </div>
    </figure>
  `;
}

/**
 * A day's shade, 0 to 4: 0 for none, and the busy days split at their
 * quartiles, the way GitHub splits them.
 */
function shadeLevels(days: number[]): (n: number) => number {
  const busy = days.filter((n) => n > 0).toSorted((a, b) => a - b);
  const q = (p: number) => busy[Math.min(busy.length - 1, Math.floor(p * busy.length))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  // Past zero, one shade more for every quartile the count is above.
  return (n) => (n === 0 ? 0 : 1 + cuts.filter((cut) => n > cut).length);
}

/**
 * GitHub's contribution calendar, drawn in the site's ink: a column per week,
 * Sunday on top, and four shades past zero split at the quartiles of the busy
 * days, the way GitHub splits them. Today is ringed in the accent.
 */
function contributionCalendar(ctx: RenderCtx, stats: GithubStats) {
  const { github: t } = ctx.t;
  const { days, start, total } = stats.contributions;
  const fmt = new Intl.NumberFormat(ctx.lang);
  const dateFmt = new Intl.DateTimeFormat(ctx.lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(ctx.lang, { month: "short", timeZone: "UTC" });

  const level = shadeLevels(days);
  const label = (n: number) => {
    if (n === 0) return t.dayNone;
    return (n === 1 ? t.dayOne : t.dayMany).replace("{count}", fmt.format(n));
  };

  const t0 = utc(start).getTime();
  const weeks = Math.ceil(days.length / 7);
  const PITCH = 12;
  const CELL = 10;

  // A month's name over the first week that starts in it, unless the
  // previous name is too close to leave room for it.
  const names: { col: number; text: string }[] = [];
  let prevMonth = -1;
  for (let col = 0; col < weeks; col++) {
    const date = new Date(t0 + col * 7 * DAY_MS);
    if (date.getUTCMonth() === prevMonth) continue;
    prevMonth = date.getUTCMonth();
    if (col > weeks - 3) continue;
    if (names.length && col - names[names.length - 1].col < 3) names.pop();
    names.push({ col, text: monthFmt.format(date).replace(".", "").slice(0, 3) });
  }

  const cells = days.map((n, i) => {
    const date = dateFmt.format(new Date(t0 + i * DAY_MS));
    const cls = `gh-day gh-l${level(n)}${i === days.length - 1 ? " gh-today" : ""}`;
    return html`<rect x="${Math.floor(i / 7) * PITCH}" y="${(i % 7) * PITCH}" width="${CELL}" height="${CELL}" class="${cls}"><title>${date}: ${label(n)}</title></rect>`;
  });

  return html`
    <figure>
      <figcaption class="text-sm sm:text-base italic mb-2">
        ${t.contributions.replace("{total}", fmt.format(total))}
      </figcaption>
      <div class="relative h-4 text-[0.65rem] opacity-75" aria-hidden="true">
        ${names.map(
          // Every other name only on the narrowest phones, where they would touch.
          (n, i) =>
            html`<span class="${i % 2 ? "absolute max-[359px]:hidden" : "absolute"}" style="left:${((n.col / weeks) * 100).toFixed(2)}%"
              >${n.text}</span
            >`,
        )}
      </div>
      <svg
        viewBox="0 0 ${weeks * PITCH - (PITCH - CELL)} ${7 * PITCH - (PITCH - CELL)}"
        role="img"
        aria-label="${t.calendarSummary.replace("{total}", fmt.format(total))}"
        class="block w-full h-auto"
      >
        ${cells}
      </svg>
      <div class="flex items-center justify-end gap-1 mt-2 text-[0.65rem] opacity-75" aria-hidden="true">
        <span class="mr-1">${t.less}</span>
        ${[0, 1, 2, 3, 4].map(
          (l) => html`<svg viewBox="0 0 10 10" class="size-2.5"><rect width="10" height="10" class="gh-day gh-l${l}"></rect></svg>`,
        )}
        <span class="ml-1">${t.more}</span>
      </div>
    </figure>
  `;
}

export default function githubSidebar(ctx: RenderCtx, stats: GithubStats = githubStats) {
  const { github: t } = ctx.t;
  const fmt = new Intl.NumberFormat(ctx.lang);
  const updated = new Intl.DateTimeFormat(ctx.lang, { dateStyle: "medium", timeZone: "UTC" }).format(utc(stats.updatedAt));

  return sidebar({
    id: SIDEBAR_IDS.github,
    title: t.title,
    aside: `@${stats.user}`,
    close: ctx.t.sidebar.close,
    body: html`
      <p class="flex flex-col border-b border-stone-400 pb-4">
        <span class="sidebar-number">${fmt.format(stats.prsMerged30d)}</span>
        <span class="text-sm text-pretty">${t.prsMerged}</span>
      </p>

      ${monthlyChart(ctx, stats)} ${contributionCalendar(ctx, stats)}
    `,
    note: `${t.updated} ${updated}`,
    action: sidebarLink(t.viewOnGithub, CONTACT.github),
  });
}

import { html, raw } from "hono/html";
import { ArrowUpRight, X } from "lucide-static";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import { githubStats, type GithubStats } from "../github/stats";

/** The drawer's id: links with data-github-sidebar open it (src/client/github-sidebar.js). */
export const GITHUB_SIDEBAR_ID = "github-sidebar";

const DAY_MS = 86_400_000;

/** Commits per week as bars, oldest on the left; the current week in the accent. */
function weeklyChart(ctx: RenderCtx, stats: GithubStats) {
  const { github: t } = ctx.t;
  const weeks = stats.commits.weekly;
  const max = Math.max(1, ...weeks);
  const fmt = new Intl.NumberFormat(ctx.lang);
  const dateFmt = new Intl.DateTimeFormat(ctx.lang, { month: "short", day: "numeric", timeZone: "UTC" });
  const end = Date.parse(`${stats.updatedAt}T00:00:00Z`);

  // Each bar is 3 units wide on a 4-unit pitch; the box is 40 units tall. The
  // SVG stretches to the panel's width, which is fine for rectangles.
  const H = 40;
  const bars = weeks.map((n, i) => {
    const weeksBack = weeks.length - 1 - i;
    const start = new Date(end - (weeksBack * 7 + 6) * DAY_MS);
    // A week with nothing still leaves a tick on the line, so the year reads as a year.
    const h = n === 0 ? 0.6 : Math.max(1.5, (n / max) * H);
    const label = t.weekLabel.replace("{date}", dateFmt.format(start)).replace("{count}", fmt.format(n));
    return html`<rect
      x="${i * 4}"
      y="${H - h}"
      width="3"
      height="${h}"
      class="${weeksBack === 0 ? "gh-bar gh-bar-now" : "gh-bar"}"
      ><title>${label}</title></rect
    >`;
  });

  const summary = t.chartSummary
    .replace("{total}", fmt.format(stats.commits.year))
    .replace("{max}", fmt.format(max));

  return html`
    <figure class="gh-chart">
      <figcaption class="text-md italic mb-2">${t.weeklyTitle}</figcaption>
      <svg
        viewBox="0 0 ${weeks.length * 4 - 1} ${H}"
        preserveAspectRatio="none"
        role="img"
        aria-label="${summary}"
        class="block w-full h-20 border-b border-stone-400"
      >
        ${bars}
      </svg>
      <div class="flex justify-between mt-1 text-xs opacity-75" aria-hidden="true">
        <span>${t.yearAgo}</span><span>${t.thisWeek}</span>
      </div>
    </figure>
  `;
}

function stat(value: string, label: string, big = false) {
  return html`<div class="flex flex-col">
    <dt class="order-2 text-sm text-pretty">${label}</dt>
    <dd class="${big ? "gh-number gh-number-big" : "gh-number"}">${value}</dd>
  </div>`;
}

export default function githubSidebar(ctx: RenderCtx, stats: GithubStats = githubStats) {
  const { github: t } = ctx.t;
  const fmt = new Intl.NumberFormat(ctx.lang);
  const updated = new Intl.DateTimeFormat(ctx.lang, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${stats.updatedAt}T00:00:00Z`),
  );
  const prs = stats.prsMerged30d.own + stats.prsMerged30d.requested;
  const maxLang = Math.max(1, ...stats.languages.map((l) => l.repos));

  // `side` is a placeholder: the client sets right or bottom by the viewport
  // before each opening. Content and backdrop start hidden so nothing shows
  // before the elements upgrade, and they only upgrade once a GitHub link is
  // approached, when the client loads the drawer.
  return html`
    <ui-drawer id="${GITHUB_SIDEBAR_ID}" side="right" class="gh-drawer">
      <ui-drawer-backdrop hidden class="gh-backdrop"></ui-drawer-backdrop>
      <ui-drawer-content hidden class="gh-sheet text-stone-800 dark:text-stone-100">
        <div class="gh-grip" aria-hidden="true"></div>
        <header class="flex items-start justify-between gap-4 px-6 pt-6 md:pt-10 pb-4">
          <div>
            <ui-drawer-title class="block text-3xl font-light">${t.title}</ui-drawer-title>
            <ui-drawer-description class="block text-sm mt-1"
              >@${stats.user} · ${t.description}</ui-drawer-description
            >
          </div>
          <ui-drawer-close>
            <button
              type="button"
              aria-label="${t.close}"
              class="interactive flex items-center justify-center size-8 -mr-2
                hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-current [&>svg]:w-5 [&>svg]:h-5"
            >
              ${raw(X)}
            </button>
          </ui-drawer-close>
        </header>

        <div class="gh-scroll flex flex-col gap-8 px-6 pb-6">
          <dl class="flex flex-col gap-6">
            <div class="flex flex-col border-b border-stone-400 pb-6">
              ${stat(fmt.format(prs), t.prsMerged, true)}
              <p class="order-3 text-xs opacity-75 mt-1 text-pretty">${t.prsNote}</p>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-5">
              ${stat(fmt.format(stats.commits.year), t.commitsYear)}
              ${stat(fmt.format(stats.commits.last30d), t.commits30d)}
              ${stat(fmt.format(stats.publicRepos), t.publicRepos)}
              ${stat(fmt.format(stats.stars), t.stars)}
            </div>
          </dl>

          ${weeklyChart(ctx, stats)}

          ${stats.languages.length
            ? html`<section>
                <h3 class="text-md italic mb-2">${t.languages}</h3>
                <ul class="flex flex-col gap-1.5 text-sm">
                  ${stats.languages.map(
                    (lang) => html`<li class="grid grid-cols-[7rem_1fr_1.5rem] items-center gap-3">
                      <span>${lang.name}</span>
                      <span class="gh-lang-bar" style="--w:${((lang.repos / maxLang) * 100).toFixed(1)}%"></span>
                      <span class="text-right tabular-nums opacity-75">${fmt.format(lang.repos)}</span>
                    </li>`,
                  )}
                </ul>
              </section>`
            : null}
        </div>

        <footer class="gh-actions flex items-center justify-between gap-4 px-6 py-4 border-t border-stone-400">
          <span class="text-xs opacity-75">${t.updated} ${updated}</span>
          <a
            class="interactive flex shrink-0 items-center gap-1 whitespace-nowrap w-fit border border-black dark:border-white px-3 py-1.5 text-sm
              hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black
              focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black
              [&>svg]:w-4 [&>svg]:h-4"
            href="${CONTACT.github}"
            target="_blank"
            rel="noopener noreferrer"
            >${t.viewOnGithub} ${raw(ArrowUpRight)}</a
          >
        </footer>
      </ui-drawer-content>
    </ui-drawer>
  `;
}

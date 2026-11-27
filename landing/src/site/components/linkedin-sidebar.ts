import { html } from "hono/html";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import { linkedinProfile, type LinkedinProfile } from "../linkedin/profile";
import { SIDEBAR_IDS, sidebar, sidebarLink } from "./sidebar";

const utc = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`);

/** "in/emiliacb", from the profile's URL. */
const handle = new URL(CONTACT.linkedin).pathname.replace(/^\/|\/$/g, "");

/**
 * The jobs before the current one, as a timeline: a rule down the left with a
 * dot per job, newest on top, the years in the cotas' face.
 */
function timeline(ctx: RenderCtx, jobs: LinkedinProfile["experience"]) {
  const { linkedin: t } = ctx.t;
  const years = (job: LinkedinProfile["experience"][number]) => {
    const from = job.from.slice(0, 4);
    const to = job.to ? job.to.slice(0, 4) : t.present;
    return from === to ? from : `${from}–${to}`;
  };

  return html`
    <figure>
      <figcaption class="text-sm sm:text-base italic mb-2">${t.before}</figcaption>
      <ol class="li-timeline">
        ${jobs.map(
          (job) => html`<li class="li-job">
            <span class="flex items-baseline justify-between gap-3">
              <span class="font-medium text-sm">${job.company}</span>
              <span class="li-years">${years(job)}</span>
            </span>
            <span class="block text-xs opacity-80">${job.role[ctx.lang]}</span>
          </li>`,
        )}
      </ol>
    </figure>
  `;
}

/** The latest post's opening lines, in the language it was written in, and a link to the rest. */
function latestPost(ctx: RenderCtx, post: LinkedinProfile["latestPost"]) {
  const { linkedin: t } = ctx.t;
  const date = new Intl.DateTimeFormat(ctx.lang, { dateStyle: "medium", timeZone: "UTC" }).format(utc(post.date));

  return html`
    <figure>
      <figcaption class="text-sm sm:text-base italic mb-2">${t.latestPost}</figcaption>
      <article lang="${post.lang}" class="flex flex-col gap-3 border border-stone-400 p-4">
        <p class="text-sm text-pretty">${post.lines.map((line, i) => (i ? html`<br />${line}` : line))}</p>
        <span class="flex items-center justify-between gap-3 text-xs">
          <time datetime="${post.date}" class="opacity-75">${date}</time>
          <a
            class="sidebar-invert interactive underline underline-offset-4 px-1 -mr-1 focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black"
            href="${post.url}"
            target="_blank"
            rel="noopener noreferrer"
            >${t.readPost} ↗</a
          >
        </span>
      </article>
    </figure>
  `;
}

export default function linkedinSidebar(ctx: RenderCtx, profile: LinkedinProfile = linkedinProfile) {
  const { linkedin: t } = ctx.t;
  const [current, ...before] = profile.experience;
  const since = new Intl.DateTimeFormat(ctx.lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    utc(`${current.from}-01`),
  );

  return sidebar({
    id: SIDEBAR_IDS.linkedin,
    title: t.title,
    aside: handle,
    close: ctx.t.sidebar.close,
    body: html`
      <p class="flex flex-col gap-1 border-b border-stone-400 pb-4">
        <span class="sidebar-number sidebar-word flex items-center gap-3"
          >${current.logo ? html`<img src="${current.logo}" alt="" class="h-[0.8em] w-auto shrink-0" />` : null}${current.company}</span>
        <span class="text-sm text-pretty">${t.since.replace("{role}", current.role[ctx.lang]).replace("{date}", since)}</span>
      </p>
      ${timeline(ctx, before)} ${latestPost(ctx, profile.latestPost)}
    `,
    note: handle,
    action: sidebarLink(t.viewOnLinkedin, CONTACT.linkedin),
  });
}

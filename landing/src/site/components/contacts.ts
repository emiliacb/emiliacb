import { html, raw } from "hono/html";
import { Linkedin, Github, Calendar } from "lucide-static";
import { CONTACT } from "../../shared/site";
import type { RenderCtx } from "../context";
import emailLink from "./email-link";

type ContactOptions = {
  columnMode?: boolean;
};

function contactColumn(ctx: RenderCtx) {
  const { contact: c } = ctx.t;

  return html`
    <ul class="flex flex-col gap-1">
      <li>
        ${emailLink({ email: CONTACT.email, lang: ctx.lang, label: c.email })}
      </li>
      <li>
        <a class="interactive hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 py-0.5 -ml-1" href="${CONTACT.linkedin}" target="_blank"
          >${c.linkedin}</a
        >
      </li>
      <li>
        <a class="interactive hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 py-0.5 -ml-1" href="${CONTACT.github}" target="_blank">${c.github}</a>
      </li>
      <li class="underline underline-offset-4 mt-1">
        <a class="hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 pt-1 pb-2 -ml-1" href="${CONTACT.calendar}" target="_blank">
          ${c.scheduleFull}
        </a>
      </li>
    </ul>
  `;
}

export default function contact(ctx: RenderCtx, { columnMode = false }: ContactOptions = {}) {
  if (columnMode) {
    return contactColumn(ctx);
  }

  const { contact: c } = ctx.t;

  return html`
    <ul
      class="flex items-center md:flex-row-reverse py-8 md:-ml-2 justify-between md:gap-6 w-full md:w-fit"
    >
      <li>
        <a
          class="interactive flex gap-2 w-fit border border-black dark:border-white px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black"
          href="${CONTACT.calendar}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${c.scheduleFull}"
          >${raw(Calendar)}
          <span class="text-xs md:text-sm">${c.schedule}</span
          ><span class="-ml-1 hidden md:block text-sm"
            >${c.scheduleAction}</span
          >
        </a>
      </li>
      <li>
        ${emailLink({ email: CONTACT.email, lang: ctx.lang, label: c.email, variant: "icon" })}
      </li>
      <li>
        <a
          class="interactive flex w-fit border border-transparent px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black"
          href="${CONTACT.linkedin}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${c.linkedin}"
          >${raw(Linkedin)}</a
        >
      </li>
      <li>
        <a
          class="interactive flex w-fit border border-transparent px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black"
          href="${CONTACT.github}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${c.github}"
          >${raw(Github)}</a
        >
      </li>
    </ul>
  `;
}

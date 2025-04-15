import { html, raw } from "hono/html";
import { Mail, Linkedin, Github, Calendar } from "lucide-static";

type ContactProps = {
  lang: string;
  columnMode?: boolean;
};

// TODO: Implement i18n library
const scheduleCaption: Record<string, string[]> = {
  en: ["Schedule", "a Meeting", "Schedule a Meeting"],
  es: ["Agendar", "una consulta", "Agendar una consulta"],
};

export function contactColumn({ lang }: ContactProps) {
  return html`
    <ul class="flex flex-col gap-1">
      <li>
        <a class="hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black px-1 py-0.5 -ml-1" href="mailto:emiliacabralb@gmail.com" target="_blank">Email</a>
      </li>
      <li>
        <a class="hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black px-1 py-0.5 -ml-1" href="https://www.linkedin.com/in/emiliacb" target="_blank"
          >LinkedIn</a
        >
      </li>
      <li>
        <a class="hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black px-1 py-0.5 -ml-1" href="https://github.com/emiliacb" target="_blank">GitHub</a>
      </li>
      <li class="underline underline-offset-4 mt-1">
        <a class="hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black px-1 pt-1 pb-2 -ml-1" href="https://calendly.com/emilia-cb" target="_blank">
          ${scheduleCaption[lang][2]}
        </a>
      </li>
    </ul>
  `;
}

export function contact({ lang, columnMode = false }: ContactProps) {
  if (columnMode) {
    return contactColumn({ lang });
  }

  return html`
    <ul
      class="flex md:flex-row-reverse py-8 md:-ml-2 justify-between md:gap-6 w-full md:w-fit"
    >
      <li>
        <a
          class="flex gap-2 w-fit border border-black dark:border-white px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white lg:light-gradient-projection before:bottom-[-1px] before:left-[-1px] [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]"
          href="https://calendly.com/emilia-cb"
          target="_blank"
          norel="noreferrer"
          aria-label="${scheduleCaption[lang][2]}"
          >${raw(Calendar)}
          <span class="text-xs md:text-sm">${scheduleCaption[lang][0]}</span
          ><span class="-ml-1 hidden md:block text-sm"
            >${scheduleCaption[lang][1]}</span
          >
        </a>
      </li>
      <li>
        <a
          class="flex w-fit border border-transparent px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white"
          href="mailto:emiliacabralb@gmail.com"
          target="_blank"
          norel="noreferrer"
          aria-label="emiliacabralb@gmail.com"
          >${raw(Mail)}</a
        >
      </li>
      <li>
        <a
          class="flex w-fit border border-transparent px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white"
          href="https://www.linkedin.com/in/emiliacb"
          target="_blank"
          norel="noreferrer"
          aria-label="LinkedIn"
          >${raw(Linkedin)}</a
        >
      </li>
      <li>
        <a
          class="flex w-fit border border-transparent px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white"
          href="https://github.com/emiliacb"
          target="_blank"
          norel="noreferrer"
          aria-label="GitHub"
          >${raw(Github)}</a
        >
      </li>
    </ul>
  `;
}

export default contact;

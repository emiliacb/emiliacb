import { html, raw } from "hono/html";
import { Mail, Linkedin, Github, Calendar } from "lucide-static";

export default function contact({ lang }: { lang: string }) {
  // TODO: Implement i18n library
  const scheduleCaption: Record<string, string[]> = {
    en: ["Schedule", "a Meeting", "Schedule a Meeting"],
    es: ["Agendar", "una consulta", "Agendar una consulta"],
  };

  return html`
    <ul
      class="flex md:flex-row-reverse w-full md:w-fit justify-between md:gap-6 py-8 md:-ml-2"
    >
      <li>
        <a
          class="flex gap-2 w-fit border border-black dark:border-white px-2 py-1 hover:bg-black dark:hover:bg-white hover:text-white hover:border-black dark:hover:text-black dark:hover:border-white light-gradient-projection before:bottom-[-1px] before:left-[-1px] [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]"
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

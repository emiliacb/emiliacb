import { html, raw } from "hono/html";
import { Mail, Linkedin, Github, Calendar } from "lucide-static";

export default function contact() {
  return html`
    <ul
      class="flex flex-wrap items-center w-full md:w-fit justify-between gap-4 md:gap-6 py-8 -ml-2"
    >
      <li>
        <a
          class="flex w-fit border border-transparent dark:border-white px-2 py-1 hover:bg-black hover:text-white hover:border-black"
          href="mailto:emiliacabralb@gmail.com"
          target="_blank"
          norel="noreferrer"
          aria-label="emiliacabralb@gmail.com"
          >${raw(Mail)}</a
        >
      </li>
      <li>
        <a
          class="flex w-fit border border-transparent dark:border-white px-2 py-1 hover:bg-black hover:text-white hover:border-black"
          href="https://www.linkedin.com/in/emiliacb"
          target="_blank"
          norel="noreferrer"
          aria-label="LinkedIn"
          >${raw(Linkedin)}</a
        >
      </li>
      <li>
        <a
          class="flex w-fit border border-transparent dark:border-white px-2 py-1 hover:bg-black hover:text-white hover:border-black"
          href="https://github.com/emiliacb"
          target="_blank"
          norel="noreferrer"
          aria-label="GitHub"
          >${raw(Github)}</a
        >
      </li>
      <li>
        <a
          class="flex gap-2 w-fit border border-black dark:border-white px-2 py-1 hover:bg-black hover:text-white hover:border-black"
          href="https://calendly.com/emilia-cb"
          target="_blank"
          norel="noreferrer"
          aria-label="Schedule a Meeting"
          >${raw(Calendar)}
          <span class="text-sm">Schedule a Meeting</span>
        </a>
      </li>
    </ul>
  `;
}

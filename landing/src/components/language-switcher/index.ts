import { html, raw } from "hono/html";
import { Languages } from "lucide-static";

// TODO: Implement i18n library
const wordings: Record<string, string> = {
  en: "Language",
  es: "Idioma",
};

export default function languageSwitcher({ lang }: { lang: string }) {
  return html`
    <div
      class="hidden lg:block fixed bottom-4 right-4 z-50 text-stone-800 dark:text-stone-100"
    >
      <dropdown-trigger variant="icon-only" hide-on-scroll open-up label="${wordings[lang]}">
        <span slot="icon" class="[&>svg]:w-4 [&>svg]:h-4">${raw(Languages)}</span>
        <div class="flex flex-col m-auto p-[0.2rem] bg-black dark:bg-white shadow-lg w-fit">
          <a
            class="block text-sm px-[0.2rem] py-[0.2rem] text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
            href="/en"
            >English<span aria-label="Flag emoji" class="ml-[0.4rem]">🇺🇸</span></a
          >
          <a
            class="block text-sm px-[0.2rem] py-[0.2rem] text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
            href="/es"
            >Español<span aria-label="Flag emoji" class="ml-[0.4rem]">🇪🇸</span></a
          >
        </div>
      </dropdown-trigger>
    </div>
  `;
}

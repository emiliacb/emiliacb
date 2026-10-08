import { html, raw } from "hono/html";
import { Languages } from "lucide-static";
import { LANGS } from "../../shared/lang";
import type { RenderCtx } from "../context";

const LINK_CLASS =
  "block text-sm px-[0.2rem] py-[0.2rem] text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap";

// Flag emoji per language, in the order the menu lists them.
const FLAGS = { en: "🇺🇸", es: "🇪🇸" } as const;

/** One link per language. data-set-lang lets the client script remember the choice in a cookie. */
export function languageLinks(ctx: RenderCtx) {
  const { language } = ctx.t;

  return LANGS.map(
    (lang) => html`<a class="${LINK_CLASS}" href="/${lang}" data-set-lang="${lang}"
      >${language.names[lang]}<span aria-label="${language.flagEmoji}" class="ml-[0.4rem]">${FLAGS[lang]}</span></a
    >`
  );
}

export default function languageSwitcher(ctx: RenderCtx) {
  return html`
    <div
      class="hidden lg:block fixed bottom-4 left-4 z-50 text-stone-800 dark:text-stone-100"
    >
      <dropdown-trigger variant="icon-only" hide-on-scroll open-up align-start label="${ctx.t.language.label}">
        <span slot="icon" class="[&>svg]:w-4 [&>svg]:h-4">${raw(Languages)}</span>
        <div class="flex flex-col m-auto p-[0.2rem] bg-black dark:bg-white shadow-lg w-fit">
          ${languageLinks(ctx)}
        </div>
      </dropdown-trigger>
    </div>
  `;
}

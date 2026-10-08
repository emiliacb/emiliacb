import { html } from "hono/html";
import { SITE_TITLE } from "../../shared/site";
import type { RenderCtx } from "../context";

const MENU_LINK =
  "block px-4 py-2 text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap";

export default function navbar(ctx: RenderCtx) {
  const { lang } = ctx;
  const { nav } = ctx.t;

  return html`
    <nav
      class="sticky px-4 sm:pl-6 sm:pr-8 top-0 pt-2 md:pt-4 pb-2 mb-4 md:mb-0 flex flex-wrap mt-4 md:mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-100/70 dark:bg-stone-800/80 backdrop-blur-sm z-50 "
      aria-label="${nav.mainNavigation}"
    >
      <div
        class="pointer-events-none border-b border-stone-400 light-gradient-projection !absolute bottom-0 left-0 h-12 w-full before:border-b-[2px] before:-bottom-[1px] before:border-green-300 dark:before:border-blue-700 before:!rotate-0 before:blur-0 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]"
      ></div>
      <a
        class="sr-only focus:not-sr-only focus:absolute focus:top-1 focus:left-1 focus:p-3 text-white bg-black"
        href="#content"
        >${nav.skipToContent}</a
      >
      <a
        class="interactive px-2 py-1 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit font-[500] text-xl"
        href="/${lang}"
        aria-label="${nav.brand}"
        ><span aria-hidden>${SITE_TITLE}</span></a
      >
      <div
        class="flex text-sm h-fit items-center sm:text-base space-x-1 md:space-x-4"
      >
        <div class="relative md:hidden text-stone-800 dark:text-stone-100">
          <dropdown-trigger label="${nav.about}">
            <div class="flex flex-col p-2 bg-black dark:bg-white shadow-lg">
              <a class="${MENU_LINK}" href="/${lang}/about">${nav.whoIAm}</a>
              <a class="${MENU_LINK}" href="/${lang}/services">${nav.whatIDo}</a>
            </div>
          </dropdown-trigger>
        </div>
        <a
          class="interactive hidden md:block px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/about"
          >${nav.whoIAm}</a
        >
        <a
          class="interactive hidden md:block px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/services"
          >${nav.whatIDo}</a
        >
        <a
          class="interactive px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/blog"
          >${nav.journal}</a
        >
      </div>
    </nav>
  `;
}

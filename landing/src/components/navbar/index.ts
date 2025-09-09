import { html } from "hono/html";

export default function navbar({ lang }: { lang: string }) {
  // TODO: Implement i18n library
  const wordings: Record<string, string[]> = {
    en: [
      "Skip to content",
      "Who I Am",
      "What I Do",
      "Journal",
      "About",
    ],
    es: [
      "Saltar al contenido",
      "Quién Soy",
      "Qué Hago",
      "Diario",
      "Sobre mí",
    ],
  };

  return html`
    <nav
      class="sticky px-4 sm:pl-6 sm:pr-8 top-0 pt-2 md:pt-4 pb-2 mb-4 md:mb-0 flex flex-wrap mt-4 md:mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-100/70 dark:bg-stone-800/80 backdrop-blur-sm z-50 "
    >
      <div
        class="pointer-events-none border-b border-stone-400 light-gradient-projection !absolute bottom-0 left-0 h-12 w-full before:border-b-[2px] before:-bottom-[1px] before:border-green-300 dark:before:border-blue-700 before:!rotate-0 before:blur-0 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]"
      ></div>
      <a
        class="sr-only focus:not-sr-only focus:absolute top-1 left-1 focus:p-3 text-white bg-black"
        href="#content"
        >${wordings[lang][0]}</a
      >
      <a
        class="px-2 py-1 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit font-[500] text-xl"
        href="/${lang}"
        aria-label="Emilia"
        ><span aria-hidden>ємιℓιαċв</span></a
      >
      <div
        class="flex text-sm h-fit items-center sm:text-base space-x-1 md:space-x-4"
      >
        <div class="relative md:hidden text-stone-800 dark:text-stone-100">
          <dropdown-trigger label="${wordings[lang][4]}">
            <div class="flex flex-col p-2 bg-black dark:bg-white shadow-lg">
              <a
                class="block px-4 py-2 text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
                href="/${lang}/about"
                >${wordings[lang][1]}</a
              >
              <a
                class="block px-4 py-2 text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
                href="/${lang}/services"
                >${wordings[lang][2]}</a
              >
            </div>
          </dropdown-trigger>
        </div>
        <a
          class="hidden md:block px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/about"
          >${wordings[lang][1]}</a
        >
        <a
          class="hidden md:block px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/services"
          >${wordings[lang][2]}</a
        >
        <a
          class="px-1 md:px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/blog"
          >${wordings[lang][3]}</a
        >
      </div>
    </nav>
  `;
}

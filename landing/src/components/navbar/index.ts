import { html } from "hono/html";

export default function navbar({ lang }: { lang: string }) {
  // TODO: Implement i18n library
  const wordings: Record<string, string[]> = {
    en: ["Skip to content", "Who I Am", "What I Do", "Stories"],
    es: ["Saltar al contenido", "Quién Soy", "Qué Hago", "Historias"],
  };

  return html`
    <nav
      class="sticky px-4 sm:pl-6 sm:pr-8 top-0 pt-2 md:pt-4 pb-2 mb-4 md:mb-0 flex flex-wrap mt-4 md:mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-100/70 backdrop-blur-sm dark:bg-stone-800/80 border-b border-stone-400 z-50 light-gradient-projection before:border-b-[2px] before:-bottom-[1px] before:border-green-300 dark:before:border-blue-700 before:!rotate-0 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)]"
    >
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
        <a
          class="px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/about"
          >${wordings[lang][1]}</a
        >
        <a
          class="px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/services"
          >${wordings[lang][2]}</a
        >
        <!-- <a
          class="px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/${lang}/blog"
          >${wordings[lang][3]}</a
        > -->
      </div>
    </nav>
  `;
}

import { html } from "hono/html";

export default function navbar() {
  return html`
    <nav
      class="sticky px-4 sm:pl-6 sm:pr-8 top-0 pt-2 md:pt-4 pb-2 mb-4 md:mb-0 flex flex-wrap mt-4 md:mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-100/70 backdrop-blur-sm dark:bg-stone-800/80 border-b border-stone-400 z-50"
    >
      <a
        class="sr-only focus:not-sr-only focus:absolute top-1 left-1 focus:p-3 text-white bg-black"
        href="#content"
        >skip to content</a
      >
      <a
        class="px-2 py-1 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit font-[500] text-xl"
        href="/"
        aria-label="Emilia"
        ><span aria-hidden>ємιℓιαċв</span></a
      >
      <div
        class="flex text-sm h-fit items-center sm:text-base space-x-1 md:space-x-4"
      >
        <a
          class="px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/about"
          >Who I Am</a
        >
        <a
          class="px-2 py-2 -my-1 hover:bg-black hover:text-white hover:border-black dark:hover:bg-white dark:hover:text-black dark:hover:border-white h-fit"
          href="/services"
          >What I Offer</a
        >
      </div>
    </nav>
  `;
}

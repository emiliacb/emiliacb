import { html } from "hono/html";

export default function navbar() {
  return html`
  <nav
  class="sticky top-0 pt-2 md:pt-4 pb-2 mb-4 md:mb-0 flex mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-200/70 backdrop-blur-sm dark:bg-stone-800/80 border-b border-stone-400 z-50"
  >
      <a class="sr-only focus:not-sr-only focus:absolute top-1 left-1 focus:p-3 text-white bg-black" href="#content">skip to content</a>
      <a class="px-2 py-0 h-fit font-[500] text-xl" href="/">ємιℓιαċв</a>
      <div class="flex space-x-4">
        <!-- <a class="px-2 py-0 h-fit" href="/about">about</a>
        <a class="px-2 py-0 h-fit" href="/services">services</a> -->
      </div>
    </nav>
  `;
}

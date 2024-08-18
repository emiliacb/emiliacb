import { html } from "hono/html";

export default function navbar() {
  return html`
    <a class="sr-only focus:not-sr-only focus:absolute focus:p-3 bg-stone-800 text-white" href="#content">skip to content</a>
    <nav
      class="sticky top-0 pt-4 pb-2 mb-4 md:mb-0 flex mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-200/70 backdrop-blur-sm dark:bg-stone-800/80 border-b border-stone-400"
    >
      <a class="px-2 py-0 h-fit font-[500] text-lg" href="/">emiliacb</a>
      <div class="flex space-x-4">
        <a class="px-2 py-0 h-fit" href="/about">about</a>
        <a class="px-2 py-0 h-fit hidden md:block" href="/blog">blog</a>
        <a class="px-2 py-0 h-fit" href="/courses">courses</a>
        <a class="px-2 py-0 h-fit hidden md:block" href="/services">services</a>
      </div>
    </nav>
    <div class="flex justify-end py-2 md:hidden ml-auto sticky top-[3.3rem] w-full bg-stone-200/70 backdrop-blur-sm dark:bg-stone-800">
      <a class="px-2 py-0 h-fit" href="/blog">blog</a>
      <a class="px-2 py-0 h-fit" href="/services">services</a>
    </div>
  `;
}

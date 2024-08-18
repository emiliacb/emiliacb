import { html } from "hono/html";

export default function navbar() {
  return html`
    <nav
      class="sticky top-0 pt-4 pb-4 mb-4 md:mb-0 md:pb-2 flex mt-12 justify-between w-full max-w-[60rem] m-auto bg-stone-100 dark:bg-stone-800 border-b"
    >
      <a class="px-2 py-0 h-fit font-[500] text-lg" href="/">emiliacb</a>
      <div class="flex space-x-4">
        <a class="px-2 py-0 h-fit" href="/about">about</a>
        <a class="px-2 py-0 h-fit" href="/courses">courses</a>
        <a class="px-2 py-0 h-fit hidden md:block" href="/blog">blog</a>
        <a class="px-2 py-0 h-fit hidden md:block" href="/services">services</a>
      </div>
    </nav>
    <div class="md:hidden ml-auto">
      <a class="px-2 py-0 h-fit " href="/blog">blog</a>
      <a class="px-2 py-0 h-fit " href="/services">services</a>
    </div>
  `;
}

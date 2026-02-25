import { html } from "hono/html";
import { raw } from "hono/html";
import { Languages } from "lucide-static";
import contact from "../contacts";

const DELTA_HEIGHT = 200;

type FooterProps = {
  lang: string;
};

const routes = [
  { name: "Home", path: "" },
  { name: "About", path: "/about" },
  { name: "Blog", path: "/blog" },
  { name: "Services", path: "/services" },
];

// TODO: Implement i18n library
const languagesCaption: Record<string, string[]> = {
  en: ["Language"],
  es: ["Idioma"],
};

function footerContent({ lang }: FooterProps) {
  const baseLangPath = `/${lang}`;

  return html`
    <div>
      <div
        class="mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4 py-6 md:text-left"
      >
        <!-- Column 1: Logo and tagline -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-xl font-bold mb-4">ємιℓιαċв</h3>
          <p class="text-sm pr-6 lg:pr-24 text-pretty">
            Senior Software Engineer with a product mindset.
          </p>
          <div class="flex mt-2 relative w-fit z-10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black pl-1 -ml-1 shadow-none border-none py-[0.2rem]">
            <div class="scale-[0.7] -ml-1 mr-1 mt-[2px]">${raw(Languages)}</div>
            <dropdown-trigger variant="small" label="${languagesCaption[lang][0]}">
              <div class="flex flex-col m-auto p-[0.2rem] bg-black dark:bg-white shadow-lg w-fit">
                <a
                  class="block text-sm px-[0.2rem] py-[0.2rem] text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
                  href="/en"
                >English<span aria-label="Flag emoji" class="ml-[0.4rem]">🇺🇸</span></a>
                <a
                  class="block text-sm px-[0.2rem] py-[0.2rem] text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap"
                  href="/es"
                >Español<span aria-label="Flag emoji" class="ml-[0.4rem]">🇪🇸</span></a>
              </div>
            </dropdown-trigger>
          </div>
        </div>

        <!-- Column 2: Navigation links -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-md italic mb-1 md:mb-2">Navigation</h4>
          <nav>
            <ul class="flex flex-col">
              ${routes.map(
                (route) => html`<li>
                  <a
                    href="${baseLangPath}${route.path}"
                    class="text-sm hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 py-0.5 -ml-1"
                    >${route.name}</a
                  >
                </li>`
              )}
            </ul>
          </nav>
        </div>

        <!-- Column 3: Contact information -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-md italic mb-1 md:mb-2">Contact</h4>
          <div class="text-sm">${contact({ lang, columnMode: true })}</div>
        </div>
      </div>

      <!-- Copyright -->
      <div
        class="w-full text-center pt-8 text-xs opacity-75"
      >
        © ${new Date().getFullYear()} Licensed under Apache 2.0 and CC BY 4.0.
      </div>
    </div>
  `;
}

function footerFixed({ lang }: FooterProps) {
  return html`<footer
    class="fixed bottom-0 h-fit py-4 pb-8 z-0 w-full flex px-4 sm:px-8 justify-center bg-yellow-300 dark:bg-blue-900 items-center"
    style="margin-top: ${DELTA_HEIGHT}px; padding-top: calc(${DELTA_HEIGHT}px + 2rem)"
  >
    ${footerContent({ lang })}
  </footer>`;
}

export default function footer({ lang }: FooterProps) {
  return html`<div class="opacity-0 py-8">${footerContent({ lang })}</div>
    <div>${footerFixed({ lang })}</div>`;
}

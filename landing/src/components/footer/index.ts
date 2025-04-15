import { html } from "hono/html";
import contact from "../contacts";

type FooterProps = {
  lang: string;
};

const routes = [
  { name: "Home", path: "" },
  { name: "About", path: "/about" },
  { name: "Blog", path: "/blog" },
  { name: "Services", path: "/services" },
];

function footerContent({ lang }: FooterProps) {
  const baseLangPath = `/${lang}`;

  return html`
    <div>
      <div
        class="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4 py-6"
      >
        <!-- Column 1: Logo and tagline -->
        <div class="flex flex-col">
          <h4 class="text-xl font-bold mb-4">ємιℓιαċв</h3>
          <p class="text-sm pr-8">
            Senior Software Engineer with a product mindset.
          </p>
        </div>

        <!-- Column 2: Navigation links -->
        <div class="flex flex-col">
          <h4 class="text-md italic mb-1 md:mb-2">Navigation</h4>
          <nav>
            <ul class="flex flex-col">
              ${routes.map(
                (route) => html`<li>
                  <a
                    href="${baseLangPath}${route.path}"
                    class="text-sm hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black px-1 py-0.5 -ml-1"
                    >${route.name}</a
                  >
                </li>`
              )}
            </ul>
          </nav>
        </div>

        <!-- Column 3: Contact information -->
        <div class="flex flex-col">
          <h4 class="text-md italic mb-1 md:mb-2">Contact</h4>
          <div class="text-sm">${contact({ lang, columnMode: true })}</div>
        </div>
      </div>

      <!-- Copyright -->
      <div
        class="w-full text-center py-4 text-xs opacity-75"
      >
        © ${new Date().getFullYear()} Licensed under Apache 2.0 and CC BY 4.0.
      </div>
    </div>
  `;
}

function footerFixed({ lang }: FooterProps) {
  return html`<footer
    class="fixed bottom-0 h-fit py-4 -mt-24 pt-32 pb-8 z-0 w-full flex px-4 sm:px-8 justify-center bg-yellow-300 dark:bg-blue-900 items-center"
  >
    ${footerContent({ lang })}
  </footer>`;
}

export default function footer({ lang }: FooterProps) {
  return html`<div class="opacity-0 py-8">${footerContent({ lang })}</div>
    <div>${footerFixed({ lang })}</div>`;
}

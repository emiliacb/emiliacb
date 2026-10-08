import { html, raw } from "hono/html";
import { Languages } from "lucide-static";
import { FOOTER_NAV, PAGES, SITE_TITLE } from "../../shared/site";
import type { RenderCtx } from "../context";
import contact from "./contacts";
import { languageLinks } from "./language-switcher";

function footerContent(ctx: RenderCtx) {
  const { footer, language, pages } = ctx.t;
  const baseLangPath = `/${ctx.lang}`;

  // Footer nav: the shared order from FOOTER_NAV, the pages' footer names and paths.
  const routes = FOOTER_NAV.map((id) => {
    const def = PAGES.find((page) => page.id === id);
    if (!def) throw new Error(`FOOTER_NAV names unknown page: ${id}`);
    return { name: pages[id].navTitle, path: def.path };
  });

  return html`
    <div>
      <div
        class="mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4 py-6 md:text-left"
      >
        <!-- Column 1: Logo and tagline -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-xl font-bold mb-4">${SITE_TITLE}</h4>
          <p class="text-sm pr-6 lg:pr-24 text-pretty">
            ${footer.tagline}
          </p>
          <dropdown-trigger class="mt-2 relative w-fit z-10 py-[0.2rem]" variant="small" label="${language.label}">
              <span slot="icon" class="scale-[0.7] -ml-1 mr-1 mt-[2px]">${raw(Languages)}</span>
              <div class="flex flex-col m-auto p-[0.2rem] bg-black dark:bg-white shadow-lg w-fit">
                ${languageLinks(ctx)}
              </div>
          </dropdown-trigger>
        </div>

        <!-- Column 2: Navigation links -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-md italic mb-1 md:mb-2">${footer.navigation}</h4>
          <nav aria-label="${footer.navigationLabel}">
            <ul class="flex flex-col">
              ${routes.map(
                (route) => html`<li>
                  <a
                    href="${baseLangPath}${route.path}"
                    class="interactive text-sm hover:bg-black hover:text-white hover:dark:bg-white hover:dark:text-black focus-visible:bg-black focus-visible:text-white focus-visible:dark:bg-white focus-visible:dark:text-black px-1 py-0.5 -ml-1"
                    >${route.name}</a
                  >
                </li>`
              )}
            </ul>
          </nav>
        </div>

        <!-- Column 3: Contact information -->
        <div class="flex flex-col lg:mx-auto">
          <h4 class="text-md italic mb-1 md:mb-2">${footer.contact}</h4>
          <div class="text-sm">${contact(ctx, { columnMode: true })}</div>
        </div>
      </div>

      <!-- Copyright -->
      <div
        class="w-full text-center pt-8 text-xs opacity-75"
      >
        © ${new Date().getFullYear()} ${footer.license}
      </div>
    </div>
  `;
}

export default function footer(ctx: RenderCtx) {
  // ponytail: no inset variant here. The classes were interpolated from
  // AI_LAYOUT, so Tailwind's scanner never saw them and never generated
  // them, and `html.ai-layout-enabled footer` in styles.css already
  // applies the offset/margins/radius, for both the SSR'd initial state and
  // the live toggle. No `w-full` either: a block-level box already fills its
  // container, and width:100% over-constrained the inset state so margin-right
  // was dropped and the right corner landed outside the overflow-x clip.
  //
  // The overlay rounds its bottom corners (--overlay-radius) once it is
  // scrolled past, and what shows through them is whatever sits behind it.
  // The negative margin runs the footer's background up under the overlay by
  // that radius, so the corners open onto the footer rather than the page
  // background, without changing how far the page scrolls; the padding gives
  // the height back, so the content still sits 2rem below the overlay's edge.
  return html`<footer
    class="sticky bottom-0 h-fit pb-8 z-0 flex px-4 sm:px-8 justify-center bg-yellow-300 dark:bg-blue-900 items-center"
    style="margin-top: calc(-1 * var(--overlay-radius)); padding-top: calc(var(--overlay-radius) + 2rem)"
  >
    ${footerContent(ctx)}
  </footer>`;
}

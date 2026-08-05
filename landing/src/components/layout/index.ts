import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";
import { config } from "dotenv";
import navbar from "../navbar";
import tree from "../tree";
import forest from "../forest";
import footer from "../footer";
import languageSwitcher from "../language-switcher";
import activityPanel from "../activity-panel";
import { AI_LAYOUT_ENABLED, AI_LAYOUT } from "./frame";

config();

const CACHE_VERSION = process.env.CACHE_VERSION!;

type LayoutProps = {
  siteData: {
    title: string;
    description: string;
    lang: string;
    image?: string;
    url?: string;
  };
  withFooter?: boolean;
  withIlustration?: boolean;

  children?: HtmlEscapedString | Promise<HtmlEscapedString>;
};

export default function layout({
  siteData,
  withFooter = true,
  withIlustration = false,

  children,
}: LayoutProps) {
  const SITE_URL = "https://emiliacabral.com";
  const SITE_NAME = "Emilia Cabral";
  const canonicalUrl = siteData.url ?? `${SITE_URL}/`;
  const rawImage = siteData.image ?? `${SITE_URL}/public/preview.png`;
  // Social scrapers require an absolute https URL; normalize relative paths.
  const ogImage = rawImage.startsWith("http")
    ? rawImage
    : `${SITE_URL}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;

  return html`
    <!DOCTYPE html>
    <html
      lang="${siteData.lang}"
      class="${AI_LAYOUT_ENABLED ? "ai-layout-enabled" : ""}"
      style="--ai-layout-top: ${AI_LAYOUT.top}; --ai-layout-right: ${AI_LAYOUT.right}; --ai-layout-bottom: ${AI_LAYOUT.bottom}; --ai-layout-left: ${AI_LAYOUT.left};"
    >
      <head>
        <script>
          // Keeps the AI layout across navigations inside the site (a multi-page
          // app, so the toggle would otherwise reset on every link click), and
          // only those. Clearing the flag on the other paths is the point: left
          // set, the next internal link click would bring the layout back after
          // the visitor had already been dropped out of it. Runs before paint so
          // there is no flash of the wrong layout.
          (function () {
            var nav = performance.getEntriesByType("navigation")[0];
            var fromInside =
              (!nav || nav.type !== "reload") &&
              document.referrer.indexOf(location.origin + "/") === 0;
            if (fromInside && localStorage.getItem("ai-layout-enabled") === "true") {
              document.documentElement.classList.add("ai-layout-enabled");
            } else {
              localStorage.removeItem("ai-layout-enabled");
            }
          })();
        </script>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>"
        />

        <!-- Primary Meta Tags -->
        <title>${siteData.title}</title>
        <meta name="title" content="${siteData.title}" />
        <meta name="description" content="${siteData.description}" />
        <meta name="cache-version" content="${CACHE_VERSION}" />
        <script type="speculationrules">
          {
            "prerender": [
              {
                "where": {
                  "and": [
                    { "href_matches": "/*" },
                    { "not": { "href_matches": "/public/*" } },
                    { "not": { "selector_matches": "[href^='#']" } },
                    { "not": { "selector_matches": "[target='_blank']" } },
                    { "not": { "selector_matches": "[rel~='nofollow']" } },
                    { "not": { "selector_matches": "[data-no-prerender]" } }
                  ]
                },
                "eagerness": "moderate"
              }
            ]
          }
        </script>

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="${SITE_NAME}" />
        <meta property="og:url" content="${canonicalUrl}" />
        <meta property="og:title" content="${siteData.title}" />
        <meta property="og:description" content="${siteData.description}" />
        <meta property="og:image" content="${ogImage}" />

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="${canonicalUrl}" />
        <meta property="twitter:title" content="${siteData.title}" />
        <meta
          property="twitter:description"
          content="${siteData.description}"
        />
        <meta property="twitter:image" content="${ogImage}" />

        <!-- Posthog -->
        <script src="/public/${CACHE_VERSION}/_posthog-bundle.js" defer></script>

        <!-- Apollo -->
        <script>function initApollo(){var n=Math.random().toString(36).substring(7),o=document.createElement("script");
o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,o.async=!0,o.defer=!0,
o.onload=function(){window.trackingFunctions.onLoad({appId:"698f6151f5837c0011c7b4b3"})},
document.head.appendChild(o)}initApollo();</script>

        <!-- Lottie -->
        <link
          rel="preload"
          href="/public/${CACHE_VERSION}/_dotlottie-bundle.js"
          as="script"
          crossorigin="anonymous"
        />

        <!-- Dropdown -->
        <script src="/public/${CACHE_VERSION}/_dropdown-bundle.js" defer></script>

        <!-- Email link -->
        <script src="/public/${CACHE_VERSION}/_email-link-bundle.js" defer></script>

        <!-- Google Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
          crossorigin="anonymous"
        />

        <!-- CSS -->
        <link rel="stylesheet" href="/public/${CACHE_VERSION}/_output.css" />
        <style>
          @keyframes move-out {
            from {
              opacity: 1;
              filter: blur(0);
            }

            to {
              opacity: 0;
              filter: blur(12px);
            }
          }

          @keyframes move-in {
            from {
              opacity: 0;
              transform: translateX(20%);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          #loading-bar {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            width: 0;
            background: #86efac;
            z-index: 9999;
            pointer-events: none;
          }

          @media (prefers-color-scheme: dark) {
            #loading-bar { background: #1d4ed8; }
          }

          #loading-bar.loading {
            animation: load-progress 2s ease-out forwards;
          }

          @keyframes load-progress {
            0% { width: 0; }
            20% { width: 40%; }
            50% { width: 70%; }
            80% { width: 85%; }
            100% { width: 95%; }
          }

          @view-transition {
            navigation: auto;
          }

          ::view-transition {
            pointer-events: none;
          }

          #content {
            view-transition-name: content;
            contain: paint;
          }

          /* A named element is captured into the top layer, where no ancestor
             overflow or border-radius clips it, and #content is ~6rem taller
             than the framed layout's viewport, so its snapshot spills over the
             gap and footer even with no transform. Dropping the name folds it
             back into the viewport-sized root snapshot, which cannot spill.
             The rules below then match nothing in this state. */
          html.ai-layout-enabled #content {
            view-transition-name: none;
          }

          html {
            scroll-behavior: auto;
          }

          @media (prefers-reduced-motion: no-preference) {
            html {
              scroll-behavior: smooth;
            }

            ::view-transition-old(content) {
              animation: 200ms cubic-bezier(0.55, 0, 1, 0.45) both move-out;
            }

            ::view-transition-new(content) {
              animation: 350ms cubic-bezier(0.23, 1, 0.32, 1) both move-in;
              animation-delay: 150ms;
            }
          }
        </style>
        <script>
          if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
          }
        </script>
      </head>

      <body class="text-stone-800 dark:text-stone-100 overscroll-none md:overscroll-auto">
        <div id="scroll-wrapper">
        <div id="loading-bar"></div>
        <div
          id="overlay-content"
          class="relative overflow-hidden shadow-lg flex flex-col min-h-static-screen bg-stone-100 z-10 dark:bg-stone-800 prose-h1:text-3xl"
        >
          <!--
            The gradient wash is off on the illustration page for now: it and
            the ruled ground plane were competing for the same corner.

            The element itself stays. src/client/gradient-distortion.js bails
            out entirely if it cannot find #gradient-bg, and it is the same
            pass that distorts the drawn tree, and removing the div would quietly
            take that with it. Without the paint classes this is an empty box
            that textures to nothing, and putting them back is the whole undo.
          -->
          <div
            id="gradient-bg"
            class="absolute -z-10 top-[25vh] h-[150vh] ${
              withIlustration
                ? "left-0 w-[130vw]"
                : "radial-green-gradient-right dark:radial-maroon-gradient-right right-0 w-[50vw]"
            }"
          ></div>
          ${withIlustration
            ? html`
                ${forest()}
                <div
                  id="tree-illustration"
                  class="absolute bottom-0 w-[50vw] right-0 h-static-screen overflow-hidden"
                >
                  ${tree()}
                </div>
              `
            : null}
          <div id="page-shell" class="flex flex-col h-fit">
            ${navbar({ lang: siteData.lang })}
            <main
              id="content"
              class="min-h-static-screen-minus-nav overflow-hidden flex flex-col justify-between md:justify-start w-full px-4 sm:px-8 md:pt-6 m-auto max-w-[60rem] h-full pb-16 md:pb-24"
            >
              ${children}
            </main>
          </div>
        </div>
        <!--
          The footer stays outside #overlay-content on purpose: overlay-content
          overlaps it, so scrolling "reveals" the footer underneath while the
          footer itself stays put. Moving it inside would tie it to overlay-content's
          scroll and break that reveal effect.
        -->
        ${withFooter ? footer({ lang: siteData.lang }) : null}
        </div>
        ${languageSwitcher({ lang: siteData.lang })}
        ${activityPanel()}
        <script src="/public/${CACHE_VERSION}/_layout-bundle.js" defer></script>
        <script src="/public/${CACHE_VERSION}/_navigation-bundle.js" defer></script>
        <script src="/public/${CACHE_VERSION}/_activity-logger-bundle.js" defer></script>
        <script src="/public/${CACHE_VERSION}/_activity-panel-bundle.js" defer></script>
        <script src="/public/${CACHE_VERSION}/_mascot-bot-bundle.js" defer></script>
      </body>
    </html>
  `;
}
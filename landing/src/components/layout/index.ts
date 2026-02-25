import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";
import { config } from "dotenv";
import navbar from "../navbar";
import tree from "../tree";
import footer from "../footer";

config();

const CACHE_VERSION = process.env.CACHE_VERSION!;

type LayoutProps = {
  siteData: {
    title: string;
    description: string;
    lang: string;
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
  return html`
    <!DOCTYPE html>
    <html lang="${siteData.lang}">
      <head>
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

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://emiliacabral.com/" />
        <meta property="og:title" content="${siteData.title}" />
        <meta property="og:description" content="${siteData.description}" />
        <meta property="og:image" content="/public/preview.png" />

        <!-- Twitter -->
        <meta property="twitter:card" content="/public/preview.png" />
        <meta property="twitter:url" content="https://emiliacabral.com/" />
        <meta property="twitter:title" content="${siteData.title}" />
        <meta
          property="twitter:description"
          content="${siteData.description}"
        />
        <meta property="twitter:image" content="/public/preview.png" />

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
        <script src="/public/${CACHE_VERSION}/_dropdown-bundle.js"></script>

        <!-- Google Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />

        <!-- CSS -->
        <link rel="stylesheet" href="/public/${CACHE_VERSION}/_output.css" />
        <style>
          @keyframes move-out {
            0% {
              opacity: 100%;
              filter: blur(0px);
            }

            80% {
              opacity: 0%;
              filter: blur(10px);
            }

            100% {
              opacity: 0%;
              filter: blur(10px);
            }
          }

          @keyframes move-in {
            from {
              transform: translateX(100%);
              opacity: 0%;
            }

            to {
              transform: translateX(0%);
              opacity: 100%;
            }
          }

          @view-transition {
            navigation: auto;
          }

          #content {
            view-transition-name: content;
            contain: paint;
          }

          html {
            scroll-behavior: auto;
          }

          @media (prefers-reduced-motion: no-preference) {
            html {
              scroll-behavior: smooth;
            }

            ::view-transition-old(content) {
              animation: 100ms cubic-bezier(0.17, 0.67, 0.81, 0.35) both
                move-out;
            }

            ::view-transition-new(content) {
              animation: 300ms cubic-bezier(0.42, 0.28, 0.42, 0.89) both move-in;
              animation-delay: 100ms;
            }
          }
        </style>
        <script>
          if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
          }
        </script>
      </head>

      <body
        class="text-stone-800 dark:text-stone-100 overscroll-none md:overscroll-auto"

      >
        <div
          id="overlay-content"
          class="relative overflow-hidden shadow-lg flex flex-col min-h-static-screen bg-stone-100 z-10 dark:bg-stone-800 prose-h1:text-3xl"
        >
          <div
            id="gradient-bg"
            class="absolute -z-10 top-[25vh] h-[150vh] ${
              withIlustration
                ? "radial-green-gradient dark:radial-maroon-gradient left-0 w-[130vw]"
                : "radial-green-gradient-right dark:radial-maroon-gradient-right right-0 w-[50vw]"
            }"
          ></div>
          ${withIlustration
            ? html`
                <div
                  class="absolute bottom-0 w-[50vw] right-0 h-static-screen overflow-hidden"
                >
                  ${tree()}
                </div>
              `
            : null}
          <div class="flex flex-col h-fit">
            ${navbar({ lang: siteData.lang })}
            <main
              id="content"
              class="min-h-static-screen-minus-nav overflow-hidden flex flex-col justify-between md:justify-start w-full px-4 sm:px-8 md:pt-6 m-auto max-w-[60rem] h-full pb-16 md:pb-24"
            >
              ${children}
            </main>
          </div>
        </div>
        ${withFooter ? footer({ lang: siteData.lang }) : null}
        <script src="/public/${CACHE_VERSION}/_layout-bundle.js" defer></script>
      </body>
    </html>
  `;
}
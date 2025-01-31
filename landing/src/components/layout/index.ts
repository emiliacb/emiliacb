import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";

import navbar from "../navbar";
import contact from "../contacts";
import tree from "../tree";

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
        <meta property="twitter:description" content="${
          siteData.description
        }" />
        <meta property="twitter:image" content="/public/preview.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>" />
        <link rel="stylesheet" href="/public/_output.css" />
        <style>
          @keyframes move-out {
            0% {
              transform-origin: left;
              transform: scale(1) translateX(0);
              opacity: 100%;
            }

            50% {
              transform-origin: left;
              transform: scale(1) translateX(0);
              opacity: 0%;
            }

            100% {
              transform-origin: left;
              transform: scale(0.8) translateX(-100%);
              opacity: 0%;
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
          }

          html {
            scroll-behavior: auto;
          }
          
          @media (prefers-reduced-motion: no-preference) {
            html {
              scroll-behavior: smooth;
            }

            ::view-transition-old(content) {
              animation: 150ms cubic-bezier(0.17, 0.67, 0.81, 0.35) both move-out;
            }

            ::view-transition-new(content) {
              animation: 300ms cubic-bezier(0.42, 0.28, 0.42, 0.89) both move-in;
            }
          }
        </style>
      </head>
      <body
        class="flex flex-col h-full min-h-static-screen bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100 prose-h1:text-3xl"
      >
      ${
        withIlustration
          ? html`
              <div
                class="fixed w-[50vw] right-0 h-static-screen overflow-hidden"
              >
                ${tree()}
              </div>
            `
          : null
      }
        <div class="flex flex-col h-full min-h-static-screen-minus-nav">
          ${navbar({ lang: siteData.lang })}
          <main id="content" class="min-h-static-screen-minus-nav overflow-hidden flex flex-col justify-between md:justify-start w-full px-4 sm:px-8 md:pt-24 m-auto max-w-[60rem] h-full">${children}</main>
          ${
            withFooter
              ? html`<footer
                  class="w-full z-10 md:z-auto flex px-4 sm:px-8 mt-24 md:mt-32 justify-center bg-yellow-200 dark:bg-yellow-900"
                >
                  ${contact({
                    lang: siteData.lang,
                  })}
                </footer>`
              : null
          }
        <div>
      </body>
    </html>
  `;
}

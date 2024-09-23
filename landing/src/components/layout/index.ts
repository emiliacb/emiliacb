import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";

import navbar from "../navbar";

type LayoutProps = {
  siteData: {
    title: string;
  };
  children?: HtmlEscapedString | Promise<HtmlEscapedString>;
};

export default function layout({ siteData, children }: LayoutProps) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <title>${siteData.title}</title>
        <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
        <!-- <script>
          tailwind.config = {
            darkMode: "media",
            theme: {
              extend: {
                fontFamily: {
                  sans: ["Montserrat", "sans-serif"],
                },
              },
            },
          };
        </script> -->
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
        
        html {
          scroll-behavior: auto;
        }
        
        #content {
          view-transition-name: content;
        }

        @media (prefers-reduced-motion: no-preference) {
          html {
            scroll-behavior: smooth;
          }

          ::view-transition-old(content) {
            animation: 150ms cubic-bezier(.17,.67,.81,.35) both move-out;
          }
          ::view-transition-new(content) {
            animation: 300ms cubic-bezier(.42,.28,.42,.89) both move-in;
          }
        }
        </style>
      </head>
      <body
        class="flex flex-col h-screen bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100 prose-h1:text-3xl prose-strong:whitespace-nowrap"
      >
        <div>
          ${navbar()}
          <main id="content" class="w-full px-2 py-16 md:py-24 m-auto max-w-[60rem] h-full">${children}</main>
        <div>
      </body>
    </html>
  `;
}

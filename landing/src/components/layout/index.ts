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
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
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
        </script>
      </head>
      <body
        class="flex flex-col h-screen bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
      >
        <div
          class="w-full grid place-content-center bg-yellow-200 text-black dark:bg-orange-700 dark:text-yellow-200 py-2"
        >
          <div class="flex items-center dark:font-[500]">
            <div
              class="grid place-content-center mr-2 bg-white size-8 rounded-full text-2xl"
            >
              🚧
            </div>
            under construction
          </div>
        </div>
        ${navbar()}
        <main id="content" class="w-full px-2 py-16 md:py-24 m-auto max-w-[60rem] h-full">${children}</main>
      </body>
    </html>
  `;
}

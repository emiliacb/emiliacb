import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";

import navbar from "../navbar";
import contact from "../contacts";

type LayoutProps = {
  siteData: {
    title: string;
  };
  withFooter?: boolean;
  children?: HtmlEscapedString | Promise<HtmlEscapedString>;
};

export default function layout({ siteData, withFooter, children }: LayoutProps) {
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
        <link rel="stylesheet" href="/public/_output.css" />
      </head>
      <body
        class="flex flex-col h-screen bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100 prose-h1:text-3xl "
      >
        <div>
          ${navbar()}
          <main id="content" class="overflow-hidden w-full px-8 md:pt-24 m-auto max-w-[60rem] h-full">${children}</main>
          ${withFooter ? html`<footer class="w-full flex px-8 justify-center bg-yellow-200 dark:bg-yellow-900">${contact()}</footer>` : null}
        <div>
      </body>
    </html>
  `;
}

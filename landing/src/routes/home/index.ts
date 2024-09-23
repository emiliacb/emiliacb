import path from "path";
import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getContent } from "../../services/content";
import { markdownContentClasses } from "src/constants/styles";

export default async function handler(c: Context) {
  const filePath = path.join(__dirname, `../../../content/pages/home.md`);
  const htmlContent = await getContent(filePath);

  // TODO: Move this to a middleware listening a configuration file
  // return c.html(
  //   layout({
  //     siteData: {
  //       title: "ємιℓιαċв",
  //     },
  //     children: html`
  //       <div
  //         style="width: 100%; height: 100%; max-width: 40rem; display: grid; place-content: center; margin: auto;"
  //       >
  //         <p>Hello there! 👷‍♂️</p>
  //         <p>
  //           Thank you for visiting our page. Unfortunately, the CDN is
  //           experiencing some technical difficulties so this site is temporarily
  //           unavailable.
  //         </p>
  //         <p>I will fix this issue when I have some time.</p>
  //         <p>Thank you for your patience.</p>
  //       </div>
  //     `,
  //   })
  // );

  const view = layout({
    siteData: {
      title: "ємιℓιαċв",
    },
    children: html` <div
      class="${markdownContentClasses}"
    >
      ${raw(htmlContent)}
    </div>`,
  });

  return c.html(view, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3605",
    },
  });
}

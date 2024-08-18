import { Context } from "hono";
import { html } from "hono/html";

import layout from "../../components/layout";

export default async function handler(c: Context) {
  const siteData = {
    title: "emiliacb",
  };

  const content = html`<p>emiliacb</p>`;
  const view = layout({ siteData, children: content });

  return c.html(view);
}
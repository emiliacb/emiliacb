import { Context } from "hono";
import { html, raw } from "hono/html";

import layout from "../../components/layout";
import { getAllPosts } from "src/services/posts";

export default async function handler(c: Context) {
  const siteData = {
    title: "blog | ємιℓιαċв",
  };

  const posts = await getAllPosts();

  const content = html`<h1>post</h1>`;

  const view = layout({ siteData, children: content });

  return c.html(view);
}

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const html_1 = require("hono/html");
const layout_1 = __importDefault(require("../../components/layout"));
const posts_1 = require("../../services/posts");
function handler(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const slug = c.req.path.replace(/^\/blog\/?/, "");
        if (slug) {
            const post = yield (0, posts_1.getPost)(slug);
            if (!post)
                return yield next();
            const view = (0, layout_1.default)({
                siteData: {
                    title: `${post.data.title} | emiliacb`,
                },
                children: (0, html_1.html) `<div class="prose prose-stone dark:prose-invert">
        ${(0, html_1.raw)(post.htmlContent)}
      </div>`,
            });
            return c.html(view);
        }
        const posts = yield (0, posts_1.getAllPosts)();
        if (!posts)
            return yield next();
        const view = (0, layout_1.default)({
            siteData: {
                title: "blog | emiliacb",
            },
            children: (0, html_1.html) `<div class="flex flex-col space-y-10">
      ${(0, html_1.raw)(posts
                .map((post) => `
          <a class="group" href="/blog/${post.slug}">
          <article class="flex flex-col space-y-2 justify-center border-l-2 border-transparent p-2 pl-4 group-hover:border-stone-400 transition duration-100 min-h-12">
          <h2 class="font-bold">${post.title} </h2>
          ${post.description && `<span>${post.description}</span>`}
          <span class="text-xs font-light">${post.date.toLocaleDateString()}</span>  
          </article>
          </a>`)
                .join(""))}
    </div>`,
        });
        return c.html(view);
    });
}

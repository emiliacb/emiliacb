"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = layout;
const html_1 = require("hono/html");
const navbar_1 = __importDefault(require("../navbar"));
function layout({ siteData, children }) {
    return (0, html_1.html) `
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
        <div>
          ${(0, navbar_1.default)()}
          <main id="content" class="w-full px-2 py-16 md:py-24 m-auto max-w-[60rem] h-full">${children}</main>
        <div>
      </body>
    </html>
  `;
}

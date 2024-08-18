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
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            darkMode: "selector",
            theme: {
              extend: {
                fontFamily: {
                  sans: ["Montserrat", "sans-serif"],
                },
              },
            },
          };
        </script>
        <script>
          if (
            localStorage.theme === "dark" ||
            (!("theme" in localStorage) &&
              window.matchMedia("(prefers-color-scheme: dark)").matches)
          ) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        </script>
      </head>
      <body
        class="flex flex-col h-screen bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100"
      >
        <div
          class="w-full grid place-content-center bg-yellow-200 text-black dark:bg-yellow-400 dark:text-yellow-900 py-2"
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
        ${(0, navbar_1.default)()}
        <main class="w-full m-auto max-w-[60rem] h-full p-2">${children}</main>
      </body>
    </html>
  `;
}

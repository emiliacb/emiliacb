import { html, raw } from "hono/html";
import { Copy, Send } from "lucide-static";

const Gmail = `<svg class="lucide" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`;

type EmailLinkProps = {
  email: string;
  lang: string;
  label?: string;
  className?: string;
  variant?: "link" | "prose";
};

const wordings: Record<
  string,
  { copy: string; copied: string; gmail: string; superhuman: string }
> = {
  en: {
    copy: "Copy email",
    copied: "Copied!",
    gmail: "Open in Gmail",
    superhuman: "Open in Superhuman",
  },
  es: {
    copy: "Copiar email",
    copied: "¡Copiado!",
    gmail: "Abrir en Gmail",
    superhuman: "Abrir en Superhuman",
  },
};

const menuItemClass =
  "flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap [&_.lucide]:size-4 [&_.lucide]:shrink-0";

export default function emailLink({
  email,
  lang,
  label = "Email",
  className = "",
  variant = "link",
}: EmailLinkProps) {
  const t = wordings[lang] ?? wordings.en;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  // Superhuman has no documented compose URL scheme of its own: it works by
  // registering as the OS/browser's default handler for plain mailto: links,
  // so this only opens Superhuman if the user has set it as that default.
  const superhumanUrl = `mailto:${email}`;

  return html`
    <dropdown-trigger
      class="relative inline-block ${className}"
      variant="${variant}"
      align-start
      label="${label}"
    >
      <span class="flex flex-col p-2 bg-black dark:bg-white shadow-lg">
        <button
          type="button"
          class="${menuItemClass}"
          data-copy-value="${email}"
          data-copied-label="${t.copied}"
        >
          ${raw(Copy)}${t.copy}
        </button>
        <a class="${menuItemClass}" href="${gmailUrl}" target="_blank" rel="noopener noreferrer">
          ${raw(Gmail)}${t.gmail}
        </a>
        <a class="${menuItemClass}" href="${superhumanUrl}">
          ${raw(Send)}${t.superhuman}
        </a>
      </span>
    </dropdown-trigger>
  `;
}

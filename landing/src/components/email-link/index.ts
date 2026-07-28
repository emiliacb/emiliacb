import { html } from "hono/html";

type EmailLinkProps = {
  email: string;
  lang: string;
  label?: string;
  className?: string;
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
  "block w-full text-left px-4 py-2 text-sm text-white dark:text-black bg-black dark:bg-white hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white whitespace-nowrap";

export default function emailLink({
  email,
  lang,
  label = "Email",
  className = "",
}: EmailLinkProps) {
  const t = wordings[lang] ?? wordings.en;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  const superhumanUrl = `superhuman://mailto:${encodeURIComponent(email)}`;

  return html`
    <dropdown-trigger
      class="relative inline-block ${className}"
      variant="link"
      label="${label}"
    >
      <div class="flex flex-col p-2 bg-black dark:bg-white shadow-lg">
        <button
          type="button"
          class="${menuItemClass}"
          data-copy-value="${email}"
          data-copied-label="${t.copied}"
        >
          ${t.copy}
        </button>
        <a class="${menuItemClass}" href="${gmailUrl}" target="_blank" rel="noopener noreferrer">
          ${t.gmail}
        </a>
        <a class="${menuItemClass}" href="${superhumanUrl}">
          ${t.superhuman}
        </a>
      </div>
    </dropdown-trigger>
  `;
}

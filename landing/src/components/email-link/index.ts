import { html, raw } from "hono/html";
import { Copy, Check, Mail } from "lucide-static";

// Gmail's brand mark (from simple-icons), kept in its real brand red instead
// of following the menu item's currentColor so it reads as the actual logo.
const Gmail = `<svg class="lucide" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EA4335"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>`;

// Superhuman's own brand assets (superhuman.com/media-resources), mirrored
// into public/ instead of hotlinked so the site doesn't depend on their
// server staying up. The menu item's bg is inverted (black in light mode,
// white in dark mode - see menuItemClass), so the lighter "wisteria" mark is
// shown against the black box and the darker "red" mark against the white box.
const SUPERHUMAN_LOGO_LIGHT = "/public/superhuman-logo-wisteria.png";
const SUPERHUMAN_LOGO_DARK = "/public/superhuman-logo-red.png";
const superhumanLogoClass = "!size-4 !shrink-0 !m-0 !inline-block !max-w-none !align-middle";

type EmailLinkProps = {
  email: string;
  lang: string;
  label?: string;
  className?: string;
  variant?: "link" | "prose" | "icon";
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

// The Gmail/Superhuman items are <a> tags that can end up nested inside
// .markdown-content (when this component is used for a mailto: link in
// markdown content), where Tailwind Typography's prose-a rules match any
// anchor by DOM ancestry regardless of where it visually renders. The `!`
// (important) modifiers force this styling to win over that ambient cascade
// instead of leaking an unwanted outline/background/margin onto the item.
const menuItemClass =
  "!flex !items-center !gap-2 !w-full !ml-0 !text-left !px-3 !py-1.5 !text-sm !font-normal !no-underline !outline-none focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-red-500 focus-visible:!outline-offset-2 !text-white dark:!text-black !bg-black dark:!bg-white hover:!bg-white hover:!text-black dark:hover:!bg-black dark:hover:!text-white !whitespace-nowrap [&_.lucide]:size-4 [&_.lucide]:shrink-0";

export default function emailLink({
  email,
  lang,
  label = "Email",
  className = "",
  variant = "link",
}: EmailLinkProps) {
  const t = wordings[lang] ?? wordings.en;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  // Superhuman doesn't publish this as an official API, but it's the scheme
  // real integrations (e.g. Drafts' "Send to Superhuman" action) use, and
  // it's been confirmed working directly. Falls back to opening nothing if
  // Superhuman isn't installed, same as any other custom URL scheme.
  const superhumanUrl = `superhuman://compose?to=${encodeURIComponent(email)}`;

  return html`
    <dropdown-trigger
      class="relative inline-block ${className}"
      variant="${variant}"
      align-start
      label="${label}"
    >
      ${variant === "icon" ? html`<span slot="icon">${raw(Mail)}</span>` : ""}
      <span class="flex flex-col p-2 bg-black dark:bg-white shadow-lg">
        <button
          type="button"
          class="${menuItemClass}"
          data-copy-value="${email}"
          data-copied-label="${t.copied}"
        >
          <span class="copy-icon !inline-flex" aria-hidden="true">${raw(Copy)}</span>
          <span class="check-icon !hidden" aria-hidden="true">${raw(Check)}</span>
          <span class="copy-label">${t.copy}</span>
        </button>
        <a class="${menuItemClass}" href="${gmailUrl}" target="_blank" rel="noopener noreferrer">
          ${raw(Gmail)}${t.gmail}
        </a>
        <a class="${menuItemClass}" href="${superhumanUrl}">
          <img
            src="${SUPERHUMAN_LOGO_LIGHT}"
            alt=""
            class="${superhumanLogoClass} dark:!hidden"
          />
          <img
            src="${SUPERHUMAN_LOGO_DARK}"
            alt=""
            class="${superhumanLogoClass} !hidden dark:!inline-block"
          />
          ${t.superhuman}
        </a>
      </span>
    </dropdown-trigger>
  `;
}

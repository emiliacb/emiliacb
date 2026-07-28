import { html } from "hono/html";

type GhostLinkProps = {
  href: string;
  label: string;
  external?: boolean;
  className?: string;
};

export default function ghostLink({
  href,
  label,
  external,
  className = "",
}: GhostLinkProps) {
  const isExternal = external ?? /^https?:\/\//.test(href);

  return html`
    <a
      class="link-ghost ${className}"
      href="${href}"
      target="${isExternal ? "_blank" : "_self"}"
      rel="${isExternal ? "noopener noreferrer" : ""}"
      >${label}</a
    >
  `;
}

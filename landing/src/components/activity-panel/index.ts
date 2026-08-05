import { html, raw } from "hono/html";
import { Trash2 } from "lucide-static";

// ponytail: no i18n here, this is an internal panel (activity log transcript),
// not visitor-facing copy.
export default function activityPanel() {
  return html`
    <aside id="activity-panel" class="flex-col bg-stone-100 dark:bg-stone-800 shadow-lg">
      <!-- Same visual language as dropdown-trigger[variant="icon-only"] and the
           mascot button: transparent, no radius, inverts on hover. No background of
           its own, because the list's top fade keeps this corner clear. -->
      <button
        id="activity-panel-clear"
        type="button"
        aria-label="Clear activity log"
        class="absolute top-3 left-3 z-10 flex items-center justify-center size-8
          text-stone-800 dark:text-stone-100
          hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-current transition-colors [&>svg]:w-4 [&>svg]:h-4"
      >
        ${raw(Trash2)}
      </button>
      <!-- role=log so a screen reader announces the mascot's replies as they land. -->
      <div
        id="activity-panel-messages"
        role="log"
        aria-live="polite"
        class="flex-1 overflow-y-auto flex flex-col gap-2 px-3 py-6"
      ></div>
    </aside>
  `;
}

import { html } from "hono/html";

// ponytail: no i18n here -- this is an internal/experiment panel (activity
// log transcript), not visitor-facing copy.
export default function activityPanel() {
  return html`
    <aside id="activity-panel" class="flex-col bg-stone-100 dark:bg-stone-800 shadow-lg">
      <h2
        class="text-sm font-semibold px-4 py-3 border-b border-stone-300/60 dark:border-stone-700/60"
      >
        Activity log
      </h2>
      <div
        id="activity-panel-messages"
        class="flex-1 overflow-y-auto flex flex-col gap-2 px-3 py-3"
      ></div>
    </aside>
  `;
}

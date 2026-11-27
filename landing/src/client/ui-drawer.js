// ui-sdk's drawer (https://ui-sdk.dev), as web components: registers
// <ui-drawer> and its parts. Not loaded by any page directly; github-sidebar.js
// injects it on demand, from the URL in <meta name="asset:ui-drawer">.
// oxlint-disable-next-line import/no-unassigned-import -- registering the elements is the import's whole effect
import "@ui-sdk/web/drawer";

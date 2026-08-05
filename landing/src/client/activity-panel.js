// Renders activity-logger's events into a chat-style transcript inside the
// #activity-panel card (visible only in the AI layout, but kept
// populated regardless so the panel already has history the moment the
// mascot button turns the experiment on). Reads localStorage directly rather
// than hooking activity-logger's internals: `activity:event` only carries a
// count, not the event itself, and the logger already exposes flush() to
// force its debounced write -- the same trick mascot-bot.js relies on.
(function () {
  "use strict";

  var COPY = {
    en: { empty: "Nothing logged yet -- click around the page." },
    es: { empty: "Todavía no hay actividad -- explorá la página." },
  };

  function lang() {
    var l = (document.documentElement.lang || "en").slice(0, 2);
    return COPY[l] ? l : "en";
  }

  function truncate(text, max) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max).trim() + "…" : text;
  }

  // One line of transcript text per event. Anything this doesn't recognize
  // still gets a line (the raw event name) rather than being dropped silently.
  function describe(evt) {
    switch (evt.event) {
      case "visited":
        return "Visited " + evt.on;
      case "navigate":
        return "Left " + evt.on + " (" + (evt.activeSeconds || 0) + "s)";
      case "click":
        return "Clicked “" + truncate(evt.on, 60) + "”";
      case "clicked_repeatedly":
        return "Rage-clicked “" + truncate(evt.on, 60) + "” x" + evt.count;
      case "selected":
        return "Selected “" + truncate(evt.on, 80) + "”";
      case "read":
        return (evt.manner === "lingered" ? "Lingered on " : "Read ") +
          "“" + truncate(evt.on, 80) + "”";
      case "read_page":
        return "Read " + Math.round((evt.coverage || 0) * 100) + "% of " + evt.on;
      case "mascot_said":
        return evt.on;
      case "said":
        return "Asked: “" + truncate(evt.on, 80) + "”";
      default:
        return evt.event + (evt.on ? ": " + truncate(evt.on, 80) : "");
    }
  }

  function isMascotSide(evt) {
    return evt.event === "mascot_said";
  }

  function init() {
    var list = document.getElementById("activity-panel-messages");
    if (!list) return;

    var rendered = Object.create(null);

    function renderEvent(evt) {
      if (rendered[evt.id]) return;
      rendered[evt.id] = true;
      var msg = document.createElement("div");
      msg.className = "activity-msg" + (isMascotSide(evt) ? " activity-msg-mascot" : "");
      msg.textContent = describe(evt);
      list.appendChild(msg);
    }

    function renderAll() {
      try {
        if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
          window.__activityLogger.flush();
        }
        var raw = localStorage.getItem("activity_logs");
        var stored = raw ? JSON.parse(raw) : null;
        var events = (stored && stored.events) || [];
        if (!events.length) return false;
        events.forEach(renderEvent);
        return true;
      } catch (e) {
        return false;
      }
    }

    function showEmptyState() {
      if (list.children.length) return;
      var empty = document.createElement("div");
      empty.id = "activity-panel-empty";
      empty.className = "text-xs opacity-60 px-1 py-2";
      empty.textContent = COPY[lang()].empty;
      list.appendChild(empty);
    }

    function clearEmptyState() {
      var empty = document.getElementById("activity-panel-empty");
      if (empty) empty.remove();
    }

    function scrollToBottom() {
      list.scrollTop = list.scrollHeight;
    }

    if (!renderAll()) showEmptyState();
    else scrollToBottom();

    window.addEventListener("activity:event", function () {
      clearEmptyState();
      if (renderAll()) scrollToBottom();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

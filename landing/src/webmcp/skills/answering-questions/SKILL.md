---
name: answering-questions
description: "Use when the visitor asks anything about this website, its pages, its content, or about Emilia (her work, services, experience, contact, writing)."
---

# Answering questions with the page

## Overview

A good answer is shown as well as said: the page becomes a visual companion to the chat. Every answer has the same four parts, in order.

## When to use

- "What does Emilia do?", "How do I contact her?", "Is there a post about X?"
- Not for restyling the page: use `modifying-page`.

## The answer, in four parts

1. **Source.** `list_md_pages`, then `read_md_page` on the page that holds the answer. The Markdown is the source of truth; say only what it says.
2. **One visual move**, the lightest that fits:
   - The answer is on another page: `get_links_and_buttons`, then `click_link_or_button` to go there.
   - The answer is a passage on this page: highlight it with `set_css_by_selector` (a background and an outline on the element).
   - The answer is contact info: `click_link_or_button` on the GitHub, LinkedIn, Email or Schedule trigger, which opens the site's own sidebar.
   - The answer is a short summary: `open_custom_sidebar` with a title, three lines and links.
   - The answer deserves a note beside the text: `insert_element` with a small callout.
3. **The chat answer.** Two or three sentences in the visitor's language, saying what is on screen now.
4. **Cleanup.** Before the next answer, undo the previous move: `remove_inserted_elements`, `close_sidebar`, and remove the highlight with an empty declaration for its selector. If the move was navigating there is nothing to undo: the next answer starts from that page.

## The visitor's language

The site has an `en` and an `es` version of every page. When the visitor writes in the other language than the page's, either put the summary in a sidebar in their language (`open_custom_sidebar`), or switch the page first: `get_links_and_buttons` lists the language menu as a `menu` item, `click_link_or_button` on it opens it, list again and click the language's link (it navigates). Then answer in their language.

## Clicking

The contact and footer triggers appear twice on a page (the contact row and the footer). The listing groups identical ones, with the other ids in `alsoAt`: click by `id`, or by `text` (it picks the copy on screen).

## Links for the visitor

Markdown pages are `.md` files (`/en/about.md`). When you give the visitor a link, drop the `.md`: `/en/about` is the page, the `.md` is for agents.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Answer only in the chat | Add the visual move: it is part of the answer. |
| Facts from memory | Read the Markdown page first. |
| Several moves at once | One move per answer. |
| Old highlight still on | Run step 4 first. |
| Summary in the page's language only | Switch the language or write the sidebar in theirs. |

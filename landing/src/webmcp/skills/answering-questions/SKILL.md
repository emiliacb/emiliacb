---
name: answering-questions
description: "Use when the visitor asks anything about this website, its pages, its content, or about Emilia (her work, services, experience, contact, writing)."
---

# Answering questions with the page

## Overview

A good answer is shown as well as said: the page becomes a visual companion to the chat. Every answer has the same four parts, in order.

## When to use

- "What does Emilia do?", "Where has she worked?", "How do I contact her?", "What is on this site?", "Is there a post about X?"
- Not for restyling the page: use `modifying-page`.

## The answer, in four parts

1. **Source.** `list_md_pages`, then `read_md_page` on the page that holds the answer. The Markdown is the source of truth; say only what it says.
2. **One visual move**, the lightest that fits:
   - The answer is on another page: `get_links_and_buttons`, then `click_link_or_button` to go there.
   - The answer is a passage on this page: highlight it with `set_css_by_selector` (a background and an outline on the element).
   - The answer is contact info: `click_link_or_button` on the GitHub, LinkedIn, Email or Schedule trigger, which opens the site's own sidebar.
   - The answer is a short summary: `open_custom_sidebar` with a title, three lines and links.
   - The answer deserves a note beside the text: `insert_element` with a small callout.
3. **The chat answer.** Two or three sentences in the visitor's language (es or en), saying what is on screen now.
4. **Cleanup.** Before the next answer, undo the previous move: `remove_inserted_elements`, `close_sidebar`, and remove the highlight with an empty declaration for its selector.

## Example

Visitor: "¿Cómo la contacto?"

1. `read_md_page` on `/es.md`: the contact section lists email, LinkedIn, GitHub and the calendar.
2. `get_links_and_buttons` with filter `Email`, then `click_link_or_button` with the id of the sidebar trigger.
3. Chat: "Te abrí el panel de contacto: puedes escribirle por email o agendar una reunión desde ahí."
4. Next question: `close_sidebar` first.

## Quick reference

| The answer is | Visual move | Tool |
| --- | --- | --- |
| A page | Go there | `click_link_or_button` |
| A passage | Highlight | `set_css_by_selector` |
| Contact | Open its sidebar | `click_link_or_button` |
| A summary | Custom sidebar | `open_custom_sidebar` |
| A remark | Callout | `insert_element` |

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Answer only in the chat | Add the visual move: it is part of the answer. |
| Facts from memory | Read the Markdown page first. |
| Several moves at once | One move per answer. |
| Old highlight still on | Run step 4 first. |

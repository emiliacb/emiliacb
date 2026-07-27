---
title: "Give Hermes a job: an agent with its own email, phone and Google account"
slug: 2026-07-27-hermes-agent-chief-of-staff
description: "How to onboard a Nous Research Hermes agent like a real chief of staff, giving it a Fastmail inbox, a dedicated WhatsApp number, and a Google account through the new Google Workspace CLI, with an auth setup you configure once and forget."
date: 2026-07-27T14:00:00.000Z
preview: ""
draft: false
tags: ["AI Agents", "Hermes", "Nous Research", "Google Workspace", "CLI", "Automation", "CRM", "Fastmail", "WhatsApp", "OAuth", "Service Account", "Productivity"]
categories: ["AI/ML Development", "Automation", "Case Study"]
---

# Give Hermes a job: an agent with its own email, phone and Google account

%table-of-contents%

## Introduction

Most "AI assistant" setups fail for a boring reason: the agent has no identity. It borrows your keys, your inbox and your calendar, so it can never act _as itself_. You end up babysitting it instead of delegating to it.

This post takes the opposite approach. We treat a [Nous Research Hermes](https://hermes-agent.nousresearch.com/) agent like a new hire, a chief of staff, and we give it the things a chief of staff actually needs: its own email address, its own phone number, and its own Google account. Then we hand it a job description, tracking my client relationships, and an authentication setup you configure **once** and never touch again.

The philosophy is the same one I keep coming back to: give the agent real, boring infrastructure instead of clever glue code, and it becomes genuinely useful.

## Takeaways

- **Run Hermes through Nous Portal**, one subscription that replaces the pile of provider API keys, so setup is a single OAuth login.
- **Give the agent an identity**: a Fastmail inbox and a dedicated WhatsApp number on its own 4G SIM.
- **Attach a Google account** through the new Google Workspace CLI (`gws`) for Drive and Calendar access.
- **Solve the auth-expiry problem once**: publish the OAuth app (personal account) or use a service account with domain-wide delegation (Workspace domain). No more weekly re-logins.
- **Keep a living relationship log in Markdown**, fed either by forwarding emails or by a weekly export.

## Why Nous Portal instead of raw API keys

Hermes can talk to more or less any model provider, but wiring each one by hand, separate accounts, separate API keys, separate billing, is exactly the kind of bloat I try to avoid.

[Nous Portal](https://portal.nousresearch.com/) is Nous Research's subscription gateway. One plan gives you access to a curated model list plus a managed **Tool Gateway** (web search, image generation, text-to-speech, cloud browser automation). Hermes uses it behind a single auth flow, so you never juggle per-provider keys.

Setup is one command:

```bash
hermes setup --portal
```

This opens your browser to `portal.nousresearch.com` for an OAuth login and lets you pick a Nous model from the curated list. Under the hood:

- The **refresh token** at `~/.hermes/auth.json` is the only credential on disk.
- Hermes mints a **short-lived JWT** from that refresh token on every inference call, rather than reusing a long-lived API key.

After setup, `~/.hermes/config.yaml` looks roughly like this:

```yaml
model:
  provider: nous
  default: anthropic/claude-sonnet-4.6
  base_url: https://inference-api.nousresearch.com/v1

# Enabled with any paid Portal subscription
web:
  backend: nous
image_gen:
  provider: nous
tts:
  provider: nous
browser:
  backend: nous
```

Useful diagnostics while you get going:

```bash
hermes portal info     # subscription + model status
hermes portal tools    # what the Tool Gateway exposes
hermes portal open     # open the portal dashboard
```

**Why it matters:** one subscription, one login, one credential on disk. That's the whole point, the agent's "brain" is provisioned in a single step, and you can spend your energy on giving it an identity and a job.

## Giving the agent an identity

A chief of staff who has to sign every email as "me" isn't a chief of staff, it's a macro. So the first real work is provisioning identity: a mailbox and a phone number that belong to the agent.

### Email: a Fastmail inbox as the primary gateway

Email is the agent's main gateway, the channel you use to give it work and the channel it uses to reach the outside world.

I use [Fastmail](https://www.fastmail.com/) because it exposes clean IMAP/SMTP with **app-specific passwords**, no fragile browser automation, no OAuth dance just to send a message.

1. Create a dedicated Fastmail account for the agent (e.g. `hermes@yourdomain.com`).
2. Generate an **app password** scoped to IMAP + SMTP.
3. Point Hermes at it:

```yaml
# ~/.hermes/config.yaml
channels:
  email:
    provider: fastmail
    imap_host: imap.fastmail.com
    smtp_host: smtp.fastmail.com
    address: hermes@yourdomain.com
    app_password_env: FASTMAIL_APP_PASSWORD
```

Now the agent has a real inbox. You email it a task; it emails you (or a client) back, from its own address, under its own name.

### WhatsApp: a dedicated number on its own 4G SIM

For anything time-sensitive, email is too slow. So we give the agent a phone number, and crucially, **not yours**.

Buy a cheap prepaid **4G data/SMS SIM** and use it to register a WhatsApp account that belongs to the agent. The SIM matters because WhatsApp registration requires receiving an SMS code, and you want that number fully separate from your personal line.

- The SIM only needs to receive the registration SMS and stay active; a low-cost data plan is plenty.
- Register WhatsApp against that number on a spare device or emulator, then bridge it to Hermes.
- Keep the SIM powered and topped up, WhatsApp occasionally re-verifies.

**Why it matters:** a separate number means the agent can message you and your clients without ever impersonating you, and you can revoke it instantly by killing the SIM. Identity you can hand over is also identity you can take back.

### Google account: identity for Workspace, not for chat

Finally, create a **dedicated Gmail / Google account** for the agent. This is deliberately _not_ a communication channel, you won't chat with Hermes through Gmail. Its job is to be the agent's identity inside Google Workspace: a Drive it owns, a Calendar it manages, and a mailbox it can read through the API.

So we end up with a clean division of labor:

| Surface | Purpose |
| --- | --- |
| **Fastmail** | Primary text gateway: you ↔ agent ↔ outside world |
| **WhatsApp** | Fast, informal nudges and alerts |
| **Google account** | Workspace identity: Drive, Calendar, and an API-readable mailbox |

## Wiring up Google Workspace with the `gws` CLI

Google recently shipped an official [Google Workspace CLI](https://github.com/googleworkspace/cli) (`gws`), a single command-line tool for Drive, Gmail, Calendar, Sheets, Docs and more. It's built in Rust, reads Google's Discovery Service at runtime so its command surface stays current, and ships an MCP server, which makes it a clean fit for an agent.

Install it:

```bash
npm install -g @googleworkspace/cli
# or: brew install googleworkspace-cli
```

Everyday commands look like this:

```bash
gws calendar +agenda                                   # today's agenda
gws drive files list --params '{"pageSize": 100}' --page-all
gws gmail +send --to alice@example.com --subject "Hi" --body "..."
```

The interesting part isn't the commands, it's the authentication. Get that wrong and your agent goes dark every week.

## The part everyone gets wrong: authentication that lasts

The default interactive flow is easy:

```bash
gws auth setup   # one-time: creates the Cloud project, enables APIs
gws auth login   # subsequent logins
```

Credentials are encrypted at rest (AES-256-GCM) in your OS keyring. The catch: **a plain OAuth refresh token from an app in "Testing" mode expires after 7 days.** That's the notorious token that dies once a week and kills every "set it and forget it" automation. For an autonomous agent, that's a dealbreaker.

There are two ways to fix it permanently. Pick based on whether the agent's account is a personal Gmail or lives on a Workspace domain you administer.

### Option A — Personal Gmail: publish the OAuth app to production

The 7-day expiry is a property of **Testing** publishing status, not of OAuth itself. When you move the app's consent screen to **In production**, refresh tokens stop expiring. They then last indefinitely, revoked only if you do it manually, if the password changes, or after ~6 months of total inactivity (a daily agent never hits that).

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → OAuth consent screen**.
2. Add the scopes the agent needs (Calendar, Drive, Gmail).
3. Set **Publishing status → In production**. (For sensitive scopes Google may show an "unverified app" screen; since you own both the app and the account, you can proceed past it.)
4. Run `gws auth login` once. The refresh token you get now survives.

**Best for:** a solo operator whose agent uses a normal Gmail account. Configure once, done.

### Option B — Workspace domain: service account + domain-wide delegation

If the agent's account lives on a Google Workspace domain you administer, this is the cleanest option, because a **service account key never expires at all.**

1. Create a service account in Google Cloud and download its JSON key.
2. In the **Admin console → Security → Access and data control → API controls → Domain-wide delegation**, click **Add new**.
3. Enter the service account's **Client ID** and the exact scopes, e.g.:

   ```text
   https://www.googleapis.com/auth/calendar,
   https://www.googleapis.com/auth/drive,
   https://www.googleapis.com/auth/gmail.modify
   ```

4. Point `gws` at the key and let it impersonate the agent's account:

   ```bash
   export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/secure/path/hermes-sa.json
   gws calendar +agenda
   ```

The admin authorizes the client ID once; from then on the service account mints tokens on demand with no interactive login, ever. This is your "configure once a year, or once, full stop" path.

> **A word on blast radius.** Domain-wide delegation is powerful, that key can reach every authorized scope on the impersonated account. Store it like a production secret (restricted file permissions, out of any repo), scope it to only what the agent needs, and prefer a dedicated agent account over your primary one.

**Recommendation:** if you have a Workspace domain, use Option B, it's the most durable and needs no browser at all. If the agent runs on a personal Gmail, Option A gets you the same "set it and forget it" result without an admin console.

## What the agent actually does

With a brain, an identity and Workspace access, Hermes can do a chief of staff's real work. A few jobs I hand it:

### Manage the calendar

The agent reads my calendar, creates events, and invites people, directly, without me opening Google Calendar:

- _"Book a 30-min intro call with the Rossi account next Tuesday afternoon and invite them."_
- _"What's my week look like? Flag anything that collides."_

Because it's acting through its own Google identity, invitations come from the agent, and I'm just another guest, exactly how a real assistant would schedule on my behalf.

### Build a book of business from my inbox

One of the highest-leverage tasks: sweep the entire mailbox, figure out who my actual contacts are, and assemble a **book of business**, a structured CRM of every client and lead, with company, role, last contact and context. The agent does the tedious archaeology across years of email that I would never do by hand.

### Triage my Google reviews

The agent reads my company's Google reviews and, per client where it can match one, surfaces the **most important cases**: the recurring complaints, the specific things I need to fix, ranked by how much they matter. Instead of a wall of stars, I get a short list of "here's what's actually hurting you."

## The relationship log: a living Markdown file

The through-line for all of this is a **Markdown file per client** where Hermes keeps the state of each relationship: who they are, history, open threads, sentiment, next action. Markdown because it's plain text, diffable, greppable, and I can read or edit it myself, no proprietary CRM required.

```markdown
# Rossi & Co.

- **Status:** Active — renewal due Q4
- **Primary contact:** Marco Rossi (COO)
- **Last contact:** 2026-07-21 (email, re: onboarding delay)
- **Sentiment:** Cautious — frustrated by the delay, still committed
- **Open threads:**
  - Waiting on revised SOW from us
  - Google review (3★) mentions slow support — follow up
- **Next action:** Send revised SOW by Fri; offer a call
```

The only real question is how the file stays current. Two options, use whichever fits how you work:

### Option 1 — Forward relevant emails

Keep it manual and precise: whenever something matters, **forward the email to the agent's Fastmail address.** Hermes parses it, figures out which client it belongs to, and appends the update to that client's Markdown file. You stay in control of what counts as signal, and the log only ever reflects things you deliberately fed it.

- **Pros:** high signal, zero noise, no scheduled jobs, you decide what's worth recording.
- **Cons:** it's on you to remember to forward; anything you skip never lands.

### Option 2 — Scheduled weekly export

Automate it: a **weekly job** where the agent sweeps the inbox, calendar and reviews on its own and regenerates each relationship log.

```bash
# crontab: every Monday 07:00
0 7 * * 1 hermes run "Sweep this week's email, calendar and new Google
reviews. Update each client's Markdown file under ./clients/ with any new
contact, open thread, sentiment shift or action item. Email me a summary."
```

- **Pros:** fully hands-off; nothing slips through because you forgot to forward.
- **Cons:** noisier, needs occasional pruning, and the agent has to guess what's relevant.

In practice the two compose nicely: run the weekly export as a baseline so nothing is missed, and forward the genuinely important threads in real time so the high-stakes relationships are always current.

## Tradeoffs

**Giving an agent its own identity vs. sharing yours**

- **Our choice: its own identity** (Fastmail address, WhatsApp number, Google account).
- Actions are attributable to the agent, not silently done "as you."
- Everything is revocable in one move, kill the SIM, rotate the app password, disable the service account.
- **Cost:** more upfront provisioning (a SIM, a couple of accounts) than just pasting your own credentials into a config file.

**Why not just share your own accounts?** It's faster to set up, but the agent then can't act independently, every action looks like it came from you, and revoking access means changing _your_ passwords. The separation is worth the extra setup.

## Conclusion

None of this is exotic. It's an email account, a SIM card, a Google account, a CLI, and one authentication setting flipped the right way. But that boring infrastructure is exactly what turns a chat toy into a chief of staff:

- **A brain** provisioned in one command through Nous Portal.
- **An identity** it owns, so it can act instead of impersonate.
- **Workspace access** that authenticates once and never nags you again.
- **A living memory** in plain Markdown that you fully control.

The lesson is the same one I keep relearning: the hard part of agents usually isn't the model, it's giving it real, revocable infrastructure and a clearly scoped job. Do that, and delegation finally feels like delegation.

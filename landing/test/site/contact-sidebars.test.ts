import { describe, it, expect } from "vitest";

import { dictionaries } from "../../src/shared/i18n";
import type { RenderCtx } from "../../src/site/context";
import calendarSidebar from "../../src/site/components/calendar-sidebar";
import contacts from "../../src/site/components/contacts";
import emailSidebar from "../../src/site/components/email-sidebar";
import linkedinSidebar from "../../src/site/components/linkedin-sidebar";
import { SIDEBAR_IDS } from "../../src/site/components/sidebar";
import { linkedinProfile, parseLinkedinProfile } from "../../src/site/linkedin/profile";

function ctx(lang: "en" | "es"): RenderCtx {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the sidebars read only lang and t
  return { lang, t: dictionaries[lang] } as RenderCtx;
}

describe("linkedin profile", () => {
  it("content/linkedin.json is valid, the current job first", () => {
    expect(linkedinProfile.experience[0].to).toBeUndefined();
  });

  it("rejects a hand edit that breaks the shape", () => {
    const post = { ...linkedinProfile.latestPost, url: "https://example.com/post" };
    expect(() => parseLinkedinProfile({ ...linkedinProfile, latestPost: post })).toThrow(/url/);
    expect(() => parseLinkedinProfile({ ...linkedinProfile, experience: [] })).toThrow(/experience/);
  });
});

describe("linkedinSidebar", () => {
  it("puts the current job on top and the rest on the timeline", async () => {
    const html = (await linkedinSidebar(ctx("es"))).toString();
    expect(html).toContain(">Sonora</span>");
    expect(html).toContain('src="/public/sonora-logo.svg"');
    expect(html).toContain("desde octubre de 2025");
    expect(html.match(/class="li-job"/g)).toHaveLength(linkedinProfile.experience.length - 1);
    expect(html).toContain("2021–2024");
  });

  it("quotes the latest post in its own language, with a link to it", async () => {
    const html = (await linkedinSidebar(ctx("en"))).toString();
    expect(html).toContain('lang="es"');
    expect(html).toContain("Ganamos! (el tercer puesto)");
    expect(html).toContain(linkedinProfile.latestPost.url);
  });
});

describe("emailSidebar", () => {
  it("offers copy, Gmail, Superhuman and the mail app", async () => {
    const html = (await emailSidebar(ctx("en"))).toString();
    expect(html).toContain('data-copy-value="emiliacabralb@gmail.com"');
    expect(html).toContain("mail.google.com/mail/?view=cm");
    expect(html).toContain("superhuman://compose");
    expect(html).toContain('href="mailto:emiliacabralb@gmail.com"');
  });
});

describe("calendarSidebar", () => {
  it("leaves a box for Cal.com's booker, with the event's link", async () => {
    const html = (await calendarSidebar(ctx("es"))).toString();
    expect(html).toContain('id="calendar-embed"');
    expect(html).toContain('data-cal-link="emiliacb/general"');
    expect(html).toContain("Cargando el calendario");
  });
});

describe("contacts", () => {
  it("links each contact to its sidebar, in both layouts", async () => {
    const layouts = await Promise.all([false, true].map(async (columnMode) => String(await contacts(ctx("en"), { columnMode }))));
    for (const html of layouts) {
      for (const id of Object.values(SIDEBAR_IDS)) expect(html).toContain(`data-sidebar="${id}"`);
    }
  });
});

/**
 * English dictionary. The source of truth for the shape: es.ts must have the
 * same keys (its type is `Dict`, derived from this object).
 */
export const en = {
  markdown: {
    tableOfContents: "Table of Contents:",
  },

  nav: {
    brand: "Emilia",
    skipToContent: "Skip to content",
    mainNavigation: "Main navigation",
    about: "About",
    whoIAm: "Who I Am",
    whatIDo: "What I Do",
    journal: "Journal",
  },

  footer: {
    tagline: "Senior Software Engineer with a product mindset.",
    navigation: "Navigation",
    navigationLabel: "Footer navigation",
    contact: "Contact",
    license: "Licensed under Apache 2.0 and CC BY 4.0.",
  },

  language: {
    label: "Language",
    flagEmoji: "Flag emoji",
    names: {
      en: "English",
      es: "Español",
    },
  },

  contact: {
    email: "Email",
    linkedin: "LinkedIn",
    github: "GitHub",
    schedule: "Schedule",
    scheduleAction: "a Meeting",
    scheduleFull: "Schedule a Meeting",
  },

  emailLink: {
    copy: "Copy email",
    copied: "Copied!",
    gmail: "Open in Gmail",
    superhuman: "Open in Superhuman",
  },

  pages: {
    home: {
      title: "ємιℓιαċв",
      description:
        "Emilia CB — Senior Software Engineer building products with AI, full-stack development, and a user-first mindset.",
      navTitle: "Home",
      mapTitle: "Home",
      blurb:
        "Landing page: intro to Emilia CB, a senior software engineer building AI products, full-stack apps, with a user-first mindset.",
    },
    about: {
      title: "Who I Am | ємιℓιαċв",
      description:
        "Learn about Emilia CB's background, skills, and approach to software engineering and product development.",
      navTitle: "Who I Am",
      mapTitle: "About",
      blurb:
        "Background, skills, and approach to software engineering and product development.",
    },
    services: {
      title: "What I Offer | ємιℓιαċв",
      description:
        "Software engineering services: AI integration, full-stack development, and technical consulting.",
      navTitle: "What I Do",
      mapTitle: "Services",
      blurb: "AI integration, full-stack development, and technical consulting services.",
    },
    courses: {
      title: "Courses | ємιℓιαċв",
      description: "A look at the courses Emilia CB is currently building.",
      navTitle: "Courses",
      mapTitle: "Courses",
      blurb: "Practical generative AI courses for non-programmers and teams.",
    },
    blog: {
      title: "Journal | ємιℓιαċв",
      description: "Articles on software engineering, AI, and building great products.",
      navTitle: "Journal",
      mapTitle: "Journal",
      blurb: "Articles on software engineering, AI, and building products.",
    },
    "labs-distortion": {
      title: "Labs: Liquid page | ємιℓιαċв",
      description:
        "This whole page — navbar included — is a WebGL texture. Move the mouse to twist it.",
      navTitle: "Labs: Liquid page",
      mapTitle: "Labs: Liquid page",
      blurb: "Experimental WebGL page-distortion effect, a proof of concept.",
    },
    "labs-distortion-bg": {
      title: "Labs: Liquid background | ємιℓιαċв",
      description:
        "Only the gradient and the illustration behind this card are a WebGL texture. The navbar and this text stay put — move the mouse over the page.",
      navTitle: "Labs: Liquid background",
      mapTitle: "Labs: Liquid background",
      blurb: "Experimental WebGL background-distortion effect, a proof of concept.",
    },
  },

  notFound: {
    title: "404 | ємιℓιαċв",
    description: "Page not found",
    message: "The page you’re looking for doesn’t exist.",
    cta: "Back to home",
  },

  blog: {
    heading: "Journal",
    intro: "This journal aims to be a collection of my thoughts and projects.",
    empty: "Posts coming soon...",
  },

  courses: {
    heading: "Courses",
    intro:
      "Practical generative AI courses, no fluff: for non-programmers and for teams that want to move faster.",
    comingSoon: "Coming Soon",
    items: [
      {
        title: "First Steps with AI",
        description:
          "The fundamentals of how generative AI works and how to use it day-to-day, no technical background required.",
      },
      {
        title: "Build Your First App with Claude Code",
        description:
          "Use Claude Code to build and ship real projects without writing a line of code yourself.",
      },
      {
        title: "Internal Automation with Hermes",
        description:
          "How to deploy a self-hosted Hermes agent for internal automation at your company: real use cases.",
      },
    ],
  },

  labs: {
    distortion: {
      title: "Liquid page",
      subtitle:
        "This whole page — navbar included — is a WebGL texture. Move the mouse to twist it.",
      how: "How it works",
      step1:
        "The rendered DOM is captured into an image (SVG foreignObject via html-to-image).",
      step2:
        "The capture becomes a texture on a fullscreen Three.js quad, distorted per-pixel in a fragment shader (twist, swirl, smear and ripple around the cursor).",
      step3:
        "The real DOM stays underneath with opacity 0 but interactive: what you click is the invisible page, what you see is the shader.",
      toggle: "Toggle effect",
      toggleHint:
        "…or press Escape. This button is part of the proof: you are clicking the invisible DOM.",
      caveats:
        "POC caveats: the capture is a static snapshot (hover states don't repaint), and it respects prefers-reduced-motion by staying off.",
      linkProof: "Links keep working →",
    },
    distortionBg: {
      title: "Liquid background",
      subtitle:
        "Only the gradient and the illustration behind this card are a WebGL texture. The navbar and this text stay put — move the mouse over the page.",
      how: "How it's different from the full-page POC",
      step1:
        "Only #overlay-content's decorative layer is captured (gradient blob + tree illustration), excluding the navbar and content.",
      step2:
        "The capture becomes a texture on a Three.js quad placed exactly behind the content, at the same z-index as the original gradient.",
      step3:
        "Nothing needs to stay invisible-but-clickable here: the layer has no links, so the canvas simply replaces it in place.",
      caveats:
        "POC caveat: it's a static snapshot — the illustration's own animation freezes at capture time.",
      linkProof: "Links keep working →",
    },
  },
};

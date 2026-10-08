export const SITE_URL = "https://emiliacabral.com";
export const SITE_NAME = "Emilia Cabral";
/** The stylised name used as the logo and as the suffix of every <title>. */
export const SITE_TITLE = "ємιℓιαċв";

export type PageId =
  | "home"
  | "about"
  | "services"
  | "courses"
  | "blog"
  | "labs-distortion"
  | "labs-distortion-bg";

export type PageDef = {
  id: PageId;
  /** Path after the language prefix: "" for the home, "/about", … */
  path: string;
};

/**
 * The single list of pages. The build renders one HTML file per page and
 * language from it, the Worker redirects their language-less URLs from it,
 * and the mascot prompt's site map is derived from it. Blog posts are added
 * on top from content/blog.
 */
export const PAGES: readonly PageDef[] = [
  { id: "home", path: "" },
  { id: "about", path: "/about" },
  { id: "services", path: "/services" },
  { id: "courses", path: "/courses" },
  { id: "blog", path: "/blog" },
  { id: "labs-distortion", path: "/labs/distortion" },
  { id: "labs-distortion-bg", path: "/labs/distortion-bg" },
];

/** Pages linked from the footer navigation, in order. */
export const FOOTER_NAV: readonly PageId[] = ["home", "about", "blog", "services"];

export const BLOG_PATH = "/blog";

export const CONTACT = {
  email: "emiliacabralb@gmail.com",
  linkedin: "https://www.linkedin.com/in/emiliacb",
  github: "https://github.com/emiliacb",
  calendar: "https://cal.com/emiliacb/general",
} as const;

import type { Lang } from "../lang";
import { en } from "./en";
import { es } from "./es";

/** The dictionary shape. es.ts is typed against it, so both languages stay in step. */
export type Dict = typeof en;

export const dictionaries: Record<Lang, Dict> = { en, es };

export function t(lang: Lang): Dict {
  return dictionaries[lang];
}

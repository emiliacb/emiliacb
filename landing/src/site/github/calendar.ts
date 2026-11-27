/**
 * Reads GitHub's contribution calendar out of the HTML fragment a profile page
 * loads (https://github.com/users/<user>/contributions). Each day is a <td>
 * with its date and an id, labelled by a <tool-tip for="<that id>"> that reads
 * "5 contributions on November 3rd." or "No contributions on …". The heading
 * gives the year's total, which the days have to add up to: a page whose
 * markup changed fails here instead of drawing a wrong calendar.
 */
export type ContributionCalendar = { total: number; start: string; days: number[] };

const DAY_MS = 86_400_000;
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const toNumber = (text: string) => Number(text.replace(/,/g, ""));

/** Tooltip text by the id of the day it labels. */
function readLabels(page: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const m of page.matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/g)) {
    const id = attr(m[1], "for");
    if (id) labels.set(id, m[2].trim());
  }
  return labels;
}

/** "5 contributions on …" → 5, "No contributions on …" → 0. */
function countIn(label: string): number {
  const n = /^([\d,]+) contributions?\b/.exec(label);
  if (n) return toNumber(n[1]);
  if (/^No contributions\b/.test(label)) return 0;
  throw new Error(`unexpected calendar label: "${label}"`);
}

/** Contributions by date, from every day cell and its label. */
function readCounts(page: string, labels: Map<string, string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of page.matchAll(/<td\b[^>]*\bdata-date="[^"]*"[^>]*>/g)) {
    const date = attr(m[0], "data-date");
    const id = attr(m[0], "id");
    const label = id === undefined ? undefined : labels.get(id);
    if (!date || label === undefined) throw new Error(`calendar day without a label: ${m[0]}`);
    counts.set(date, countIn(label));
  }
  if (!counts.size) throw new Error("no calendar days found in the page");
  return counts;
}

/** One count per day from the first date to the last; a day the page leaves out is zero. */
function everyDay(counts: Map<string, number>): { start: string; days: number[] } {
  const dates = [...counts.keys()].toSorted();
  const start = dates[0];
  const end = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  const days: number[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= end; t += DAY_MS) {
    days.push(counts.get(new Date(t).toISOString().slice(0, 10)) ?? 0);
  }
  return { start, days };
}

export function parseContributionCalendar(page: string): ContributionCalendar {
  const { start, days } = everyDay(readCounts(page, readLabels(page)));
  const sum = days.reduce((a, b) => a + b, 0);
  const heading = /([\d,]+)\s+contributions?\s+in the last year/.exec(page);
  const total = heading ? toNumber(heading[1]) : sum;
  if (total !== sum) throw new Error(`calendar days add up to ${sum}, the heading says ${total}`);
  return { total, start, days };
}

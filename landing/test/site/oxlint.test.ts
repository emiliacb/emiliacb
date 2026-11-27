import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

/**
 * Guards the lint config itself: the fixture holds one instance of each
 * shortcut an agent takes to get code past the compiler or the complexity
 * budget, and every one must still be reported. Catches a rule being
 * switched off or loosened by accident.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE = "test/site/fixtures/agent-shortcuts.ts";
const FIXTURE_IGNORE = '"test/site/fixtures/**", ';

const EXPECTED_RULES = [
  "eslint(complexity)",
  "eslint(eqeqeq)",
  "eslint(max-depth)",
  "eslint(max-params)",
  "eslint(no-empty)",
  "eslint(no-nested-ternary)",
  "typescript(ban-ts-comment)",
  "typescript(no-explicit-any)",
  "typescript(no-floating-promises)",
  "typescript(no-non-null-assertion)",
  "typescript(no-unsafe-type-assertion)",
];

type Report = { diagnostics: { code: string; filename: string }[] };

const tmp = mkdtempSync(path.join(tmpdir(), "oxlint-config-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Lints the fixture with the real config, minus the ignore that keeps it out of `npm run lint`. */
function lintFixture(): Report {
  const config = readFileSync(path.join(root, ".oxlintrc.json"), "utf8");
  if (!config.includes(FIXTURE_IGNORE)) throw new Error(`.oxlintrc.json no longer ignores ${FIXTURE}`);
  const configPath = path.join(tmp, "oxlintrc.json");
  writeFileSync(configPath, config.replace(FIXTURE_IGNORE, ""));

  const bin = path.join(root, "node_modules/.bin/oxlint");
  const run = spawnSync(bin, ["-c", configPath, "--type-aware", "--format=json", FIXTURE], {
    cwd: root,
    encoding: "utf8",
  });
  if (run.error) throw run.error;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's documented JSON output
  return JSON.parse(run.stdout) as Report;
}

describe("oxlint config", () => {
  it("rejects every agent shortcut in the fixture", () => {
    const codes = new Set(lintFixture().diagnostics.map((d) => d.code));
    for (const rule of EXPECTED_RULES) expect(codes, rule).toContain(rule);
  }, 30_000);
});

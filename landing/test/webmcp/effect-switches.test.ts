import { describe, expect, it } from "vitest";

import { emptyState, isEmptyState, renderCss } from "../../src/webmcp/client/css/state.js";
import { BASE_TOKENS } from "../../src/webmcp/client/css/tokens.js";
import { kindOf, kindProblem, mergeVariables, variablesToCss } from "../../src/webmcp/client/css/variables.js";

const FX_OFF = ":root{--fx-ui-warp:off;--fx-shockwave:off}";
const supports = () => false;

describe("the effect switches the agent's stylesheet turns off", () => {
  it("renders nothing while the agent has changed nothing, so the site's default (on) stands", () => {
    expect(isEmptyState(emptyState())).toBe(true);
    expect(renderCss(emptyState())).toBe("");
  });

  it("turns both off, first, as soon as any kind of change exists", () => {
    const states = [
      { ...emptyState(), css: "p { color: red; }" },
      { ...emptyState(), rules: { "h1": { color: "red" } } },
      { ...emptyState(), variables: mergeVariables(emptyState().variables, [["--color-ink", "#111"]], "both") },
    ];
    for (const state of states) {
      expect(isEmptyState(state)).toBe(false);
      expect(renderCss(state).startsWith(FX_OFF)).toBe(true);
    }
  });

  it("lets the agent turn one back on: its own override is printed after the default", () => {
    const variables = mergeVariables(emptyState().variables, [["--fx-ui-warp", "on"]], "both");
    const css = renderCss({ ...emptyState(), variables });
    expect(css.indexOf(FX_OFF)).toBe(0);
    expect(css.indexOf("--fx-ui-warp: on")).toBeGreaterThan(css.indexOf(FX_OFF));
    expect(css).toContain(variablesToCss(variables));
  });

  it("is documented as base tokens and validated as a keyword", () => {
    const names = BASE_TOKENS.map((token) => token.name);
    expect(names).toContain("--fx-ui-warp");
    expect(names).toContain("--fx-shockwave");
    expect(kindOf("on", supports)).toBe("keyword");
    expect(kindOf("off", supports)).toBe("keyword");
    expect(kindProblem("keyword", "on", supports)).toBeNull();
    expect(kindProblem("keyword", "off", supports)).toBeNull();
    expect(kindProblem("keyword", "maybe", supports)).toMatch(/"on" or "off"/);
  });
});

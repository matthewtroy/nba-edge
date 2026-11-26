/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InjuryStatusBadge } from "../src/components/InjuryStatusBadge";

describe("prod fix injuries tabs — item 1 Out badge", () => {
  it("Out status renders red Out badge", () => {
    const html = renderToStaticMarkup(
      createElement(InjuryStatusBadge, { status: "Out" })
    );
    expect(html).toContain("Out");
    expect(html).toMatch(/red/);
  });
});
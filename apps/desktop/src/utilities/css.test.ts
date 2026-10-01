import { describe, expect, it } from "vitest";
import { borderRadiusCss, boxShadowCss, clipPathCss, triangleCss } from "./css";

describe("border radius", () => {
  it("puts all four corners in CSS order: TL TR BR BL", () => {
    expect(
      borderRadiusCss("", { tl: "4", tr: "8", br: "12", bl: "16" }),
    ).toBe("border-radius: 4px 8px 12px 16px;");
  });
});

describe("box shadow", () => {
  it("converts the colour and opacity into one rgba value", () => {
    expect(boxShadowCss("", { x: "0", y: "4", blur: "10", spread: "0", color: "#ff0000", opacity: "50" })).toBe(
      "box-shadow: 0px 4px 10px 0px rgba(255, 0, 0, 0.5);",
    );
  });
});

describe("clip path", () => {
  it("falls back to a circle for an unknown shape rather than an empty path", () => {
    expect(clipPathCss("", { shape: "not-a-shape" })).toContain("circle(50%");
  });
});

describe("triangle", () => {
  it("points in the direction asked, using the border trick", () => {
    const up = triangleCss("", { direction: "up", size: "40", color: "#f00" });
    expect(up).toContain("border-color: transparent transparent #f00 transparent");
  });
});

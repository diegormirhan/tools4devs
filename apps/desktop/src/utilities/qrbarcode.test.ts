import { describe, expect, it } from "vitest";
import {
  generateBarcodeSvg,
  generateQrSvg,
  toImageSource,
  wifiPayload,
} from "./qrbarcode";

describe("QR codes", () => {
  it("refuses an empty payload rather than encoding nothing", async () => {
    await expect(generateQrSvg("", {})).rejects.toThrow();
  });
});

describe("Wi-Fi QR payload", () => {
  it("builds the WIFI: string the format expects", () => {
    expect(wifiPayload({ ssid: "HomeNet", password: "s3cret", security: "WPA" })).toBe(
      "WIFI:T:WPA;S:HomeNet;P:s3cret;H:false;;",
    );
  });

  it("omits the password field's value for an open network", () => {
    expect(wifiPayload({ ssid: "Guest", security: "nopass" })).toBe("WIFI:T:nopass;S:Guest;H:false;;");
  });

  it("escapes characters the format treats as separators", () => {
    expect(wifiPayload({ ssid: "My;Net", password: "a,b", security: "WPA" })).toBe(
      "WIFI:T:WPA;S:My\\;Net;P:a\\,b;H:false;;",
    );
  });

  it("refuses an empty network name", () => {
    expect(() => wifiPayload({ ssid: "" })).toThrow();
  });
});

describe("barcodes", () => {
  it("rejects a value that is not valid for the chosen format", () => {
    // EAN-13 needs 12 or 13 digits; letters are not a valid EAN-13 payload.
    expect(() => generateBarcodeSvg("not-a-number", { format: "EAN13" })).toThrow();
  });

  it("refuses an empty value", () => {
    expect(() => generateBarcodeSvg("", {})).toThrow();
  });
});

describe("image source encoding", () => {
  it("round-trips an SVG containing non-ASCII text", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>café</text></svg>';
    const source = toImageSource(svg);
    const decoded = decodeURIComponent(escape(atob(source.split(",")[1]!)));
    expect(decoded).toBe(svg);
  });
});

import { describe, expect, it } from "vitest";
import { getGoogleMapsSearchUrl, getLineShareUrl } from "./event-links";

describe("event sharing links", () => {
  it("builds a Google Maps search from venue name and address", () => {
    expect(getGoogleMapsSearchUrl({ location_name: "金色三麥 美麗華店", location_address: "台北市中山區敬業三路20號" }))
      .toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(getGoogleMapsSearchUrl({ location_name: null, location_address: "台北" })).toBeNull();
  });

  it("encodes a LINE share message", () => {
    const url = getLineShareUrl("一起聚一場\nhttps://gather.wedopr.com/app/e/example");
    expect(url.startsWith("https://line.me/R/msg/text/?")).toBe(true);
    expect(url).toContain(encodeURIComponent("一起聚一場"));
  });
});

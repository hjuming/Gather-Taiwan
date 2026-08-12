import { describe, expect, it } from "vitest";
import { getEventShareText, getGoogleMapsEmbedUrl, getGoogleMapsSearchUrl, getLineShareUrl } from "./event-links";

describe("event sharing links", () => {
  it("builds a Google Maps search from venue name and address", () => {
    expect(getGoogleMapsSearchUrl({ location_name: "金色三麥 美麗華店", location_address: "台北市中山區敬業三路20號" }))
      .toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(getGoogleMapsSearchUrl({ location_name: null, location_address: "台北" })).toBeNull();
  });

  it("builds a key-less Google Maps embed URL from whatever location text is available", () => {
    const url = getGoogleMapsEmbedUrl({ location_name: "金色三麥 美麗華店", location_address: "台北市中山區敬業三路20號" });
    expect(url).toContain("https://www.google.com/maps?q=");
    expect(url).toContain("output=embed");
    expect(url).toContain(encodeURIComponent("金色三麥 美麗華店"));

    expect(getGoogleMapsEmbedUrl({ location_name: null, location_address: "台北市中山區" }))
      .toContain(encodeURIComponent("台北市中山區"));
    expect(getGoogleMapsEmbedUrl({ location_name: "  ", location_address: "  " })).toBeNull();
    expect(getGoogleMapsEmbedUrl({})).toBeNull();
  });

  it("encodes a LINE share message", () => {
    const url = getLineShareUrl("一起聚一場\nhttps://gather.wedopr.com/app/e/example");
    expect(url.startsWith("https://line.me/R/msg/text/?")).toBe(true);
    expect(url).toContain(encodeURIComponent("一起聚一場"));
  });

  it("formats share text without a 12-hour marker", () => {
    const text = getEventShareText(
      {
        title: "迎新晚會",
        summary: "相招來聚會",
        starts_at: "2026-08-10T10:30:00.000Z",
        ends_at: "2026-08-10T13:30:00.000Z",
        location_name: "金色三麥",
        location_address: "台北市中山區",
        fee_amount: "1000",
        capacity: 30,
      },
      "https://gather.wedopr.com/app/e/welcome",
    );
    expect(text).toContain("2026-08-10（一）18:30–21:30");
    expect(text).toContain("18:30");
    expect(text).toContain("21:30");
    expect(text).toContain("費用：NT$ 1000");
    expect(text).toContain("人數上限：30 人");
    expect(text).toContain("地點：金色三麥");
    expect(text).toContain("地址：台北市中山區");
    expect(text).toContain("想參加，請點此連結：\nhttps://gather.wedopr.com/app/e/welcome");
    expect(text).not.toContain("**");
    expect(text).not.toContain("[金色三麥]");
    expect(text).not.toContain("google.com/maps");
    expect(text).not.toContain("下午");
  });
});

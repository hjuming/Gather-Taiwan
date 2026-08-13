import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LocationSearchField from "./LocationSearchField";

describe("LocationSearchField", () => {
  it("uses a keyless Google Maps preview instead of an address search endpoint", () => {
    const markup = renderToStaticMarkup(
      <LocationSearchField
        locationName="魚菜居酒屋"
        locationAddress="105臺北市松山區南京東路五段250巷5-2號"
        onLocationNameChange={() => undefined}
        onLocationAddressChange={() => undefined}
      />,
    );

    expect(markup).toContain('title="Google 地圖預覽"');
    expect(markup).toContain("https://www.google.com/maps?q=");
    expect(markup).toContain("output=embed");
    expect(markup).toContain("在 Google 地圖開啟 ↗");
    expect(markup).not.toContain("查詢地址");
    expect(markup).not.toContain("OpenStreetMap");
  });
});

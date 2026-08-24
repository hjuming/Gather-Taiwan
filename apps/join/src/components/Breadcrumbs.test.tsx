import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Breadcrumbs from "./Breadcrumbs";

describe("Breadcrumbs", () => {
  it("shows the registration app hierarchy for a route", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/auth"]}>
        <Breadcrumbs />
      </MemoryRouter>,
    );

    expect(markup).toContain('aria-label="麵包屑導覽"');
    expect(markup).toContain("聚場台灣");
    expect(markup).toContain("來聚一場");
    expect(markup).toContain("開始報名");
  });

  it("keeps the app label as the current page on its home route", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/"]}>
        <Breadcrumbs />
      </MemoryRouter>,
    );

    expect(markup).toContain('aria-current="page">來聚一場</span>');
  });
});

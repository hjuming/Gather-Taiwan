/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "./AuthPage";

describe("AuthPage LINE login entry", () => {
  it("uses a same-origin POST form so OAuth start cannot be prefetched as a GET", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/auth?redirect=%2Fevents%2Fdemo"]}>
        <AuthPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('method="post"');
    expect(markup).toContain('action="/app/auth/line/authorize"');
    expect(markup).toContain('name="redirect"');
    expect(markup).toContain('value="/events/demo"');
    expect(markup).not.toContain("window.location.href");
  });

  it("offers email password login with a visibility toggle", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthPage />
      </MemoryRouter>,
    );

    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain('aria-label="顯示密碼"');
    expect(markup).toContain("第一次使用？用 email 驗證碼建立帳號");
  });
});

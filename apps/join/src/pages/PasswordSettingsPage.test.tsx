/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/useSession", () => ({
  useSession: () => ({
    loading: false,
    session: {
      user: {
        id: "password-settings-test-user",
        email: "line+test@users.noreply.gather.wedopr.com",
      },
    },
  }),
}));

import PasswordSettingsPage from "./PasswordSettingsPage";

describe("PasswordSettingsPage login identity guidance", () => {
  it("shows the exact login email and email binding flow", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/account/password"]}>
        <PasswordSettingsPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("line+test@users.noreply.gather.wedopr.com");
    expect(markup).toContain("這是 LINE 建立的系統登入身份，不是你平常使用的 email");
    expect(markup).toContain("請先綁定自己的 email 並完成確認");
    expect(markup).toContain("完成 Email 確認後設定");
    expect(markup).toContain("綁定自己的 email");
    expect(markup).toContain("寄送確認信");
    expect(markup).toContain("確認後才可用新 email＋目前密碼登入");
    expect(markup).toContain("若系統要求確認原本與新的 email");
    expect(markup).toContain('aria-label="顯示密碼"');
  });
});

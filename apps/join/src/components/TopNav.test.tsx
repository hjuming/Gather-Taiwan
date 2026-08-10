import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TopNav from "./TopNav";

vi.mock("../lib/useSession", () => ({
  useSession: () => ({ session: null, loading: false }),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

describe("TopNav responsive menu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an accessible menu toggle for compact layouts", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <TopNav />
      </MemoryRouter>,
    );

    expect(markup).toContain('class="menu-toggle"');
    expect(markup).toContain('aria-controls="top-nav-menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="開啟選單"');
    expect(markup).toContain('id="top-nav-menu"');
  });
});

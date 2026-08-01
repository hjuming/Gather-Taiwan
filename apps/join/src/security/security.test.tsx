import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SafeExternalLink, SafeRichText, sanitizeRichText, sanitizeUrl } from "./security";

describe("URL scheme allowlist", () => {
  it("allows only explicit approved schemes", () => {
    expect(sanitizeUrl("https://join.gather.wedopr.com/path")).toBe("https://join.gather.wedopr.com/path");
    expect(sanitizeUrl("http://join.gather.wedopr.com/path")).toBe("http://join.gather.wedopr.com/path");
    expect(sanitizeUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(sanitizeUrl("tel:+886212345678")).toBe("tel:+886212345678");
  });

  it.each([
    "",
    " https://join.gather.wedopr.com",
    "https://join.gather.wedopr.com ",
    "/events/example",
    "//example.com",
    "javascript:alert(1)",
    "javascript%3Aalert(1)",
    "data%3Atext/html,alert(1)",
    "ftp://example.com/file",
  ])("rejects %j", (value) => {
    expect(sanitizeUrl(value)).toBeNull();
  });
});

describe("rich text sanitizer", () => {
  it("removes executable markup and unsafe links", () => {
    const result = sanitizeRichText(
      '<p onclick="alert(1)">歡迎 <img src=x onerror="alert(1)"><a href="javascript:alert(1)">危險</a><a href="https://example.com">安全</a></p>',
    );

    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("javascript:");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="nofollow noopener noreferrer"');
  });
});

describe("safe renderers", () => {
  it("renders a rejected external URL as non-clickable text", () => {
    const markup = renderToStaticMarkup(
      <SafeExternalLink href="data:text/html,alert(1)">不安全</SafeExternalLink>,
    );

    expect(markup).toBe("<span>不安全</span>");
  });

  it("renders approved external URLs with isolated browsing context", () => {
    const markup = renderToStaticMarkup(
      <SafeExternalLink href="https://example.com">安全</SafeExternalLink>,
    );

    expect(markup).toContain('href="https://example.com"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="nofollow noopener noreferrer"');
  });

  it("passes sanitized rich text to the DOM only", () => {
    const markup = renderToStaticMarkup(
      <SafeRichText html={'<a href="javascript:alert(1)" onclick="alert(1)">危險</a>'} />,
    );

    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("onclick");
  });
});

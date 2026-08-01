import DOMPurify from "dompurify";
import type { AnchorHTMLAttributes, ReactNode } from "react";

const ALLOWED_SCHEMES = new Set(["https:", "http:", "mailto:", "tel:"]);

export function sanitizeUrl(value: string): string | null {
  if (!value || value.trim() !== value) return null;

  try {
    const url = new URL(value);
    return ALLOWED_SCHEMES.has(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName !== "A") return;

  const href = node.getAttribute("href");
  const safeHref = href ? sanitizeUrl(href) : null;

  if (!safeHref) {
    node.removeAttribute("href");
    return;
  }

  node.setAttribute("href", safeHref);
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "nofollow noopener noreferrer");
});

export function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ["a", "b", "blockquote", "br", "em", "li", "ol", "p", "strong", "ul"],
    ALLOWED_ATTR: ["href", "rel", "target"],
  });
}

type SafeExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "rel" | "target"> & {
  children: ReactNode;
  href: string;
};

export function SafeExternalLink({ children, href, ...props }: SafeExternalLinkProps) {
  const safeHref = sanitizeUrl(href);

  if (!safeHref) return <span>{children}</span>;

  return (
    <a {...props} href={safeHref} target="_blank" rel="nofollow noopener noreferrer">
      {children}
    </a>
  );
}

export function SafeRichText({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}

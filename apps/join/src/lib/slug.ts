export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createSlug(value: string, fallback: string, maxLength: number): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  const maxBaseLength = Math.max(1, maxLength - suffix.length - 1);
  const candidate = slugify(value) || slugify(fallback) || "item";
  const base = candidate.slice(0, maxBaseLength).replace(/-+$/, "") || "item";
  return `${base}-${suffix}`;
}

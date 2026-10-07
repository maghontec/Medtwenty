export function gbp(pence: number | null | undefined): string {
  if (pence == null) return "";
  const pounds = pence / 100;
  return "£" + (Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/£/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  story: "Daily story",
  briefing: "Weekly briefing",
  analysis: "Monthly analysis",
};

export function excerpt(markdown: string, words = 45): string {
  const text = markdown
    .replace(/^#+\s.*$/gm, "")
    .replace(/\|.*\|/g, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const parts = text.split(" ");
  return parts.length > words ? parts.slice(0, words).join(" ") + "…" : text;
}

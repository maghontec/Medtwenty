import { Marked } from "marked";
import { escapeHtml } from "./format";

// Article bodies are Markdown written by staff (or drafted by the n8n pipeline).
// Raw HTML is escaped and links are restricted to http(s)/mailto/relative.
const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html(token) {
      return escapeHtml(typeof token === "string" ? token : token.text);
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : "#";
      const external = /^https?:/i.test(safe);
      return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${text}</a>`;
    },
    image({ href, text }) {
      const safe = /^(https?:|\/)/i.test(href) ? href : "";
      return safe ? `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}" loading="lazy" />` : "";
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src || "", { async: false }) as string;
}

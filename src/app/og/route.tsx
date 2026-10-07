import { ImageResponse } from "next/og";

// Generated social image: wordmark and headline on cream, rust rule.
export function GET(req: Request) {
  const title = (new URL(req.url).searchParams.get("title") || "UK Healthcare Business Intelligence").slice(0, 140);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f1e7", padding: 72, fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#1f2228" }}>
          Med<span style={{ color: "#a64f1c" }}>Twenty</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 120, height: 8, background: "#a64f1c", marginBottom: 32 }} />
          <div style={{ fontSize: 60, lineHeight: 1.15, fontWeight: 700, color: "#1f2228" }}>{title}</div>
        </div>
        <div style={{ fontSize: 22, letterSpacing: 4, color: "#5b5e66", textTransform: "uppercase" }}>UK Healthcare Business Intelligence</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

"use client";

import { useState } from "react";

type P = { id: number; headline: string; meta: string };

export function BriefingPicker({ pieces }: { pieces: P[] }) {
  const [chosen, setChosen] = useState<P[]>(pieces.slice(0, 5));
  const [drag, setDrag] = useState<number | null>(null);
  const rest = pieces.filter((p) => !chosen.some((c) => c.id === p.id));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= chosen.length) return;
    const next = [...chosen];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setChosen(next);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="eyebrow mb-3 text-muted">In the briefing ({chosen.length}/5) · drag to reorder</h2>
        <ol className="space-y-2">
          {chosen.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
              className="flex cursor-move items-center gap-3 rounded border border-line bg-white p-3"
            >
              <input type="hidden" name="article_id" value={p.id} />
              <span className="font-serif text-2xl font-bold text-rust">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{p.headline}</p>
                <p className="text-xs text-muted">{p.meta}</p>
              </div>
              <div className="flex flex-col">
                <button type="button" aria-label="Move up" onClick={() => move(i, i - 1)} className="px-1 text-xs">▲</button>
                <button type="button" aria-label="Move down" onClick={() => move(i, i + 1)} className="px-1 text-xs">▼</button>
              </div>
              <button type="button" aria-label="Remove" onClick={() => setChosen(chosen.filter((c) => c.id !== p.id))} className="text-muted">×</button>
            </li>
          ))}
        </ol>
        {chosen.length < 5 && chosen.length > 0 && <p className="mt-3 text-sm text-muted">A shorter week is fine: the briefing will say so.</p>}
      </section>
      <section className="card p-5">
        <h2 className="eyebrow mb-3 text-muted">Also published this week</h2>
        {rest.length === 0 && <p className="text-sm text-muted">Everything is in the briefing.</p>}
        <ul className="space-y-2">
          {rest.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded border border-line p-3">
              <div>
                <p className="font-medium leading-snug">{p.headline}</p>
                <p className="text-xs text-muted">{p.meta}</p>
              </div>
              <button type="button" disabled={chosen.length >= 5} onClick={() => setChosen([...chosen, p])} className="btn btn-outline btn-sm">Add</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

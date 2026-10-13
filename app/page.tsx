"use client";

import { useState } from "react";
import { OUTINGS } from "../lib/outings";
import type { OutingKey, PlanResponse } from "../lib/types";

interface Row { id: string; name: string; favorites: string }

let counter = 0;
const blank = (name = "", favorites = ""): Row => ({ id: `f${++counter}`, name, favorites });

const EXAMPLE = [
  { name: "Asha", favorites: "Arijit Singh, Dune, Shake Shack" },
  { name: "Ben", favorites: "Taylor Swift, Parasite, Sweetgreen" },
  { name: "Chen", favorites: "Radiohead, Spirited Away, Joe's Pizza" },
];

export default function Home() {
  const [city, setCity] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [outing, setOuting] = useState<OutingKey>("dinner");
  const [notes, setNotes] = useState("");
  const [compare, setCompare] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank()]);
  const [res, setRes] = useState<PlanResponse | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function fillExample() {
    setCity("New York City");
    setRows(EXAMPLE.map((e) => blank(e.name, e.favorites)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setRes(null);
    const friends = rows.map((r) => ({
      id: r.id,
      name: r.name.trim() || "Friend",
      favorites: r.favorites.split(",").map((s) => s.trim()).filter(Boolean),
    }));
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, outing, notes, compare, priceMax: priceMax ? Number(priceMax) : undefined, friends }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Something went wrong.");
      setNames(Object.fromEntries(friends.map((f) => [f.id, f.name])));
      setRes(data);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header className="intro">
        <h1>Where can all of us agree?</h1>
        <p>
          Add each friend&apos;s favourite artists, films, restaurants or brands. We find places the
          whole group will enjoy, and show who is compromising the most on each pick.
        </p>
      </header>

      <form onSubmit={submit}>
        <h2>Your group</h2>
        {rows.map((r, i) => (
          <div className="friend" key={r.id}>
            <label htmlFor={`n-${r.id}`}>Friend {i + 1} name</label>
            <input id={`n-${r.id}`} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            <label htmlFor={`f-${r.id}`}>Favourites, separated by commas (up to 5)</label>
            <textarea
              id={`f-${r.id}`}
              rows={2}
              value={r.favorites}
              onChange={(e) => update(r.id, { favorites: e.target.value })}
            />
            {rows.length > 2 && (
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                  Remove {r.name.trim() || `friend ${i + 1}`}
                </button>
              </div>
            )}
          </div>
        ))}

        <label htmlFor="city">City</label>
        <input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
        <label htmlFor="outing">Outing type</label>
        <select id="outing" value={outing} onChange={(e) => setOuting(e.target.value as OutingKey)}>
          {Object.entries(OUTINGS).map(([key, o]) => (
            <option key={key} value={key}>{o.label}</option>
          ))}
        </select>
        <label htmlFor="price">Budget</label>
        <select id="price" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}>
          <option value="">Any budget</option>
          <option value="1">Level 1 (cheapest)</option>
          <option value="2">Up to level 2</option>
          <option value="3">Up to level 3</option>
          <option value="4">Up to level 4</option>
        </select>
        <label htmlFor="notes">Anything else? (optional)</label>
        <input
          id="notes"
          maxLength={200}
          placeholder="e.g. quiet place, vegetarian options, not too touristy"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Also show what an LLM says without Qloo
        </label>

        <div className="actions">
          <button type="submit" disabled={busy}>{busy ? "Finding places…" : "Find a place"}</button>
          {rows.length < 6 && (
            <button type="button" className="ghost" onClick={() => setRows((rs) => [...rs, blank()])}>
              Add a friend
            </button>
          )}
          <button type="button" className="ghost" onClick={fillExample}>Use an example group</button>
        </div>
      </form>

      <section aria-live="polite">
        <h2>Top picks</h2>
        {err && <div className="error">{err}</div>}
        {res?.warnings.map((w) => <div className="note" key={w}>{w}</div>)}
        {!res && !err && <p className="empty">Fill in the group and choose Find a place.</p>}
        {res && res.ranked.length > 0 && (
          <p className="empty">
            Ranking compares each friend with their own usual match level, so one friend&apos;s generally
            lower scores do not decide every pick.
          </p>
        )}
        {res && res.ranked.length === 0 && !err && <p className="empty">No places found. Try another city.</p>}

        {res?.agent && (
          <details className="resolved" open>
            <summary>What the agent did with your notes</summary>
            <ul>{res.agent.trace.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </details>
        )}

        {res?.ranked.map((p) => {
          const lowest = Object.entries(p.raw).sort((a, b) => a[1] - b[1])[0];
          const weakest = lowest?.[0];
          return (
            <article className="place" key={p.id}>
              <h3>{p.name}</h3>
              <p className="fit">
                Group fit {Math.round(p.combined * 100)}. Lowest match: {weakest ? `${names[weakest] ?? weakest} (${Math.round(lowest[1] * 100)})` : "n/a"}.
              </p>
              {p.explanation && <p className="why">{p.explanation}</p>}
              {p.tags && p.tags.length > 0 && <p className="tags">{p.tags.join(" · ")}</p>}
              {Object.entries(p.raw).map(([id, v]) => {
                const via = (p.why?.[id] ?? []).slice(0, 2).map((w) => w.name).join(", ");
                return (
                  <div key={id}>
                    <div className={`bar${id === weakest ? " weak" : ""}`}>
                      <span>{names[id] ?? id}</span>
                      <div className="track"><div className="fill" style={{ width: `${Math.round(v * 100)}%` }} /></div>
                      <span>{Math.round(v * 100)}</span>
                    </div>
                    {via && <div className="via">via {via}</div>}
                  </div>
                );
              })}
            </article>
          );
        })}

        {res?.llmOnly && res.llmOnly.length > 0 && (
          <div className="llmonly">
            <h2>LLM only, no Qloo</h2>
            <p className="empty">These come from the model&apos;s memory and may be wrong or invented. The picks above come from Qloo data.</p>
            {res.llmOnly.map((p) => (
              <article className="place alt" key={p.name}>
                <h3>{p.name}</h3>
                <p className="why">{p.why}</p>
              </article>
            ))}
          </div>
        )}

        {res?.resolved && res.resolved.length > 0 && (
          <details className="resolved">
            <summary>How Qloo read your favourites</summary>
            <ul>
              {res.resolved.map((r, i) => (
                <li key={i}>
                  {r.friend}: {r.input} → {r.matched ? `${r.matched}${r.note ? ` (${r.note})` : ""}` : "not found"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </main>
  );
}

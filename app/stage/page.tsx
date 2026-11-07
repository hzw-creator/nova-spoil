"use client";
/**
 * /stage — the presentation screen (laptop on the projector). Owner: Agent C.
 * v0 = ugly but working wiring so A and B can test end-to-end. C replaces the layout
 * with the real design (camera panel · agent timeline · phone mockup · map · counters).
 */
import { useEffect, useState } from "react";
import type { RunResponse, WorldState } from "@/shared/contracts";
import { api } from "@/components/api";

export default function Stage() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.state().then(setWorld).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => api.tick(10).then(setWorld).catch((e) => setErr(String(e))), 1000);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <main className="p-6 space-y-4 font-mono text-sm">
      <h1 className="text-2xl font-bold">Spoil Pricing — wiring test (Agent C replaces this)</h1>
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-zinc-700 rounded" onClick={() => api.reset().then((w) => { setWorld(w); setRun(null); })}>Reset</button>
        <button className="px-3 py-1 bg-red-600 rounded" onClick={() => api.run("mock").then((r) => { setRun(r); setWorld(r.world); }).catch((e) => setErr(String(e)))}>Run (mock scan)</button>
        <button className="px-3 py-1 bg-zinc-700 rounded" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"} sim</button>
      </div>
      {err && <p className="text-red-400">{err}</p>}
      {world && (
        <section>
          <p>Sim time: {new Date(world.simTime).toUTCString()}</p>
          <pre>{JSON.stringify(world.metrics, null, 2)}</pre>
          <p>Live specials: {world.specials.filter((s) => s.status === "live").map((s) => `${s.emoji} ${s.name} $${s.price}`).join(" · ") || "none"}</p>
          <p>Events:</p>
          <ul>{world.events.slice(0, 8).map((e) => <li key={e.id}>{e.message}</li>)}</ul>
        </section>
      )}
      {run && <pre className="text-xs opacity-70">{JSON.stringify(run.plan.trace, null, 2)}</pre>}
    </main>
  );
}

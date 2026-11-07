"use client";
/**
 * /phone — standalone mock delivery-app screen (can be opened on a real phone on the same
 * wifi via http://<laptop-ip>:3000/phone). Owner: Agent C. v0 = polls state every 2 s.
 */
import { useEffect, useState } from "react";
import type { WorldState } from "@/shared/contracts";
import { api } from "@/components/api";

export default function Phone() {
  const [world, setWorld] = useState<WorldState | null>(null);
  useEffect(() => {
    const load = () => api.state().then(setWorld).catch(() => {});
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);
  const live = world?.specials.filter((s) => s.status === "live") ?? [];
  return (
    <main className="max-w-sm mx-auto p-4 bg-white text-black min-h-screen">
      <h1 className="text-xl font-bold">{world?.restaurant.name ?? "Loading…"}</h1>
      {live.map((s) => (
        <div key={s.id} className="my-3 p-3 rounded-xl border-2 border-red-600">
          <p className="font-bold">{s.emoji} {s.name} <span className="text-red-600">−{s.discountPct}%</span></p>
          <p className="text-sm">{s.description}</p>
          <p><s>${s.originalPrice.toFixed(2)}</s> <b>${s.price.toFixed(2)}</b> · {s.unitsAvailable - s.unitsSold} left</p>
        </div>
      ))}
      {world?.menu.map((m) => <p key={m.id} className="py-1 border-b">{m.emoji} {m.name} — ${m.price.toFixed(2)}</p>)}
    </main>
  );
}

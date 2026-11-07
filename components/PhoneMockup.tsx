"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { Special, WorldState } from "@/shared/contracts";
export const money = (n: number) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(n);
export function PhoneMockup({world, notification, standalone=false}: {world:WorldState|null; notification?:Special; standalone?:boolean}) {
  return <div className={`phone-shell ${standalone?'standalone':''}`}><div className="phone-status"><span>9:41</span><span className="island"/><span>▮▮▮ ◕</span></div><div className="phone-screen">
    <AnimatePresence>{notification && <motion.div key={notification.id} className="push" initial={{y:-70,opacity:0}} animate={{y:0,opacity:1}} exit={{opacity:0}}><small>FRESH DROP · NOW</small><strong>{notification.emoji} {notification.name}</strong><span>Today only · {money(notification.price)}</span></motion.div>}</AnimatePresence>
    <div className="delivery-top"><b>←</b><span>Deliver to <strong>Oakland ⌄</strong></span><b>♡</b></div><div className="cafe-art"><span>☀</span><div>GOOD FOOD.<br/>BRIGHTER DAYS.</div></div>
    <div className="restaurant"><small>LOCAL FAVORITE</small><h2>{world?.restaurant.name ?? 'Sunny Side Café'}</h2><p>★ 4.9 <span>(200+) · Café · $</span></p><div className="delivery-info"><span>20–30 min<br/><b>Delivery time</b></span><span>$0.99<br/><b>Delivery fee</b></span></div></div>
    <div className="phone-menu"><div className="menu-heading"><h3>Fresh drops</h3><span>Made for today</span></div>
    {!world && <p className="phone-empty">Loading the café…</p>}
    {world && world.specials.length===0 && <p className="phone-empty">Something good is on its way.<br/>Today’s specials will appear here.</p>}
    <AnimatePresence>{world?.specials.filter(s=>s.status!=='expired').map(s=><motion.article layout key={s.id} initial={{y:16,opacity:0}} animate={{y:0,opacity:1}} className={`special-card ${s.status==='sold_out'?'sold-out':''}`}><div className="dish-art"><span>{s.emoji}</span><b>{s.status==='sold_out'?'SOLD OUT':`−${s.discountPct}%`}</b></div><div className="dish-copy"><h4>{s.name}</h4><p>{s.description}</p><div><strong>{money(s.price)}</strong> <s>{money(s.originalPrice)}</s><span className="remaining">{s.status==='sold_out'?'All gone!':`${Math.max(0,s.unitsAvailable-s.unitsSold)} left`}</span></div></div></motion.article>)}</AnimatePresence>
    <h3 className="regular-title">Café classics</h3>{world?.menu.map(m=><div className="menu-row" key={m.id}><span className="menu-emoji">{m.emoji}</span><div><b>{m.name}</b><small>{m.available?money(m.price):'Currently unavailable'}</small></div><span className="add-dish">+</span></div>)}
    <p className="prototype">DoorDash-style prototype · simulated orders</p></div></div><div className="phone-home"/></div>;
}

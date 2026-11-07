"use client";
import type { ScanResult, WorldState } from '@/shared/contracts';
import { money } from './PhoneMockup';
const quantity=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export function StockSummary({world,scan}:{world:WorldState|null;scan?:ScanResult}){
 if(!world)return <section className="panel stock-panel"><h2>Loading stock…</h2></section>;
 const usable=world.inventory.filter(l=>l.freshness>1&&l.daysLeft>0);
 const atRisk=usable.filter(l=>l.freshness<=3||l.daysLeft<=2);
 const cost=(lots:typeof usable)=>lots.reduce((sum,l)=>sum+l.qty*(world.ingredients.find(i=>i.id===l.ingredientId)?.unitCost??0),0);
 const stocked=world.ingredients.filter(i=>usable.some(l=>l.ingredientId===i.id&&l.qty>0)).length;
 return <section className="panel stock-panel"><div className="panel-heading"><span>YOUR STOCKROOM</span><small>LIVE INVENTORY · {world.inventory.length} BATCHES</small></div>
 <div className="stock-summary"><div><strong>{stocked}<small> / {world.ingredients.length}</small></strong><span>Ingredients in stock</span></div><div><strong>{money(cost(usable))}</strong><span>Usable stock at cost</span></div><div><strong>{money(cost(atRisk))}</strong><span>At-risk stock at cost</span></div></div>
 <p className="stock-help">Seeded stock is your starting inventory. A photo replaces the observed ingredient’s camera batch; it does not add a delivery or replace every batch. Photo batch is included in On hand, alongside starting stock. Sales and spoilage reduce quantities. Quality-2 stock is used only in specials under the synthetic kitchen rule.</p>
 <div className="stock-table-wrap"><table className="stock-table"><thead><tr><th>Ingredient</th><th>On hand</th><th>Photo batch</th><th>Usable</th><th>At risk</th><th>Next expiry</th><th>Status / batches</th></tr></thead><tbody>{world.ingredients.map(ing=>{
 const lots=world.inventory.filter(l=>l.ingredientId===ing.id&&l.qty>0),good=lots.filter(l=>l.freshness>1&&l.daysLeft>0),risk=good.filter(l=>l.daysLeft<=2||l.freshness<=3);
 const sum=(ls:typeof lots)=>ls.reduce((s,l)=>s+l.qty,0),days=good.length?Math.min(...good.map(l=>l.daysLeft)):null;
 const status=!good.length?'Out of stock':good.some(l=>l.freshness===2)?'Use today':risk.length?'Use soon':'Fresh';
 return <tr key={ing.id}><td><span className="stock-emoji">{ing.emoji}</span><strong>{ing.name}</strong><small>{money(ing.unitCost)} / {ing.unit}</small></td><td>{quantity(sum(lots))} <small>{ing.unit}</small></td><td>{lots.some(l=>l.id===`lot_cam_${ing.id}`)?quantity(sum(lots.filter(l=>l.id===`lot_cam_${ing.id}`))):'—'}</td><td>{quantity(sum(good))}</td><td className={risk.length?'stock-risk':''}>{quantity(sum(risk))}</td><td>{days===null?'—':days<1?`${Math.max(0,Math.round(days*24))} hr`:`${quantity(days)} days`}</td><td><span className={`stock-status ${status==='Fresh'?'fresh':status==='Out of stock'?'empty':'soon'}`}>{status}</span><details><summary>{lots.length} batches</summary>{lots.map(l=><p key={l.id}>{l.source==='scan'?'Photo update':'Starting stock'} · {quantity(l.qty)} {ing.unit} · quality {l.freshness}/5 · {quantity(l.daysLeft)} days</p>)}</details></td></tr>;
 })}</tbody></table></div>
 {scan&&<div className="stock-receipt"><strong>{scan.mock?'Fixture stock update':'Photo observation'} · {scan.items.length} observations</strong><p>{scan.items.map(i=>`${i.label}: ${i.ingredientId===null?'not applied — needs review':!['banana','avocado','bread'].includes(i.ingredientId)?'observation only — photo updates not supported yet':i.freshness===1?'flagged stock discarded':`${quantity(i.count)} ${world.ingredients.find(g=>g.id===i.ingredientId)?.unit??''}, quality ${i.freshness}/5`}`).join(' · ')}</p>{scan.mock&&<p>No photo was analyzed. Configure the model key for live stock observations.</p>}</div>}
 </section>;
}

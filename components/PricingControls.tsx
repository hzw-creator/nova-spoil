"use client";
import type { WorldState } from '@/shared/contracts';
import { money } from './PhoneMockup';
export type PricingInput={minGrossMarginPct:number;maxDiscountPct:number};
export function PricingControls({value,onChange,disabled,world}:{value:PricingInput;onChange:(v:PricingInput)=>void;disabled:boolean;world:WorldState|null}){
 return <section className="panel pricing-panel"><div className="panel-heading"><span>PRICING PREFERENCES</span><small>APPLIED ON YOUR NEXT SCAN</small></div><div className="pricing-body"><h2>Pricing settings</h2><p>Prices respond to remaining shelf life, surplus, recipe cost and these limits. The AI selects a recipe; the server calculates and validates the quote.</p>
 <label htmlFor="margin">Minimum ingredient gross margin <strong>{value.minGrossMarginPct}%</strong></label><input id="margin" type="range" min="35" max="80" step="1" value={value.minGrossMarginPct} disabled={disabled} onChange={e=>onChange({...value,minGrossMarginPct:Number(e.target.value)})}/><div className="range-labels"><span>35% · prioritize moving stock</span><span>80% · protect margin</span></div>
 <label htmlFor="discount">Maximum menu discount <strong>{value.maxDiscountPct}%</strong></label><input id="discount" type="range" min="0" max="60" step="1" value={value.maxDiscountPct} disabled={disabled} onChange={e=>onChange({...value,maxDiscountPct:Number(e.target.value)})}/><div className="range-labels"><span>0% · full menu price</span><span>60% · deeper markdown</span></div>
 <div className="price-formula">Minimum price = ingredient cost ÷ (1 − target margin), with a discount cap and existing cost guard. If no valid price fits the menu price, no special is offered.</div>
 <p className="pricing-disclaimer">Ingredient gross margin excludes labor, packaging, delivery fees and pantry staples. These are pricing rules, not learned market demand. Existing offers keep their published price.</p>
 {world&&world.specials.filter(s=>s.status==='live').length>0&&<div className="quote-breakdown"><h3>Published offers · actual quotes</h3>{world.specials.filter(s=>s.status==='live').map(s=>{const recipe=world.recipes.find(r=>r.id===s.recipeId);const cost=recipe?.ingredients.reduce((sum,l)=>sum+l.qty*(world.ingredients.find(i=>i.id===l.ingredientId)?.unitCost??0),0)??0;return <div key={s.id}><strong>{s.name}</strong><span>{money(s.price)} · cost {money(cost)} · {s.price?((1-cost/s.price)*100).toFixed(1):'0'}% ingredient margin · {s.discountPct}% off</span></div>;})}</div>}
 </div></section>;
}

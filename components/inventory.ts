import type { Ingredient, InventoryLot, WorldState } from '@/shared/contracts';
export const qualityLabels=['Blocked','Use today','Use soon','Good','Fresh'] as const;
export const qualityColors=['#f07f79','#f5ae6c','#e8cd7a','#85cbb6','#cceba1'] as const;
export const qty=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
export type StockRow={ingredient:Ingredient;lots:InventoryLot[];onHand:number;photo:number;usable:number;risk:number;expiry:number;quality:number;cost:number;status:string;rank:number;levels:number[]};
export function stockRows(world:WorldState):StockRow[]{return world.ingredients.map(ingredient=>{
 const lots=world.inventory.filter(l=>l.ingredientId===ingredient.id&&l.qty>0);
 const good=lots.filter(l=>l.freshness>1&&l.daysLeft>0),risk=good.filter(l=>l.daysLeft<=2||l.freshness<=3);
 const sum=(ls:InventoryLot[])=>ls.reduce((s,l)=>s+l.qty,0),onHand=sum(lots),usable=sum(good);
 const levels=Array.from({length:5},(_,i)=>sum(lots.filter(l=>l.freshness===i+1)));
 const rank=!onHand?0:lots.some(l=>l.freshness===1||l.daysLeft<=0)?1:!usable?0:good.some(l=>l.freshness===2)?2:risk.length?3:4;
 return {ingredient,lots,onHand,photo:sum(lots.filter(l=>l.id===`lot_cam_${ingredient.id}`)),usable,risk:sum(risk),expiry:good.length?Math.min(...good.map(l=>l.daysLeft)):Infinity,quality:onHand?lots.reduce((s,l)=>s+l.qty*l.freshness,0)/onHand:0,cost:onHand*ingredient.unitCost,status:['Out of stock','Blocked stock','Use today','Use soon','Fresh'][rank],rank,levels};
});}

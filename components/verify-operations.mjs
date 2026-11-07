// Local-only integration check. Resets synthetic state; never calls a live model.
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://localhost:3000';
async function call(path,body){const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function run(pricing){assert.equal((await call('/api/world/reset',{})).status,200);const out=await call('/api/brain/run',{imageDataUrl:'mock',pricing});assert.equal(out.status,200);assert.equal(out.data.scan.mock,true);for(const special of out.data.world.specials.filter(s=>s.status==='live')){const recipe=out.data.world.recipes.find(r=>r.id===special.recipeId);const cost=recipe.ingredients.reduce((sum,l)=>sum+l.qty*out.data.world.ingredients.find(i=>i.id===l.ingredientId).unitCost,0);assert.ok((1-cost/special.price)*100+1e-7>=pricing.minGrossMarginPct);assert.ok((1-special.price/recipe.basePrice)*100<=pricing.maxDiscountPct+1e-7);}return out.data;}
const standard=await run({minGrossMarginPct:40,maxDiscountPct:60});
const full=await run({minGrossMarginPct:40,maxDiscountPct:0});
assert.ok(full.world.specials.length>0);for(const s of full.world.specials)assert.equal(s.price,s.originalPrice);
const common=standard.world.specials.find(s=>full.world.specials.some(f=>f.recipeId===s.recipeId));assert.ok(common);assert.ok(full.world.specials.find(s=>s.recipeId===common.recipeId).price>common.price);
await run({minGrossMarginPct:80,maxDiscountPct:60});
const before=(await call('/api/world/state')).data;const invalid=await call('/api/brain/run',{imageDataUrl:'mock',pricing:{minGrossMarginPct:99,maxDiscountPct:0}});assert.equal(invalid.status,400);assert.deepEqual((await call('/api/world/state')).data,before);
await call('/api/world/reset',{});const start=(await call('/api/world/state')).data;let end;for(let i=0;i<24;i++){const tick=await call('/api/world/tick',{minutes:60});assert.equal(tick.status,200);end=tick.data;assert.ok(end.inventory.every(l=>l.qty>=0));}assert.equal(new Date(end.simTime)-new Date(start.simTime),86400000);
console.log('PASS: pricing controls change real quotes; margin/discount bounds enforced; invalid settings leave stock unchanged; 24 ticks advance exactly one day with no negative stock.');
await call('/api/world/reset',{});

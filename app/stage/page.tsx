"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplayResult, RunResponse, Special, WorldState } from '@/shared/contracts';
import { api } from '@/components/api';
import { CameraPanel, type CameraHandle } from '@/components/CameraPanel';
import { Timeline } from '@/components/Timeline';
import { PhoneMockup } from '@/components/PhoneMockup';
import { OrderMap } from '@/components/OrderMap';
import { Counters } from '@/components/Counters';
import { StockSummary } from '@/components/StockSummary';
import { PricingControls, type PricingInput } from '@/components/PricingControls';
import { money } from '@/components/PhoneMockup';
import { ReplayChart } from '@/components/ReplayChart';
const message=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Please try again.';
export default function Stage(){
 const [world,setWorld]=useState<WorldState|null>(null),[phoneWorld,setPhoneWorld]=useState<WorldState|null>(null),[run,setRun]=useState<RunResponse|null>(null);
 const [playing,setPlaying]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(0),[notification,setNotification]=useState<Special>();
 const [view,setView]=useState('live'),[replay,setReplay]=useState<ReplayResult|null>(null),[replayLoading,setReplayLoading]=useState(false);
 const [pricing,setPricing]=useState<PricingInput>({minGrossMarginPct:40,maxDiscountPct:60});
 const [stockReady,setStockReady]=useState(true);
 const [dayRun,setDayRun]=useState<{start:number;target:number;orders:number;sales:number;discarded:number}|null>(null);
 const [dayReport,setDayReport]=useState<{orders:number;sales:number;discarded:number}|null>(null);
 const currentWorld=useRef<WorldState|null>(null);
 useEffect(()=>{currentWorld.current=world;},[world]);
 const camera=useRef<CameraHandle>(null),locked=useRef(false),tick=useRef<Promise<void>|null>(null),mounted=useRef(true),generation=useRef(0);
 useEffect(()=>{mounted.current=true;let active=true;api.state().then(w=>{if(active){setWorld(w);setPhoneWorld(w);}}).catch(e=>{if(active)setError(message(e));});if(new URLSearchParams(location.search).get('view')==='replay')setView('replay');return()=>{active=false;mounted.current=false;generation.current++;};},[]);
 const loadReplay=useCallback(async()=>{setReplayLoading(true);setError('');try{const r=await api.replay();if(mounted.current)setReplay(r);}catch(e){if(mounted.current)setError(message(e));}finally{if(mounted.current)setReplayLoading(false);}},[]);
 useEffect(()=>{if(view==='replay'&&!replay)void loadReplay();},[view,replay,loadReplay]);
 useEffect(()=>{
  if(!playing||busy||view!=='live')return;
  const id=setInterval(()=>{
   if(locked.current||tick.current)return;
   const now=currentWorld.current;
   if(!now)return;
   const remaining=dayRun?Math.round((dayRun.target-new Date(now.simTime).getTime())/60000):10;
   if(remaining<=0){setPlaying(false);return;}
   tick.current=api.tick(Math.min(dayRun?60:10,remaining)).then(w=>{
    if(!mounted.current)return;
    currentWorld.current=w;setWorld(w);setPhoneWorld(w);
    if(dayRun&&new Date(w.simTime).getTime()>=dayRun.target){
     setPlaying(false);setDayRun(null);setStockReady(false);
     setDayReport({orders:w.metrics.ordersTotal-dayRun.orders,sales:w.metrics.revenueRecoveredUsd-dayRun.sales,discarded:w.metrics.wasteUsdDiscarded-dayRun.discarded});
    }
   }).catch(e=>{if(mounted.current){setError(message(e));setPlaying(false);}}).finally(()=>{tick.current=null;});
  },dayRun?600:1000);
  return()=>clearInterval(id);
 },[playing,busy,view,dayRun]);
 const runDay=async()=>{
  if(locked.current)return;
  await tick.current;
  const w=currentWorld.current;if(!w)return;
  if(!dayRun&&!stockReady)return;
  if(!dayRun){const start=new Date(w.simTime).getTime();setDayRun({start,target:start+1440*60000,orders:w.metrics.ordersTotal,sales:w.metrics.revenueRecoveredUsd,discarded:w.metrics.wasteUsdDiscarded});setDayReport(null);}
  setView('live');setPlaying(true);
 };
 const scan=useCallback(async(mock=false,uploadedImage?:string)=>{if(locked.current)return;locked.current=true;setPlaying(false);setDayRun(null);setBusy(true);setError('');setNotification(undefined);setRun(null);setVisible(0);const seq=++generation.current;
 try{await tick.current;const image=mock?'mock':uploadedImage??camera.current!.capture();if(mock)camera.current?.fixture();const r=await api.run(image,pricing);if(!mounted.current||generation.current!==seq)return;const trace=[...r.plan.trace].sort((a,b)=>a.tMs-b.tMs);r.plan.trace=trace;setRun(r);setWorld(r.world);setStockReady(previous=>previous||r.scan.items.some(item=>item.ingredientId!==null&&['banana','avocado','bread'].includes(item.ingredientId)));
 for(let i=1;i<=trace.length;i++){await new Promise(resolve=>setTimeout(resolve,300));if(!mounted.current||generation.current!==seq)return;setVisible(i);}
 setPhoneWorld(r.world);const ids=new Set(r.plan.decisions.filter(d=>d.action==='CREATE_SPECIAL').map(d=>d.special?.id));setNotification(r.world.specials.find(s=>s.status==='live'&&ids.has(s.id)));
 }catch(e){if(mounted.current)setError(message(e));}finally{locked.current=false;if(mounted.current)setBusy(false);}},[pricing]);
 const reset=useCallback(async()=>{if(locked.current)return;locked.current=true;setBusy(true);setPlaying(false);setDayRun(null);setDayReport(null);setError('');try{await tick.current;const w=await api.reset();setWorld(w);setPhoneWorld(w);setStockReady(true);setRun(null);setVisible(0);setNotification(undefined);camera.current?.clear();}catch(e){setError(message(e));}finally{locked.current=false;setBusy(false);}},[]);
 useEffect(()=>{if(!notification)return;const id=setTimeout(()=>setNotification(undefined),5000);return()=>clearTimeout(id);},[notification]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||(e.target instanceof HTMLElement&&e.target.isContentEditable))return;if(e.code==='Space'){if(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement)return;e.preventDefault();setView('live');void scan();}else if(e.key.toLowerCase()==='m'){setView('live');void scan(true);}else if(e.key.toLowerCase()==='p'&&!locked.current&&world&&stockReady){setPlaying(p=>!p);}else if(e.key.toLowerCase()==='r')void reset();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[scan,reset,world,stockReady]);
 const simDate=world?new Date(world.simTime):null;
 const clock=simDate?.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})??'--:--';
 const date=simDate?.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'})??'Loading simulation';
 const open=simDate?simDate.getUTCHours()>=7&&simDate.getUTCHours()<17:false;
 const progress=dayRun&&simDate?Math.min(100,Math.max(0,(simDate.getTime()-dayRun.start)/(dayRun.target-dayRun.start)*100)):0;
 const blocked=run?.plan.decisions.filter(d=>d.action==='DISCARD')??[];
 return <main className="stage operations-page">
  <header className="stage-header"><a className="brand" href="/stage"><span className="brand-icon">✳</span><div>Spoil Pricing<small>YOUR STOCK. TODAY’S SPECIALS. TOMORROW’S PLAN.</small></div></a><div className="stage-mode"><span className="tag">SIMULATED CAFÉ</span><span>{world?.restaurant.name??'Connecting to café…'}</span><time className="header-clock">{clock}</time></div><a className="phone-link" href="/phone" target="_blank" rel="noreferrer">Customer menu ↗</a></header>
  <div className="stage-toolbar"><div className="view-tabs"><button aria-pressed={view==='live'} onClick={()=>setView('live')}>Stock & operations</button><button aria-pressed={view==='replay'} onClick={()=>{setPlaying(false);setView('replay');}}>7-day comparison</button></div><div className="controls"><button onClick={()=>void reset()} disabled={busy||!world}>Reset café <kbd>R</kbd></button><button onClick={()=>{setView('live');void scan(true);}} disabled={busy||!world}>Use sample stock <kbd>M</kbd></button><button onClick={()=>camera.current?.pickPhoto()} disabled={busy||!world||view!=='live'}>Upload stock photo</button><a className="action-link" href="#stock-camera" onClick={()=>{setView('live');setTimeout(()=>document.getElementById('stock-camera')?.scrollIntoView({behavior:'smooth'}),0);}}>Camera stock ↓</a></div></div>
  {error&&<div role="alert" className="error-banner"><strong>Couldn’t complete that action.</strong> {error}{!world&&<button onClick={()=>{setError('');api.state().then(w=>{setWorld(w);setPhoneWorld(w);}).catch(e=>setError(message(e)));}}>Retry connection</button>}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
  {view==='live'?<>
   <section className="simulation-control" aria-label="Simulation clock and controls"><div className="simulation-clock"><span>SIMULATION CLOCK · {date}</span><strong>{clock}</strong><span className={open?'trading-open':'trading-closed'}>{open?'Café open · serving orders':'Café closed · stock still ages'}</span></div><div className="simulation-action"><h2>{dayReport&&!stockReady?'Day complete. Update your stock.':dayReport&&stockReady?'Stock updated. Ready for another day.':dayRun?playing?'Your day is running':'Day paused':'Stock up. Price it. Run a day.'}</h2><p>{dayReport&&!stockReady?'The simulation has stopped. Upload or capture the next stock batch before continuing.':dayReport&&stockReady?'Review the updated inventory and published prices, then run your next 24 hours.':dayRun?'One simulated hour per step. Stops automatically after 24 hours. Pause at any time.':'1. Capture or upload stock → 2. Check inventory and pricing → 3. Run 24 simulated hours.'}</p><div className="simulation-buttons"><button className="primary" disabled={busy||!world||playing||(!stockReady&&!dayRun)} onClick={()=>void runDay()}>{dayRun?'Resume this day':'Run one day →'}</button><button disabled={busy||!world||!stockReady} onClick={()=>setPlaying(p=>!p)}>{playing?'Ⅱ Pause simulation':dayRun?'▶ Resume day':'▶ Preview 10 min/s'} <kbd>P</kbd></button></div>{dayRun&&<><progress max="100" value={progress} aria-label="Day simulation progress"/><small>{Math.round(progress)}% of 24 hours · auto-stop at {new Date(dayRun.target).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}</small></>}</div></section>
   {dayReport&&<div className="day-report" role="status"><strong>{stockReady?'Stock update received · ready for another day':'24 hours finished · waiting for your next stock photo'}</strong><span>{dayReport.orders} orders · {money(dayReport.sales)} special sales · {money(dayReport.discarded)} discarded ingredient cost</span><a href="#stock-camera">Update stock ↓</a></div>}
   <div className="stock-workspace"><StockSummary world={world} scan={run?.scan}/><PricingControls value={pricing} onChange={setPricing} disabled={busy||playing} world={world}/></div>
   <div className="stage-grid operations-grid"><div className="camera-column" id="stock-camera"><CameraPanel ref={camera} scan={run?.scan} busy={busy} onPhoto={data=>void scan(false,data)} onCapture={()=>void scan()}/>{blocked.length>0&&<div className="safety-card" role="status"><span>◈</span><div><strong>Blocked: unsafe — not sold</strong><p>{blocked.map(d=>world?.ingredients.find(i=>i.id===d.ingredientId)?.name??d.ingredientId).join(', ')} · flagged stock discarded by the demo rule.</p><small>Other eligible ingredients may still become independent specials.</small></div></div>}</div><Timeline run={run} visible={visible} busy={busy&&!run}/><aside className="phone-column"><div className="phone-label"><span>YOUR PUBLISHED CUSTOMER MENU</span><i/></div><PhoneMockup world={phoneWorld} notification={notification}/></aside></div>
   <Counters metrics={world?.metrics}/>
   <div className="neighborhood-workspace"><OrderMap world={world}/><section className="panel recent-orders"><div className="panel-heading"><span>RECENT ORDERS</span><small>SIMULATED CUSTOMERS</small></div>{!world?.recentOrders.length&&<p>Run the simulation to see orders arrive and stock get used.</p>}{world?.recentOrders.slice(0,6).map(o=><div className="order-feed-row" key={o.id}><time>{new Date(o.at).toLocaleTimeString('en-US',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}</time><span>{o.lines.map(l=>l.name).join(', ')}<small>{o.fromSpecial?'Special offer':'Regular menu'}</small></span><b>{money(o.total)}</b></div>)}</section></div>
  </>:<ReplayChart data={replay} loading={replayLoading} onRetry={()=>void loadReplay()}/>}
  <footer className="stage-footer"><span>A DoorDash-style prototype · Nova 2026</span><span>Photos: live AI when configured · sales and stock model: simulated</span><span>Sell it before it spoils. ↗</span></footer>
 </main>;
}

"use client";
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { RunResponse } from '@/shared/contracts';
const icons={vision:'◎',forecast:'↘',llm:'✦',tool:'⌘',guardrail:'◈',publish:'↗'};
export function Timeline({run,visible,busy}:{run:RunResponse|null;visible:number;busy:boolean}) {
 const trace=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(trace.current)trace.current.scrollTop=trace.current.scrollHeight;},[visible]);
 return <section className="panel timeline-panel"><div className="panel-heading"><span>THE AGENT AT WORK</span><small>{busy?'THINKING':run?'COMPLETE':'STANDING BY'}</small></div><div className="timeline-intro"><span className="agent-mark">✦</span><h2>From ripe<br/>to ready.</h2><p>One scan. A smarter special.<br/>Less left behind.</p></div><div ref={trace} className="trace" aria-live="polite">
 {!run&&!busy&&<div className="trace-empty"><span>01 Observe → 02 Plan → 03 Publish</span><p>Scan a batch to follow the decisions.</p></div>}
 {busy&&<div className="thinking"><i/> Looking for a delicious next move…</div>}
 {run?.plan.trace.slice(0,visible).map((s,i)=><motion.div key={`${run.plan.planId}-${i}`} className={`trace-step ${s.kind==='guardrail'?'guard-step':''}`} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:.25}}><span className="trace-icon">{icons[s.kind]}</span><div><small>{s.kind}</small><p>{s.label}</p>{s.detail&&<details><summary>Details</summary><p>{s.detail}</p></details>}</div></motion.div>)}
 </div>{run&&<div className="run-provenance"><span>{run.scan.mock?'Fixture vision':'Live vision'}</span><span>{run.plan.mock?'Deterministic planner':'Model-assisted planner'}</span></div>}</section>;
}

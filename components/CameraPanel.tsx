"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ScanResult } from '@/shared/contracts';
export type CameraHandle = { capture:()=>string; clear:()=>void; fixture:()=>void };
export const CameraPanel = forwardRef<CameraHandle, {scan?:ScanResult; busy:boolean}>(function CameraPanel({scan,busy}, ref) {
 const host=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({w:1,h:1}),[aspect,setAspect]=useState(16/9);
 useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([entry])=>setSize({w:entry.contentRect.width,h:entry.contentRect.height}));observer.observe(host.current);return()=>observer.disconnect();},[]);
 const contentW=Math.min(size.w,size.h*aspect),contentH=contentW/aspect;
 const video=useRef<HTMLVideoElement>(null), stream=useRef<MediaStream|null>(null);
 const [error,setError]=useState(''), [frame,setFrame]=useState(''), [ready,setReady]=useState(false), [starting,setStarting]=useState(false);
 useEffect(()=>()=>stream.current?.getTracks().forEach(t=>t.stop()),[]);
 const start=async()=>{setStarting(true);setError('');try {if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs localhost or HTTPS. Use Mock scan as a backup.');stream.current?.getTracks().forEach(t=>t.stop()); const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play();}setReady(true);setFrame('');}catch(e){setError(e instanceof Error?e.message:'Camera unavailable. Use Mock scan.');}finally{setStarting(false);}};
 useImperativeHandle(ref,()=>({capture(){const v=video.current;if(!v||!ready||!v.videoWidth)throw new Error('Enable the camera first, or press M for an offline mock scan.');const c=document.createElement('canvas');c.width=Math.min(1024,v.videoWidth);c.height=Math.round(v.videoHeight*c.width/v.videoWidth);c.getContext('2d')!.drawImage(v,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.8);setAspect(c.width/c.height);setFrame(data);return data;},clear(){setFrame('');},fixture(){setFrame('mock');}}),[ready]);
 return <section className="panel camera-panel"><div className="panel-heading"><span><i className="live-dot"/> KITCHEN VISION</span><small>{scan ? scan.mock?'FIXTURE SCAN':'LIVE ESTIMATE':ready?'CAMERA READY':'CAMERA OFF'}</small></div><div ref={host} className={`camera-view ${busy?'scanning':''}`}>
 <video ref={video} muted playsInline className={frame?'hidden-video':''}/>
 {frame&&frame!=='mock'&&<img className="captured" src={frame} alt="Captured kitchen camera frame"/>}
 {(!ready||frame==='mock')&&<div className="camera-placeholder"><div className="produce">🍌 <span>🥑</span></div><span className="viewfinder"/><h3>{frame==='mock'?'The demo kitchen':'A little ripe. A lot of potential.'}</h3><p>{frame==='mock'?'Fixture observations · no photo analyzed':'Point your camera at a kitchen batch.'}</p>{!ready&&<button className="camera-enable" onClick={start} disabled={starting||busy}>{starting?'Connecting…':'Enable camera'}</button>}</div>}
 {frame&&frame!=='mock'&&scan&&!scan.mock&&scan.items.map((item,i)=>item.box&&<div key={i} className={`detection ${item.freshness===1?'danger':''}`} style={{left:(size.w-contentW)/2+item.box.x*contentW,top:(size.h-contentH)/2+item.box.y*contentH,width:item.box.w*contentW,height:item.box.h*contentH}}><span>{item.label} · {item.freshness}/5</span></div>)}
 {busy&&<><div className="scan-line"/><div className="scan-badge">Analyzing visual quality…</div></>}
 <div className="camera-corner tl"/><div className="camera-corner br"/></div>
 {error&&<p role="alert" className="camera-error">{error}</p>}
 <div className="vision-footer"><span>01 <b>See what’s on the counter</b></span>{ready&&frame&&<button onClick={()=>setFrame('')} disabled={busy}>Resume camera ↗</button>}</div>
 <p className="batch-note">Demo camera batches: banana, avocado & bread. Scans update only the bound batch. Visual quality estimates do not certify food safety.</p></section>;
});

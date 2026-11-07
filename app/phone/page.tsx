"use client";
import { useEffect, useState } from 'react';
import type { WorldState } from '@/shared/contracts';
import { api } from '@/components/api';
import { PhoneMockup } from '@/components/PhoneMockup';
export default function Phone(){const [world,setWorld]=useState<WorldState|null>(null),[error,setError]=useState('');useEffect(()=>{let active=true,loading=false;const load=async()=>{if(loading)return;loading=true;try{const w=await api.state();if(active){setWorld(w);setError('');}}catch{if(active)setError('Unable to refresh the café. Retrying…');}finally{loading=false;}};void load();const id=setInterval(load,2000);return()=>{active=false;clearInterval(id);};},[]);return <main className="phone-page">{error&&<p role="alert" className="phone-error">{error}</p>}<PhoneMockup world={world} standalone/></main>;}

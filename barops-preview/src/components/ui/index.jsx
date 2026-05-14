import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { C, F } from '../../constants/theme';

export function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'6px 12px',
      borderRadius:'2px', fontSize:'13px', fontFamily:F,
      letterSpacing:'1.5px', fontWeight:700,
      color, background:bg, border:`1px solid ${color}44`, whiteSpace:'nowrap',
    }}>
      {label}
    </span>
  );
}
export function RiskBadge({ risk }) {
  const M = { critical:{label:'CRÍTICO',color:'#EF4444',bg:'#EF444415'}, medium:{label:'MEDIO',color:C.amber,bg:C.amberBg}, stable:{label:'ESTABLE',color:C.teal,bg:C.tealBg} };
  const m = M[risk]||M.stable;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
export function ShiftBadge({ status }) {
  const M = { covered:{label:'CUBIERTO',color:C.teal,bg:C.tealBg}, searching:{label:'BUSCANDO',color:C.amber,bg:C.amberBg}, urgent:{label:'URGENTE',color:'#EF4444',bg:'#EF444415'} };
  const m = M[status]||M.searching;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
export function AvailBadge({ avail }) {
  const M = { today:{label:'DISPONIBLE HOY',color:C.teal,bg:C.tealBg}, weekend:{label:'ESTE FINDE',color:C.amber,bg:C.amberBg}, unavailable:{label:'NO DISPONIBLE',color:C.textSec,bg:'#88888815'} };
  const m = M[avail]||M.unavailable;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
export function StockBar({ pct }) {
  const color = pct<20?'#EF4444':pct<45?C.amber:C.teal;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <div style={{ width:72, height:5, background:'#2a2a2a', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3 }}/>
      </div>
      <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec, minWidth:28 }}>{pct}%</span>
    </div>
  );
}
export function Stars({ rating }) {
  return (
    <span style={{ fontFamily:F, fontSize:'14px' }}>
      <span style={{ color:C.amber }}>{'★'.repeat(Math.floor(rating))}</span>
      <span style={{ color:'#2a2a2a' }}>{'★'.repeat(5-Math.floor(rating))}</span>
      <span style={{ color:C.textSec, marginLeft:5, fontSize:'14px' }}>{rating}</span>
    </span>
  );
}
export function Avatar({ ini, size=44 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:4, flexShrink:0,
      background:`linear-gradient(135deg,${C.orange}22,${C.purple}22)`,
      border:`1px solid ${C.orange}44`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:F, fontSize:size>36?'13px':'11px', fontWeight:700, color:C.orange, letterSpacing:'1px',
    }}>
      {ini}
    </div>
  );
}
export function Toast({ msg, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3200); return ()=>clearTimeout(t); },[onClose]);
  return (
    <div style={{
      position:'fixed', bottom:28, right:28, zIndex:9999,
      background:C.teal, color:'#000', padding:'12px 20px',
      borderRadius:4, fontFamily:F, fontSize:'14px', letterSpacing:'1.5px', fontWeight:700,
      boxShadow:`0 4px 28px ${C.teal}55`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <CheckCircle size={15}/>{msg}
      <X size={13} style={{ cursor:'pointer', opacity:.7 }} onClick={onClose}/>
    </div>
  );
}
export function Btn({ children, onClick, variant='primary', disabled=false, sx={} }) {
  const V = {
    primary: { background:C.orange,   color:'#000',       border:'none'                        },
    outline: { background:'transparent',color:C.orange,   border:`1px solid ${C.orange}66`     },
    ghost:   { background:'transparent',color:C.textSec,  border:`1px solid ${C.border2}`      },
    teal:    { background:C.teal,      color:'#000',       border:'none'                        },
    danger:  { background:'transparent',color:'#EF4444',  border:`1px solid #EF444444`         },
    purple:  { background:C.purpleBg,  color:C.purple,     border:`1px solid ${C.purple}44`    },
  };
  return (
    <button onClick={disabled?undefined:onClick} style={{
      fontFamily:F, fontWeight:700, letterSpacing:'1.5px', borderRadius:2,
      cursor:disabled?'default':'pointer', fontSize:'13px', padding:'12px 20px',
      display:'inline-flex', alignItems:'center', gap:6,
      opacity:disabled?.4:1, transition:'filter 0.15s',
      ...V[variant], ...sx,
    }}>
      {children}
    </button>
  );
}
export function Card({ children, accent, sx={}, ...props }) {
  return (
    <div style={{
      background:C.card, border:`1px solid ${accent?accent+'33':C.border2}`,
      borderRadius:4, fontFamily:F, ...sx,
    }} {...props}>
      {children}
    </div>
  );
}
export function SLabel({ label, color=C.orange, icon:Icon }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      {Icon&&<Icon size={13} color={color}/>}
      <span style={{ fontFamily:F, fontSize:'14px', color, letterSpacing:'3px', fontWeight:700 }}>{label}</span>
    </div>
  );
}
export function TypingDots() {
  const [d,setD] = useState(0);
  useEffect(()=>{ const t=setInterval(()=>setD(p=>(p+1)%4),380); return ()=>clearInterval(t); },[]);
  return <span style={{ fontFamily:F, fontSize:'20px', color:C.teal, letterSpacing:6 }}>{'●'.repeat(d+1)}{'○'.repeat(3-d)}</span>;
}

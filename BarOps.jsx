import React, { useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  LayoutDashboard, Package, Users, Bot, BarChart2,
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Send, HelpCircle, Plus, Search, Bell, X, ChevronRight,
  Zap, ShoppingCart, Coffee,
} from 'lucide-react';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0A0A0A',
  card:      '#111111',
  cardAlt:   '#0D0D0D',
  border:    '#1A1A1A',
  border2:   '#222222',
  orange:    '#FF6B35',
  teal:      '#00D4AA',
  purple:    '#7C3AED',
  amber:     '#F59E0B',
  red:       '#EF4444',
  text:      '#E8E8E8',
  textSec:   '#888888',
  orangeBg:  '#FF6B3515',
  tealBg:    '#00D4AA15',
  purpleBg:  '#7C3AED15',
  amberBg:   '#F59E0B15',
  redBg:     '#EF444415',
};
const FONT = "'Courier New', Courier, monospace";

const card = (extra = {}) => ({
  background: C.card,
  border: `1px solid ${C.border2}`,
  borderRadius: '4px',
  fontFamily: FONT,
  ...extra,
});

// ─── DATA ─────────────────────────────────────────────────────────────────────
const INVENTORY = [
  { id:1,  name:"Aperol",               cat:"Aperitivo",    stock:"0.8 L",   pct:8,   weekly:"3.4 L", days:1,  cost:"€0.54", risk:"critical" },
  { id:2,  name:"Campari",              cat:"Amaro",        stock:"1.1 L",   pct:11,  weekly:"2.8 L", days:2,  cost:"€0.62", risk:"critical" },
  { id:3,  name:"Gin Hendrick's",       cat:"Ginebra",      stock:"2.3 L",   pct:23,  weekly:"4.2 L", days:3,  cost:"€0.87", risk:"critical" },
  { id:4,  name:"Limones frescos",      cat:"Fruta fresca", stock:"28 ud",   pct:31,  weekly:"45 ud", days:4,  cost:"€0.12", risk:"medium"   },
  { id:5,  name:"Vermut Martini Rosso", cat:"Vermut",       stock:"3.2 L",   pct:43,  weekly:"1.8 L", days:12, cost:"€0.45", risk:"medium"   },
  { id:6,  name:"Tequila Patrón Silver",cat:"Tequila",      stock:"2.9 L",   pct:48,  weekly:"1.4 L", days:14, cost:"€1.45", risk:"medium"   },
  { id:7,  name:"Cointreau",            cat:"Triple Seco",  stock:"1.5 L",   pct:50,  weekly:"0.8 L", days:13, cost:"€0.78", risk:"medium"   },
  { id:8,  name:"Ron Diplomatico Rsva", cat:"Ron",          stock:"4.8 L",   pct:68,  weekly:"2.1 L", days:16, cost:"€1.23", risk:"stable"   },
  { id:9,  name:"Whisky Jameson",       cat:"Whisky",       stock:"5.6 L",   pct:75,  weekly:"1.9 L", days:20, cost:"€0.98", risk:"stable"   },
  { id:10, name:"Champagne Moët",       cat:"Espumoso",     stock:"18 bot",  pct:90,  weekly:"8 bot", days:15, cost:"€8.50", risk:"stable"   },
];

const SHIFTS = [
  { id:1,  date:"Hoy, 28 Abr",    time:"18:00 – 02:00", profile:"Bartender Coctelería",  status:"covered",   pro:"Carlos M.",  cost:"€128", rating:4.9 },
  { id:2,  date:"Hoy, 28 Abr",    time:"20:00 – 04:00", profile:"Camarero Sala",          status:"covered",   pro:"Ana R.",     cost:"€96",  rating:4.7 },
  { id:3,  date:"Mañana, 29 Abr", time:"18:00 – 02:00", profile:"Bartender Senior",       status:"searching", pro:null,         cost:"€145", rating:null },
  { id:4,  date:"Mañana, 29 Abr", time:"21:00 – 03:00", profile:"Coctelero Clásico",      status:"urgent",    pro:null,         cost:"€136", rating:null },
  { id:5,  date:"Jue 30 Abr",     time:"19:00 – 01:00", profile:"Camarero Barras",        status:"covered",   pro:"Miguel F.",  cost:"€88",  rating:4.8 },
  { id:6,  date:"Vie 1 May",      time:"18:00 – 04:00", profile:"Bartender Coctelería",  status:"covered",   pro:"Laura S.",   cost:"€152", rating:5.0 },
  { id:7,  date:"Vie 1 May",      time:"20:00 – 04:00", profile:"Barback / Ayudante",     status:"searching", pro:null,         cost:"€72",  rating:null },
  { id:8,  date:"Sáb 2 May",      time:"18:00 – 05:00", profile:"Bartender Senior",       status:"covered",   pro:"David K.",   cost:"€168", rating:4.9 },
  { id:9,  date:"Sáb 2 May",      time:"20:00 – 05:00", profile:"Coctelero Clásico",      status:"urgent",    pro:null,         cost:"€152", rating:null },
  { id:10, date:"Dom 3 May",      time:"17:00 – 00:00", profile:"Camarero Sala",          status:"covered",   pro:"Carmen B.",  cost:"€84",  rating:4.6 },
];

const TALENT = [
  { id:1, name:"Carlos Mendoza",  ini:"CM", spec:"Coctelería Clásica",   rating:4.9, rate:"€16/h", avail:"today",       tags:["Negroni","Old Fashioned","Martinis"]         },
  { id:2, name:"Ana Ruiz",        ini:"AR", spec:"Mixología Creativa",    rating:4.7, rate:"€14/h", avail:"today",       tags:["Mocktails","Bar Show","Premium"]             },
  { id:3, name:"Miguel Fernández",ini:"MF", spec:"Camarero de Sala",      rating:4.8, rate:"€11/h", avail:"weekend",     tags:["Vinos","Servicio mesa","TPV"]                },
  { id:4, name:"Laura Sánchez",   ini:"LS", spec:"Head Bartender",        rating:5.0, rate:"€19/h", avail:"weekend",     tags:["Cartas cócteles","Formación","Cost control"] },
  { id:5, name:"David Kovacs",    ini:"DK", spec:"Bartender Flair",       rating:4.9, rate:"€18/h", avail:"today",       tags:["Flair","Tropical","Espectáculo"]             },
  { id:6, name:"Carmen Blanco",   ini:"CB", spec:"Camarera de Sala",      rating:4.6, rate:"€10/h", avail:"unavailable", tags:["Idiomas","Eventos","Protocolo"]              },
  { id:7, name:"Rafa Moreno",     ini:"RM", spec:"Barback Senior",        rating:4.5, rate:"€9/h",  avail:"today",       tags:["Mise en place","Soporte","Limpieza"]         },
  { id:8, name:"Nora Iglesias",   ini:"NI", spec:"Sumiller",              rating:4.8, rate:"€17/h", avail:"weekend",     tags:["Vinos","Champagne","Maridaje"]               },
];

const MERMA_DATA = [
  { m:"Nov", antes:1850, despues:1850 },
  { m:"Dic", antes:2100, despues:1620 },
  { m:"Ene", antes:1950, despues:1380 },
  { m:"Feb", antes:2050, despues:1120 },
  { m:"Mar", antes:1900, despues:890  },
  { m:"Abr", antes:2150, despues:710  },
];

const CAT_DATA = [
  { n:"Ginebras",   v:4850 },
  { n:"Espumosos",  v:3400 },
  { n:"Rones",      v:3200 },
  { n:"Whisky",     v:2800 },
  { n:"Tequila",    v:2100 },
  { n:"Vermuts",    v:1900 },
  { n:"Aperitivos", v:1650 },
  { n:"Miscelánea", v:1200 },
];

const TOP_PRODUCTS = [
  { name:"Gin Tonic Hendrick's",  cat:"Combinado",  cost:"€1.12", price:"€11.00", margin:"89.8%", units:521 },
  { name:"Dry Martini",           cat:"Cóctel",     cost:"€1.55", price:"€13.00", margin:"88.1%", units:198 },
  { name:"Whisky Jameson Solo",   cat:"Destilado",  cost:"€0.98", price:"€8.00",  margin:"87.8%", units:267 },
  { name:"Clover Club",           cat:"Cóctel",     cost:"€1.67", price:"€13.50", margin:"87.6%", units:143 },
  { name:"Old Fashioned",         cat:"Cóctel",     cost:"€1.89", price:"€14.00", margin:"86.5%", units:156 },
  { name:"Mojito",                cat:"Cóctel",     cost:"€1.34", price:"€9.50",  margin:"85.9%", units:384 },
  { name:"Aperol Spritz",         cat:"Aperitivo",  cost:"€1.42", price:"€10.00", margin:"85.8%", units:428 },
  { name:"Spritz Campari",        cat:"Aperitivo",  cost:"€1.28", price:"€9.00",  margin:"85.8%", units:298 },
  { name:"Negroni",               cat:"Cóctel",     cost:"€1.78", price:"€12.00", margin:"85.2%", units:312 },
  { name:"Champagne Moët Copa",   cat:"Espumoso",   cost:"€8.50", price:"€18.00", margin:"52.8%", units:89  },
];

const INITIAL_CHAT = [
  {
    id:1, role:"user", time:"14:23",
    text:"¿Qué me va a faltar este fin de semana?",
    bullets: null,
  },
  {
    id:2, role:"agent", time:"14:23",
    text:"Analizado tu histórico de las últimas 8 semanas + reservas confirmadas. Hay 3 alertas críticas y 2 preventivas:",
    bullets:[
      "🔴 CRÍTICO — Aperol (0.8 L): consumo estimado finde 6.2 L. Sin stock el viernes a las 22h",
      "🔴 CRÍTICO — Campari (1.1 L): estimado 4.8 L. Sin stock el sábado al mediodía",
      "🔴 CRÍTICO — Gin Hendrick's (2.3 L): tres grupos con cumpleaños el sábado. Estimado 7.4 L",
      "🟡 PREVENTIVO — Limones frescos (28 ud): necesitas mínimo 85 ud viernes + sábado",
      "🟡 PREVENTIVO — Vermut Martini Rosso: ajustado si el Negroni sale como el sábado pasado",
      "",
      "→ Pedido recomendado antes del jueves — proveedor Eurocash Madrid (Vallecas). ¿Genero la lista?",
    ],
  },
  {
    id:3, role:"user", time:"14:25",
    text:"¿Cuánto me cuesta de verdad un Negroni?",
    bullets: null,
  },
  {
    id:4, role:"agent", time:"14:25",
    text:"Calculado con tus precios de proveedor actuales y el consumo real registrado esta semana:",
    bullets:[
      "NEGRONI — Desglose coste real:",
      "  • Gin Hendrick's 4 cl  →  €0.87   (bot. 70 cl · €15.20)",
      "  • Campari 3 cl         →  €0.45   (bot. 1 L · €14.90)",
      "  • Martini Rosso 3 cl   →  €0.34   (bot. 1 L · €11.30)",
      "  • Naranja / twist      →  €0.08",
      "  • Hielo rotatorio      →  €0.04",
      "",
      "COSTE TOTAL   →  €1.78",
      "PRECIO CARTA  →  €12.00",
      "MARGEN REAL   →  €10.22  —  85.2%",
      "",
      "⚡ Tu coste teórico era €1.61. La diferencia (+€0.17) es merma en cítricos y derrame en Campari. Supone ~€53/mes de pérdida silenciosa solo en Negronis.",
    ],
  },
  {
    id:5, role:"user", time:"14:28",
    text:"Necesito un bartender para mañana martes por la noche",
    bullets: null,
  },
  {
    id:6, role:"agent", time:"14:28",
    text:"Revisada disponibilidad en la red de talento para mañana martes 29 Abr, turno noche (18:00–02:00):",
    bullets:[
      "✅ DISPONIBLE — Carlos Mendoza · Bartender Coctelería · ⭐ 4.9 · €16/h · 3 servicios contigo",
      "✅ DISPONIBLE — David Kovacs · Bartender Flair · ⭐ 4.9 · €18/h · Nuevo en Paradiso",
      "⏳ PENDIENTE RESPUESTA — Rafa Moreno · Barback Senior · ⭐ 4.5 · €9/h",
      "",
      "Recomiendo Carlos Mendoza: conoce tu carta y sus Negronis tienen 0% de merma registrada.",
      "",
      "¿Confirmo el turno con Carlos? Coste estimado 8h: €128",
    ],
  },
];

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'2px 8px',
      borderRadius:'2px', fontSize:'9px', fontFamily:FONT,
      letterSpacing:'1.5px', fontWeight:700, color,
      background: bg, border:`1px solid ${color}44`,
      whiteSpace:'nowrap',
    }}>
      {label}
    </span>
  );
}

function RiskBadge({ risk }) {
  const MAP = {
    critical: { label:'CRÍTICO',  color:'#EF4444', bg:'#EF444415' },
    medium:   { label:'MEDIO',    color:C.amber,   bg:C.amberBg  },
    stable:   { label:'ESTABLE',  color:C.teal,    bg:C.tealBg   },
  };
  const m = MAP[risk] || MAP.stable;
  return <Badge label={m.label} color={m.color} bg={m.bg} />;
}

function ShiftStatusBadge({ status }) {
  const MAP = {
    covered:   { label:'CUBIERTO',  color:C.teal,    bg:C.tealBg           },
    searching: { label:'BUSCANDO',  color:C.amber,   bg:C.amberBg          },
    urgent:    { label:'URGENTE',   color:'#EF4444', bg:'#EF444415'        },
  };
  const m = MAP[status] || MAP.searching;
  return <Badge label={m.label} color={m.color} bg={m.bg} />;
}

function AvailBadge({ avail }) {
  const MAP = {
    today:       { label:'DISPONIBLE HOY',           color:C.teal,    bg:C.tealBg        },
    weekend:     { label:'DISPONIBLE FIN DE SEMANA', color:C.amber,   bg:C.amberBg       },
    unavailable: { label:'NO DISPONIBLE',            color:C.textSec, bg:'#88888815'     },
  };
  const m = MAP[avail] || MAP.unavailable;
  return <Badge label={m.label} color={m.color} bg={m.bg} />;
}

function StockBar({ pct }) {
  const color = pct < 20 ? '#EF4444' : pct < 45 ? C.amber : C.teal;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <div style={{ width:'72px', height:'5px', background:'#2a2a2a', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'3px' }} />
      </div>
      <span style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, minWidth:'28px' }}>{pct}%</span>
    </div>
  );
}

function Stars({ rating }) {
  return (
    <span style={{ fontFamily:FONT, fontSize:'11px' }}>
      <span style={{ color:C.amber }}>{'★'.repeat(Math.floor(rating))}</span>
      <span style={{ color:'#333' }}>{'★'.repeat(5-Math.floor(rating))}</span>
      <span style={{ color:C.textSec, marginLeft:'5px' }}>{rating}</span>
    </span>
  );
}

function Avatar({ ini }) {
  return (
    <div style={{
      width:'44px', height:'44px', borderRadius:'4px', flexShrink:0,
      background:`linear-gradient(135deg, ${C.orange}22, ${C.purple}22)`,
      border:`1px solid ${C.orange}44`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:FONT, fontSize:'13px', fontWeight:700,
      color:C.orange, letterSpacing:'1px',
    }}>
      {ini}
    </div>
  );
}

function Divider() {
  return <div style={{ height:'1px', background:C.border, margin:'0' }} />;
}

function SectionLabel({ label, color = C.orange, icon: Icon }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
      {Icon && <Icon size={13} color={color} />}
      <span style={{ fontFamily:FONT, fontSize:'10px', color, letterSpacing:'3px', fontWeight:700 }}>{label}</span>
    </div>
  );
}

function Toast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position:'fixed', bottom:'28px', right:'28px', zIndex:9999,
      background:C.teal, color:'#000', padding:'12px 20px',
      borderRadius:'4px', fontFamily:FONT, fontSize:'11px',
      letterSpacing:'1.5px', fontWeight:700,
      boxShadow:`0 4px 28px ${C.teal}55`,
      display:'flex', alignItems:'center', gap:'12px',
    }}>
      <CheckCircle size={15} />
      {msg}
      <X size={13} style={{ cursor:'pointer', opacity:0.7, marginLeft:'4px' }} onClick={onClose} />
    </div>
  );
}

function Btn({ children, onClick, variant='primary', size='md', disabled=false, style:extra={} }) {
  const base = {
    fontFamily:FONT, fontWeight:700, letterSpacing:'1.5px', border:'none',
    borderRadius:'2px', cursor: disabled ? 'default' : 'pointer',
    display:'inline-flex', alignItems:'center', gap:'6px',
    opacity: disabled ? 0.45 : 1, transition:'opacity 0.15s',
  };
  const sizes = { sm:'5px 10px', md:'9px 18px', lg:'11px 24px' };
  const fontSizes = { sm:'9px', md:'10px', lg:'11px' };
  const variants = {
    primary:  { background:C.orange, color:'#000' },
    outline:  { background:'transparent', color:C.orange, border:`1px solid ${C.orange}` },
    ghost:    { background:'transparent', color:C.textSec, border:`1px solid ${C.border2}` },
    teal:     { background:C.teal, color:'#000' },
    danger:   { background:'transparent', color:'#EF4444', border:`1px solid #EF444444` },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, padding:sizes[size], fontSize:fontSizes[size], ...variants[variant], ...extra }}
    >
      {children}
    </button>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive }) {
  const NAV = [
    { id:'dashboard',  Icon:LayoutDashboard, label:'DASHBOARD'  },
    { id:'inventario', Icon:Package,         label:'INVENTARIO' },
    { id:'staffing',   Icon:Users,           label:'STAFFING'   },
    { id:'agente',     Icon:Bot,             label:'AGENTE IA'  },
    { id:'analytics',  Icon:BarChart2,       label:'ANALYTICS'  },
  ];
  return (
    <div style={{
      width:'224px', minHeight:'100vh', background:C.cardAlt,
      borderRight:`1px solid ${C.border2}`,
      display:'flex', flexDirection:'column', flexShrink:0,
    }}>
      {/* Logotype */}
      <div style={{ padding:'24px 22px 20px', borderBottom:`1px solid ${C.border2}` }}>
        <div style={{ fontFamily:FONT, fontSize:'24px', fontWeight:700, color:C.orange, letterSpacing:'7px', lineHeight:1 }}>
          BAROPS
        </div>
        <div style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'3px', marginTop:'5px' }}>
          SISTEMA OPERATIVO
        </div>
      </div>

      {/* Local info */}
      <div style={{ padding:'14px 22px 16px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:'4px' }}>LOCAL</div>
        <div style={{ fontFamily:FONT, fontSize:'12px', color:C.text, letterSpacing:'0.3px', lineHeight:'1.3' }}>
          Paradiso Cocktail Bar
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'8px' }}>
          <div style={{
            width:'7px', height:'7px', borderRadius:'50%',
            background:C.teal, boxShadow:`0 0 8px ${C.teal}`,
          }} />
          <span style={{ fontFamily:FONT, fontSize:'9px', color:C.teal, letterSpacing:'1.5px' }}>
            SISTEMA ACTIVO
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex:1, padding:'10px 0' }}>
        {NAV.map(({ id, Icon, label }) => {
          const isActive = active === id;
          return (
            <div
              key={id}
              onClick={() => setActive(id)}
              style={{
                display:'flex', alignItems:'center', gap:'12px',
                padding:'11px 22px', cursor:'pointer',
                background: isActive ? `${C.orange}12` : 'transparent',
                borderLeft: isActive ? `2px solid ${C.orange}` : '2px solid transparent',
                transition:'all 0.12s',
              }}
            >
              <Icon size={14} color={isActive ? C.orange : C.textSec} />
              <span style={{
                fontFamily:FONT, fontSize:'10px', letterSpacing:'2.5px',
                color: isActive ? C.orange : C.textSec,
                fontWeight: isActive ? 700 : 400,
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:'16px 22px', borderTop:`1px solid ${C.border2}` }}>
        <div style={{
          padding:'10px 14px', background:C.purpleBg,
          border:`1px solid ${C.purple}44`, borderRadius:'4px', marginBottom:'12px',
        }}>
          <div style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px' }}>PLAN ACTUAL</div>
          <div style={{ fontFamily:FONT, fontSize:'15px', color:C.purple, letterSpacing:'4px', fontWeight:700, marginTop:'3px' }}>PRO</div>
          <div style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, marginTop:'2px' }}>€199 / mes</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', padding:'4px 0' }}>
          <HelpCircle size={12} color={C.textSec} />
          <span style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px' }}>AYUDA & SOPORTE</span>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 1: DASHBOARD ──────────────────────────────────────────────────────
function Dashboard() {
  const [toast, setToast] = useState(null);
  const [chatInput, setChatInput] = useState('');

  const KPIS = [
    { label:'MERMA ESTIMADA MES', value:'€710',   sub:'−66% vs nov. 2025', color:C.teal,    Icon:TrendingDown, bg:C.tealBg               },
    { label:'STOCK EN RIESGO',    value:'3 REF.', sub:'Nivel: CRÍTICO',     color:'#EF4444', Icon:AlertTriangle, bg:'#EF444415'           },
    { label:'TURNOS CUBIERTOS',   value:'7 / 10', sub:'70% de cobertura',   color:C.orange,  Icon:CheckCircle,  bg:C.orangeBg            },
    { label:'AHORRO GENERADO',    value:'€1.140', sub:'ROI: 5.7× este mes', color:C.amber,   Icon:TrendingUp,   bg:C.amberBg             },
  ];

  const alertItems   = INVENTORY.filter(i => i.risk !== 'stable').slice(0, 5);
  const shiftItems   = SHIFTS.slice(0, 6);
  const CHIPS        = ['¿Qué me va a faltar este finde?', '¿Cuánto me cuesta un Negroni real?', 'Necesito un bartender mañana'];

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setToast('Mensaje enviado al Agente BarOps');
    setChatInput('');
  };

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:FONT }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
        <div>
          <h1 style={{ fontFamily:FONT, fontSize:'18px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>DASHBOARD</h1>
          <p style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            Paradiso Cocktail Bar — Lunes, 28 de Abril de 2026
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Bell size={14} color={C.textSec} style={{ cursor:'pointer' }} />
          <div style={{
            padding:'6px 14px', background:C.tealBg,
            border:`1px solid ${C.teal}44`, borderRadius:'2px',
            fontFamily:FONT, fontSize:'9px', color:C.teal, letterSpacing:'2px', fontWeight:700,
          }}>
            ● SISTEMA ACTIVO
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {KPIS.map(({ label, value, sub, color, Icon, bg }, i) => (
          <div key={i} style={{ ...card({ background:bg, border:`1px solid ${color}33` }), padding:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:'10px' }}>{label}</div>
                <div style={{ fontSize:'28px', color, fontWeight:700, letterSpacing:'1px', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:'10px', color:C.textSec, marginTop:'7px' }}>{sub}</div>
              </div>
              <Icon size={20} color={color} style={{ opacity:0.55 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'16px' }}>

        {/* Inventory Alerts */}
        <div style={{ ...card(), padding:'20px' }}>
          <SectionLabel label="ALERTAS DE INVENTARIO" color={C.orange} icon={AlertTriangle} />
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {alertItems.map(item => (
              <div key={item.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 12px', background:C.cardAlt,
                border:`1px solid ${item.risk==='critical' ? '#EF444433' : C.amberBg.replace('15','33')}`,
                borderRadius:'3px',
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'12px', color:C.text, fontWeight:700, letterSpacing:'0.3px', marginBottom:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ display:'flex', gap:'10px' }}>
                    <span style={{ fontSize:'10px', color:C.textSec }}>Stock: {item.stock}</span>
                    <span style={{ fontSize:'10px', color: item.days <= 3 ? '#EF4444' : C.amber, fontWeight:700 }}>
                      {item.days}d restantes
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'10px' }}>
                  <RiskBadge risk={item.risk} />
                  <Btn size="sm" onClick={() => setToast(`Pedido de ${item.name} enviado al proveedor`)}>
                    PEDIR YA
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Shifts */}
        <div style={{ ...card(), padding:'20px' }}>
          <SectionLabel label="TURNOS ACTIVOS" color={C.teal} icon={Clock} />
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {shiftItems.map(s => (
              <div key={s.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 12px', background:C.cardAlt,
                border:`1px solid ${s.status==='urgent' ? '#EF444433' : s.status==='searching' ? C.amber+'33' : C.border}`,
                borderRadius:'3px',
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'10px', color:C.textSec, marginBottom:'2px' }}>{s.date} · {s.time}</div>
                  <div style={{ fontSize:'12px', color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.profile}</div>
                  {s.pro && <div style={{ fontSize:'10px', color:C.teal, marginTop:'2px' }}>→ {s.pro}</div>}
                </div>
                <ShiftStatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent bar */}
      <div style={{ ...card({ border:`1px solid ${C.orange}33` }), padding:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
          <Bot size={15} color={C.orange} />
          <span style={{ fontFamily:FONT, fontSize:'10px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>AGENTE BAROPS</span>
          <span style={{
            padding:'2px 8px', background:C.tealBg, border:`1px solid ${C.teal}33`,
            borderRadius:'2px', fontFamily:FONT, fontSize:'8px', color:C.teal, letterSpacing:'1.5px',
          }}>
            EN LÍNEA
          </span>
        </div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
          {CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => setChatInput(chip)}
              style={{
                padding:'5px 12px', background:C.cardAlt,
                border:`1px solid ${C.border2}`, borderRadius:'2px',
                fontFamily:FONT, fontSize:'11px', color:C.textSec,
                cursor:'pointer', letterSpacing:'0.3px',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Pregunta lo que necesites sobre tu negocio..."
            style={{
              flex:1, padding:'10px 14px', background:C.cardAlt,
              border:`1px solid ${C.border2}`, borderRadius:'3px',
              fontFamily:FONT, fontSize:'12px', color:C.text, outline:'none',
              letterSpacing:'0.3px',
            }}
          />
          <Btn onClick={handleSend} size="md" style={{ padding:'10px 20px' }}>
            <Send size={13} /> ENVIAR
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 2: INVENTARIO ─────────────────────────────────────────────────────
function Inventario() {
  const [filter, setFilter]   = useState('all');
  const [toast, setToast]     = useState(null);

  const FILTERS = [
    { id:'all',      label:'TODOS'      },
    { id:'critical', label:'EN RIESGO'  },
    { id:'medium',   label:'PREVENTIVO' },
    { id:'stable',   label:'ESTABLE'    },
  ];

  const visible = filter === 'all' ? INVENTORY : INVENTORY.filter(i => i.risk === filter);

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:FONT }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontFamily:FONT, fontSize:'18px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>INVENTARIO INTELIGENTE</h1>
        <p style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
          Predicción de stock con IA — actualizado hace 2 horas · 10 referencias monitorizadas
        </p>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'18px' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding:'6px 16px', borderRadius:'2px', fontFamily:FONT,
              fontSize:'9px', letterSpacing:'2px', fontWeight:700, cursor:'pointer',
              background: filter === f.id ? C.orange : C.cardAlt,
              color: filter === f.id ? '#000' : C.textSec,
              border: filter === f.id ? `1px solid ${C.orange}` : `1px solid ${C.border2}`,
              transition:'all 0.12s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card(), marginBottom:'22px', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border2}`, background:C.cardAlt }}>
              {['PRODUCTO','CATEGORÍA','STOCK ACTUAL','USO SEMANAL','DÍAS RESTANTES','COSTE/USO','ACCIÓN'].map(h => (
                <th key={h} style={{
                  padding:'11px 16px', textAlign:'left',
                  fontSize:'8px', color:C.textSec, letterSpacing:'2px', fontWeight:700,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, i) => (
              <tr
                key={item.id}
                style={{ borderBottom:`1px solid ${C.border}`, background: i%2===0 ? 'transparent' : C.cardAlt }}
              >
                <td style={{ padding:'13px 16px', fontSize:'12px', color:C.text, fontWeight:700 }}>{item.name}</td>
                <td style={{ padding:'13px 16px', fontSize:'10px', color:C.textSec }}>{item.cat}</td>
                <td style={{ padding:'13px 16px', fontSize:'12px', color:C.text }}>{item.stock}</td>
                <td style={{ padding:'13px 16px', fontSize:'11px', color:C.textSec }}>{item.weekly}</td>
                <td style={{ padding:'13px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <StockBar pct={item.pct} />
                    <span style={{
                      fontFamily:FONT, fontSize:'12px', fontWeight:700,
                      color: item.days <= 3 ? '#EF4444' : item.days <= 7 ? C.amber : C.teal,
                    }}>
                      {item.days}d
                    </span>
                  </div>
                </td>
                <td style={{ padding:'13px 16px', fontSize:'12px', color:C.teal }}>{item.cost}</td>
                <td style={{ padding:'13px 16px' }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <RiskBadge risk={item.risk} />
                    {item.risk !== 'stable' && (
                      <Btn size="sm" variant="outline" onClick={() => setToast(`Pedido de ${item.name} añadido a la lista`)}>
                        PEDIR
                      </Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Analysis cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>

        {/* Demand prediction */}
        <div style={{ ...card({ border:`1px solid ${C.purple}33` }), padding:'20px' }}>
          <SectionLabel label="PREDICCIÓN ESTE FIN DE SEMANA" color={C.purple} icon={Zap} />
          {[
            { name:"Gin Tonic Hendrick's", units:"~52 uds" },
            { name:"Aperol Spritz",         units:"~48 uds" },
            { name:"Negroni",               units:"~38 uds" },
            { name:"Mojito",                units:"~35 uds" },
            { name:"Old Fashioned",         units:"~22 uds" },
          ].map((p, i) => (
            <div key={i} style={{
              display:'flex', justifyContent:'space-between',
              padding:'7px 0', borderBottom:`1px solid ${C.border}`,
              fontSize:'11px',
            }}>
              <span style={{ color:C.textSec }}>#{i+1} {p.name}</span>
              <span style={{ color:C.purple, fontWeight:700 }}>{p.units}</span>
            </div>
          ))}
        </div>

        {/* Cost comparison */}
        <div style={{ ...card({ border:`1px solid ${C.amber}33` }), padding:'20px' }}>
          <SectionLabel label="COSTE TEÓRICO VS REAL" color={C.amber} icon={TrendingUp} />
          {[
            { label:'Coste teórico ventas',  val:'€4.280', color:C.textSec  },
            { label:'Coste real registrado', val:'€4.990', color:C.amber    },
            { label:'Diferencia (merma)',     val:'+€710',  color:'#EF4444'  },
            { label:'Porcentaje de merma',    val:'14.2%',  color:'#EF4444'  },
            { label:'Objetivo BarOps',        val:'< 8%',   color:C.teal     },
          ].map((r, i) => (
            <div key={i} style={{
              display:'flex', justifyContent:'space-between',
              padding:'7px 0', borderBottom:`1px solid ${C.border}`,
              fontSize:'11px',
            }}>
              <span style={{ color:C.textSec }}>{r.label}</span>
              <span style={{ color:r.color, fontWeight:700 }}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* AI order recommendation */}
        <div style={{ ...card({ border:`1px solid ${C.teal}33` }), padding:'20px' }}>
          <SectionLabel label="PEDIDO RECOMENDADO IA" color={C.teal} icon={ShoppingCart} />
          {[
            { name:"Aperol",           qty:"6 botellas", urg:"HOY",       c:'#EF4444' },
            { name:"Campari",          qty:"4 botellas", urg:"HOY",       c:'#EF4444' },
            { name:"Gin Hendrick's",   qty:"3 botellas", urg:"MAÑANA",    c:C.amber   },
            { name:"Limones frescos",  qty:"3 kg",        urg:"MAÑANA",    c:C.amber   },
            { name:"Vermut Martini",   qty:"2 botellas", urg:"ESTA SEM.", c:C.teal    },
          ].map((o, i) => (
            <div key={i} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 0', borderBottom:`1px solid ${C.border}`, fontSize:'11px',
            }}>
              <span style={{ color:C.text }}>{o.name}</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <span style={{ color:C.textSec, fontSize:'10px' }}>{o.qty}</span>
                <span style={{ color:o.c, fontWeight:700, fontSize:'8px', letterSpacing:'1px' }}>{o.urg}</span>
              </div>
            </div>
          ))}
          <Btn variant="teal" style={{ width:'100%', marginTop:'14px', justifyContent:'center', padding:'8px', letterSpacing:'2px', fontSize:'9px' }}>
            GENERAR PEDIDO COMPLETO
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 3: STAFFING ───────────────────────────────────────────────────────
function Staffing() {
  const [tab, setTab]     = useState('turnos');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const WEEK_DAYS = [
    { d:'LUN 28', c:2, p:0 },
    { d:'MAR 29', c:0, p:2 },
    { d:'MIÉ 30', c:1, p:0 },
    { d:'JUE 1',  c:1, p:1 },
    { d:'VIE 2',  c:1, p:1 },
    { d:'SÁB 3',  c:1, p:1 },
  ];

  const filtered = TALENT.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.spec.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:FONT }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontFamily:FONT, fontSize:'18px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>STAFFING</h1>
          <p style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            Cobertura de personal — 3 turnos pendientes de cubrir esta semana
          </p>
        </div>
        <Btn size="lg" onClick={() => setToast('Formulario de turno urgente abierto')}>
          <Plus size={14} /> PUBLICAR TURNO URGENTE
        </Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border2}`, marginBottom:'22px' }}>
        {['turnos','talento'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding:'10px 26px', background:'transparent', cursor:'pointer',
              fontFamily:FONT, fontSize:'10px', letterSpacing:'3px', fontWeight:700,
              color: tab === t ? C.orange : C.textSec,
              border:'none',
              borderBottom: tab === t ? `2px solid ${C.orange}` : '2px solid transparent',
              marginBottom:'-1px', transition:'color 0.12s',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'turnos' ? (
        <>
          {/* Weekly summary calendar */}
          <div style={{ ...card(), padding:'16px 18px', marginBottom:'18px' }}>
            <div style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:'12px' }}>
              SEMANA 28 ABR — 3 MAY 2026
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px' }}>
              {WEEK_DAYS.map(({ d, c, p }) => (
                <div key={d} style={{
                  padding:'12px 8px', background:C.cardAlt,
                  border:`1px solid ${p > 0 ? C.amber+'44' : C.border}`,
                  borderRadius:'3px', textAlign:'center',
                }}>
                  <div style={{ fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'1px', marginBottom:'7px' }}>{d}</div>
                  {c > 0 && <div style={{ fontFamily:FONT, fontSize:'9px', color:C.teal }}>✓ {c} cubierto{c>1?'s':''}</div>}
                  {p > 0 && <div style={{ fontFamily:FONT, fontSize:'9px', color:C.amber }}>⚠ {p} pendiente{p>1?'s':''}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Shifts list */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {SHIFTS.map(s => (
              <div key={s.id} style={{
                ...card({
                  border:`1px solid ${
                    s.status==='urgent' ? '#EF444433'
                    : s.status==='searching' ? C.amber+'33'
                    : C.border2
                  }`,
                }),
                padding:'14px 18px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div style={{ width:'160px', flexShrink:0 }}>
                  <div style={{ fontSize:'10px', color:C.textSec, marginBottom:'2px' }}>{s.date}</div>
                  <div style={{ fontSize:'13px', color:C.text, fontWeight:700 }}>{s.time}</div>
                </div>
                <div style={{ flex:1, paddingLeft:'16px' }}>
                  <div style={{ fontSize:'12px', color:C.text }}>{s.profile}</div>
                  {s.pro && (
                    <div style={{ fontSize:'10px', color:C.teal, marginTop:'3px' }}>
                      → {s.pro}
                      {s.rating && <span style={{ color:C.amber, marginLeft:'8px' }}>⭐ {s.rating}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontFamily:FONT, fontSize:'12px', color:C.textSec }}>{s.cost}</span>
                  <ShiftStatusBadge status={s.status} />
                  {s.status !== 'covered' && (
                    <Btn size="sm" variant="outline" onClick={() => setToast(`Búsqueda activada para ${s.profile}`)}>
                      BUSCAR
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Search + filters */}
          <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:1, minWidth:'220px' }}>
              <Search size={13} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:C.textSec }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o especialidad..."
                style={{
                  width:'100%', padding:'9px 12px 9px 34px',
                  background:C.card, border:`1px solid ${C.border2}`,
                  borderRadius:'3px', fontFamily:FONT, fontSize:'12px',
                  color:C.text, outline:'none', boxSizing:'border-box',
                }}
              />
            </div>
            {['Coctelería','Sala','Barback','Disponible hoy'].map(f => (
              <Btn key={f} variant="ghost" size="sm" style={{ letterSpacing:'0.5px', fontSize:'10px' }}>
                {f}
              </Btn>
            ))}
          </div>

          {/* Talent grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
            {filtered.map(p => (
              <div key={p.id} style={{
                ...card({
                  border:`1px solid ${p.avail==='today' ? C.teal+'33' : C.border2}`,
                }),
                padding:'18px',
              }}>
                <div style={{ display:'flex', gap:'12px', marginBottom:'12px' }}>
                  <Avatar ini={p.ini} />
                  <div>
                    <div style={{ fontSize:'13px', color:C.text, fontWeight:700, letterSpacing:'0.3px' }}>{p.name}</div>
                    <div style={{ fontSize:'10px', color:C.textSec, margin:'3px 0 4px' }}>{p.spec}</div>
                    <Stars rating={p.rating} />
                  </div>
                </div>
                <div style={{ marginBottom:'10px' }}>
                  <AvailBadge avail={p.avail} />
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'14px' }}>
                  {p.tags.map(tag => (
                    <span key={tag} style={{
                      padding:'2px 7px', background:C.cardAlt,
                      border:`1px solid ${C.border2}`, borderRadius:'2px',
                      fontFamily:FONT, fontSize:'9px', color:C.textSec,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:FONT, fontSize:'15px', color:C.orange, fontWeight:700 }}>{p.rate}</span>
                  <Btn
                    size="sm"
                    disabled={p.avail === 'unavailable'}
                    onClick={() => setToast(`Solicitud enviada a ${p.name}`)}
                  >
                    CONTRATAR
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SCREEN 4: AGENTE IA ──────────────────────────────────────────────────────
function AgenteIA() {
  const [messages, setMessages] = useState(INITIAL_CHAT);
  const [input, setInput]       = useState('');
  const bottomRef               = useRef(null);

  const CHIPS = [
    '¿Cómo mejorar mi margen en Gin Tonics?',
    'Genera la lista de pedido para este finde',
    '¿Cuál es mi cóctel más rentable?',
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    setMessages(prev => [
      ...prev,
      { id:Date.now(),   role:'user',  time:now, text:input, bullets:null },
      {
        id:Date.now()+1, role:'agent', time:now,
        text:'Analizando tu consulta con los datos en tiempo real de Paradiso Cocktail Bar...',
        bullets:[
          '→ Accediendo a historial de inventario y consumo...',
          '→ Cruzando con datos de merma y costes de proveedor...',
          '✓ Análisis listo. Procesando respuesta...',
        ],
      },
    ]);
    setInput('');
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', fontFamily:FONT, overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'20px 28px', borderBottom:`1px solid ${C.border2}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{
            width:'36px', height:'36px', borderRadius:'4px',
            background:`${C.orange}18`, border:`1px solid ${C.orange}44`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Bot size={17} color={C.orange} />
          </div>
          <div>
            <div style={{ fontFamily:FONT, fontSize:'14px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>AGENTE BAROPS</div>
            <div style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, letterSpacing:'1px', marginTop:'2px' }}>
              Tu analista de negocio personal — activo 24/7
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{
            padding:'5px 12px', background:C.purpleBg, border:`1px solid ${C.purple}44`,
            borderRadius:'2px', fontFamily:FONT, fontSize:'9px', color:C.purple, letterSpacing:'1.5px', fontWeight:700,
          }}>
            CLAUDE AI POWERED
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:C.teal, boxShadow:`0 0 8px ${C.teal}` }} />
            <span style={{ fontFamily:FONT, fontSize:'10px', color:C.teal, letterSpacing:'1.5px' }}>EN LÍNEA</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px', display:'flex', flexDirection:'column', gap:'18px' }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display:'flex', flexDirection:'column',
              alignSelf: msg.role==='user' ? 'flex-end' : 'flex-start',
              maxWidth:'72%',
            }}
          >
            <div style={{
              fontFamily:FONT, fontSize:'9px', color:C.textSec, letterSpacing:'1px',
              marginBottom:'5px', padding:'0 4px',
              textAlign: msg.role==='user' ? 'right' : 'left',
            }}>
              {msg.role==='user' ? 'TÚ' : '⚡ AGENTE BAROPS'} · {msg.time}
            </div>
            <div style={{
              padding:'14px 18px',
              background: msg.role==='user' ? C.orangeBg : C.card,
              border: `1px solid ${msg.role==='user' ? C.orange+'44' : C.border2}`,
              borderRadius: msg.role==='user' ? '8px 2px 8px 8px' : '2px 8px 8px 8px',
            }}>
              <p style={{ margin:0, fontFamily:FONT, fontSize:'13px', color:C.text, lineHeight:'1.65', letterSpacing:'0.2px' }}>
                {msg.text}
              </p>
              {msg.bullets && (
                <div style={{ marginTop:'10px', display:'flex', flexDirection:'column', gap:'3px' }}>
                  {msg.bullets.map((b, i) => (
                    b === '' ? <div key={i} style={{ height:'5px' }} /> : (
                      <div
                        key={i}
                        style={{
                          fontFamily:'monospace', fontSize:'12px', lineHeight:'1.55',
                          letterSpacing:'0.2px',
                          color:
                            b.startsWith('🔴') ? '#EF4444'
                            : b.startsWith('✅') ? C.teal
                            : b.startsWith('🟡') ? C.amber
                            : b.startsWith('NEGRONI') || b.startsWith('COSTE') || b.startsWith('PRECIO') || b.startsWith('MARGEN') ? C.orange
                            : b.startsWith('⚡') ? C.amber
                            : b.startsWith('→') ? C.teal
                            : C.textSec,
                        }}
                      >
                        {b}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding:'16px 32px 24px', borderTop:`1px solid ${C.border2}`, flexShrink:0 }}>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
          {CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => setInput(chip)}
              style={{
                padding:'5px 12px', background:C.cardAlt,
                border:`1px solid ${C.border2}`, borderRadius:'2px',
                fontFamily:FONT, fontSize:'11px', color:C.textSec, cursor:'pointer',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pregunta lo que necesites sobre tu negocio..."
            style={{
              flex:1, padding:'12px 16px', background:C.card,
              border:`1px solid ${C.border2}`, borderRadius:'3px',
              fontFamily:FONT, fontSize:'13px', color:C.text, outline:'none',
            }}
          />
          <Btn onClick={send} style={{ padding:'12px 24px', fontSize:'11px' }}>
            <Send size={14} /> ENVIAR
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
const TT_STYLE = {
  background:C.card, border:`1px solid #333`,
  fontFamily:FONT, fontSize:'11px', borderRadius:'3px', color:C.text,
};

function Analytics() {
  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:FONT }}>
      <div style={{ marginBottom:'28px' }}>
        <h1 style={{ fontFamily:FONT, fontSize:'18px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>
          INTELIGENCIA DE NEGOCIO
        </h1>
        <p style={{ fontFamily:FONT, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
          Análisis de rendimiento — Paradiso Cocktail Bar · Nov 2025 – Abr 2026
        </p>
      </div>

      {/* Big metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'22px' }}>
        <div style={{ ...card({ background:C.tealBg, border:`1px solid ${C.teal}44` }), padding:'26px' }}>
          <div style={{ fontFamily:FONT, fontSize:'9px', color:C.teal, letterSpacing:'2.5px', fontWeight:700, marginBottom:'10px' }}>
            AHORRO ACUMULADO CON BAROPS
          </div>
          <div style={{ fontFamily:FONT, fontSize:'44px', color:C.teal, fontWeight:700, letterSpacing:'2px', lineHeight:1 }}>€7.240</div>
          <div style={{ fontFamily:FONT, fontSize:'11px', color:C.textSec, marginTop:'10px' }}>
            Desde noviembre 2025 · 6 meses de uso
          </div>
          <div style={{ fontFamily:FONT, fontSize:'11px', color:C.teal, marginTop:'5px' }}>
            ↓ Merma reducida: €2.000/mes → €710/mes actual
          </div>
        </div>
        <div style={{ ...card({ background:C.orangeBg, border:`1px solid ${C.orange}44` }), padding:'26px' }}>
          <div style={{ fontFamily:FONT, fontSize:'9px', color:C.orange, letterSpacing:'2.5px', fontWeight:700, marginBottom:'10px' }}>
            ROI DE BAROPS ESTE MES
          </div>
          <div style={{ fontFamily:FONT, fontSize:'44px', color:C.orange, fontWeight:700, letterSpacing:'2px', lineHeight:1 }}>5.7×</div>
          <div style={{ fontFamily:FONT, fontSize:'11px', color:C.textSec, marginTop:'10px' }}>
            Coste BarOps: €199/mes · Ahorro generado: €1.140/mes
          </div>
          <div style={{ fontFamily:FONT, fontSize:'11px', color:C.orange, marginTop:'5px' }}>
            → €941 de beneficio neto mensual vs no tener BarOps
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px', marginBottom:'22px' }}>

        <div style={{ ...card(), padding:'20px' }}>
          <div style={{ fontFamily:FONT, fontSize:'9px', color:C.orange, letterSpacing:'2.5px', fontWeight:700, marginBottom:'18px' }}>
            EVOLUCIÓN MERMA MENSUAL (€)
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={MERMA_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border2} />
              <XAxis dataKey="m" stroke={C.border2} tick={{ fontFamily:FONT, fontSize:10, fill:C.textSec }} />
              <YAxis stroke={C.border2} tick={{ fontFamily:FONT, fontSize:10, fill:C.textSec }} />
              <Tooltip contentStyle={TT_STYLE} labelStyle={{ color:C.text }} />
              <Legend wrapperStyle={{ fontFamily:FONT, fontSize:'10px', paddingTop:'10px' }} />
              <Line type="monotone" dataKey="antes"   stroke="#EF4444" strokeWidth={2} dot={{ fill:'#EF4444', r:4 }} name="Sin BarOps"  />
              <Line type="monotone" dataKey="despues" stroke={C.teal}   strokeWidth={2} dot={{ fill:C.teal,   r:4 }} name="Con BarOps" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...card(), padding:'20px' }}>
          <div style={{ fontFamily:FONT, fontSize:'9px', color:C.purple, letterSpacing:'2.5px', fontWeight:700, marginBottom:'18px' }}>
            CONSUMO POR CATEGORÍA — ABRIL (€)
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={CAT_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border2} />
              <XAxis dataKey="n" stroke={C.border2} tick={{ fontFamily:FONT, fontSize:9, fill:C.textSec }} />
              <YAxis stroke={C.border2} tick={{ fontFamily:FONT, fontSize:10, fill:C.textSec }} />
              <Tooltip contentStyle={TT_STYLE} labelStyle={{ color:C.text }} />
              <Bar dataKey="v" fill={C.purple} radius={[2,2,0,0]} name="Consumo €" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top products table */}
      <div style={{ ...card(), overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', gap:'8px' }}>
          <TrendingUp size={13} color={C.amber} />
          <span style={{ fontFamily:FONT, fontSize:'9px', color:C.amber, letterSpacing:'2.5px', fontWeight:700 }}>
            TOP 10 PRODUCTOS POR RENTABILIDAD — ABRIL 2026
          </span>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.cardAlt, borderBottom:`1px solid ${C.border2}` }}>
              {['#','PRODUCTO','CATEGORÍA','COSTE REAL','PRECIO CARTA','MARGEN REAL','UNIDADES/MES'].map(h => (
                <th key={h} style={{
                  padding:'10px 16px', textAlign:'left',
                  fontFamily:FONT, fontSize:'8px', color:C.textSec, letterSpacing:'2px', fontWeight:700,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOP_PRODUCTS.map((p, i) => {
              const marginNum = parseFloat(p.margin);
              const mColor = marginNum > 87 ? C.teal : marginNum > 80 ? C.amber : '#EF4444';
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background: i%2===0 ? 'transparent' : C.cardAlt }}>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'11px', color:C.textSec }}>#{i+1}</td>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'12px', color:C.text, fontWeight: i<3 ? 700 : 400 }}>{p.name}</td>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'10px', color:C.textSec }}>{p.cat}</td>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'12px', color:C.textSec }}>{p.cost}</td>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'12px', color:C.text }}>{p.price}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontFamily:FONT, fontSize:'12px', fontWeight:700, color:mColor }}>{p.margin}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontFamily:FONT, fontSize:'12px', color:C.textSec }}>{p.units}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function BarOps() {
  const [screen, setScreen] = useState('dashboard');

  const SCREENS = {
    dashboard:  <Dashboard />,
    inventario: <Inventario />,
    staffing:   <Staffing />,
    agente:     <AgenteIA />,
    analytics:  <Analytics />,
  };

  return (
    <div style={{
      display:'flex', width:'100vw', height:'100vh',
      background:C.bg, overflow:'hidden', fontFamily:FONT,
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        input::placeholder { color: #555; font-family: 'Courier New', Courier, monospace; }
        button:hover { filter: brightness(1.1); }
      `}</style>
      <Sidebar active={screen} setActive={setScreen} />
      {SCREENS[screen]}
    </div>
  );
}

import React, { useState, useRef, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { Badge, RiskBadge, ShiftBadge, AvailBadge, StockBar, Stars, Avatar, Toast, Btn, Card, SLabel, TypingDots } from './components/ui';
import { C, F } from './constants/theme';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  LayoutDashboard, Package, Users, Bot, BarChart2,
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Send, HelpCircle, Plus, Bell, X, Zap, Search,
  ShoppingCart, ChevronDown, ChevronUp, UserCheck,
  BookOpen, Trash2, CreditCard, Store, Settings, Wine, Menu, LogOut, Camera,
  ClipboardList, Eye, RefreshCw
} from 'lucide-react';

// ─── APP CONTEXT ──────────────────────────────────────────────────────────────
const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

// ─── CSV IMPORT ───────────────────────────────────────────────────────────────
const TEMPLATE_CSV = `nombre,categoria,stock,unidad,precio,volumen_cl
Gin Hendrick's,Ginebra,3,bot,15.20,70
Estrella Galicia 30L,Cerveza,4,barril,65.00,3000
Croquetas Caseras,Tapas,45,racion,1.20,
Calamares Romana,Tapas,20,racion,2.50,
Limones frescos,Fruta fresca,80,ud,0.12,
Sirope de azúcar,Sirope,6,bot,4.80,100
`;

function parseCSV(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { ok:false, error:'Necesitas al menos una cabecera y una fila de datos.' };

  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const norm = s => s.trim().toLowerCase().replace(/['"]/g,'').normalize('NFD').replace(/[̀-ͯ]/g,'');
  const headers = lines[0].split(sep).map(norm);

  const col = (...keys) => { for (const k of keys) { const i=headers.indexOf(k); if(i>=0) return i; } return -1; };
  const nameIdx  = col('nombre','producto','name','descripcion','articulo');
  const catIdx   = col('categoria','categoría','category','tipo','familia','seccion');
  const stockIdx = col('stock','cantidad','existencias','qty','stock_actual','uds_stock');
  const unitIdx  = col('unidad','unit','um','formato','tipo_unidad');
  const priceIdx = col('precio','coste','cost','precio_bot','precio_botella','precio_unitario','precio_compra','pvp_compra','precio_coste');
  const volIdx   = col('volumen','volumen_cl','cl','capacidad','contenido','vol_cl','ml');

  if (nameIdx < 0) return { ok:false, error:'Columna "nombre" o "producto" no encontrada. Revisa la cabecera.' };
  if (priceIdx < 0) return { ok:false, error:'Columna "precio" o "coste" no encontrada. Revisa la cabecera.' };

  const results = [], errors = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(sep).map(c => c.trim().replace(/^["']|["']$/g,''));
    const name = cols[nameIdx]; if (!name) continue;
    const cat = catIdx>=0 ? cols[catIdx] : 'Importado';
    const priceRaw = parseFloat((cols[priceIdx]||'0').replace(',','.').replace(/[€$\s]/g,'')) || 0;
    const stockRaw = stockIdx>=0 ? cols[stockIdx] : '0';
    const unitRaw  = (unitIdx>=0 ? cols[unitIdx] : 'ud').toLowerCase().trim();
    const volRaw   = volIdx>=0 ? parseFloat((cols[volIdx]||'0').replace(',','.')) : 0;

    let cpu, unit, stockStr, pct, days;
    const stockQty = parseFloat(stockRaw.replace(',','.')) || 0;

    if (['bot','botella','botellas','bottle','bottles'].includes(unitRaw)) {
      const vol = volRaw>0 ? volRaw : 70;
      unit='cl'; cpu=priceRaw/vol;
      stockStr=`${stockQty} bot`; pct=Math.min(100,Math.round(stockQty*12)); days=Math.min(90,Math.round(stockQty*6));
    } else if (['l','litro','litros','liter','liters'].includes(unitRaw)) {
      unit='cl'; cpu=priceRaw/100;
      stockStr=`${stockQty} L`; pct=Math.min(100,Math.round(stockQty*15)); days=Math.min(90,Math.round(stockQty*8));
    } else if (unitRaw==='cl') {
      const vol=volRaw>0?volRaw:100;
      unit='cl'; cpu=priceRaw/vol;
      stockStr=`${stockQty} cl`; pct=Math.min(100,Math.round(stockQty/2)); days=Math.min(90,Math.round(stockQty/10));
    } else if (['barril','barriles','keg'].includes(unitRaw)) {
      const vol = volRaw > 0 ? volRaw : 3000; // Por defecto 30L = 3000cl
      unit = 'cl'; cpu = priceRaw / vol;
      stockStr = `${stockQty} barril${stockQty===1?'':'es'}`; 
      pct = Math.min(100, Math.round(stockQty * 50)); 
      days = Math.min(90, Math.round(stockQty * 15));
    } else if (['racion','raciones','tapa','tapas','porcion','porciones'].includes(unitRaw)) {
      unit = 'ud'; cpu = priceRaw;
      stockStr = `${stockQty} rac.`; 
      pct = Math.min(100, Math.round(stockQty * 5)); 
      days = Math.min(90, Math.round(stockQty * 2));
    } else if (['kg','kilo','kilos'].includes(unitRaw)) {
      unit='ud'; cpu=priceRaw/1000;
      stockStr=`${stockQty} kg`; pct=Math.min(100,Math.round(stockQty*10)); days=Math.min(90,Math.round(stockQty*5));
    } else {
      unit='ud'; cpu=priceRaw;
      stockStr=`${stockQty} ud`; pct=Math.min(100,Math.round(stockQty*3)); days=Math.min(90,Math.round(stockQty*2));
    }

    if (!priceRaw || cpu<=0) { errors.push(`Fila ${r+1}: precio inválido para "${name}"`); continue; }

    const risk = days<=3?'critical':days<=7?'medium':'stable';
    const safeId = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').slice(0,28);
    results.push({
      id:`imp_${safeId}_${r}`,
      name, cat, unit,
      cpu:Math.round(cpu*10000)/10000,
      stock:stockStr, rawStock: stockQty, pct, days, risk,
      weekly:'', cost:`€${cpu.toFixed(3)}`,
    });
  }
  return { ok:true, items:results, errors };
}


// ─── MOCK DATA: STAFFING ──────────────────────────────────────────────────────
const OPEN_SHIFTS = [
  { id:'s1', profile:'Bartender Senior', date:'Sáb 3 May', time:'21:00–03:00', cost:'€120', status:'urgent', match:['Laura Sánchez','Carlos Ruiz'] },
  { id:'s2', profile:'Camarero/a',       date:'Vie 2 May', time:'20:00–02:00', cost:'€90',  status:'urgent', match:['Ana López','Miguel Torres'] },
  { id:'s3', profile:'Bartender Junior',  date:'Dom 4 May', time:'18:00–00:00', cost:'€80',  status:'open',   match:['Carlos Ruiz','Sofía Méndez'] },
];
const COVERED_SHIFTS = [
  { id:'c1', profile:'Bartender Senior', date:'Jue 1 May', time:'20:00–02:00', cost:'€120', assigned:'Laura Sánchez', pro:'Laura Sánchez', rating:5.0 },
  { id:'c2', profile:'Camarero/a',       date:'Jue 1 May', time:'19:00–01:00', cost:'€90',  assigned:'Ana López',      pro:'Ana López',      rating:4.8 },
  { id:'c3', profile:'Runner',           date:'Sáb 3 May', time:'21:00–03:00', cost:'€70',  assigned:'Miguel Torres',  pro:'Miguel Torres',  rating:4.2 },
];
const TALENT = [
  { id:'t1', name:'Laura Sánchez', ini:'LS', role:'Bartender Senior', rating:5.0, rate:'€19/h', cost:'€19/h', avail:'today', img:null, spec:'Coctelería clásica', shifts:28, tags:['Coctelería','Clásica','Alto volumen'] },
  { id:'t2', name:'Carlos Ruiz',   ini:'CR', role:'Bartender Junior', rating:4.5, rate:'€14/h', cost:'€14/h', avail:'today', img:null, spec:'Coctelería molecular', shifts:15, tags:['Molecular','Flair','Creativo'] },
  { id:'t3', name:'Ana López',     ini:'AL', role:'Camarera',         rating:4.8, rate:'€13/h', cost:'€13/h', avail:'today', img:null, spec:'Servicio en barra', shifts:32, tags:['Barra','Sala','Eventos'] },
  { id:'t4', name:'Miguel Torres', ini:'MT', role:'Runner / Barback', rating:4.2, rate:'€11/h', cost:'€11/h', avail:'weekend',   img:null, spec:'Logística de sala', shifts:12, tags:['Runner','Logística','Nocturno'] },
  { id:'t5', name:'Sofía Méndez',  ini:'SM', role:'Bartender Junior', rating:4.0, rate:'€14/h', cost:'€14/h', avail:'weekend',   img:null, spec:'Cócteles de autor', shifts:8, tags:['Autor','Creativo','Sostenible'] },
];

// ─── MOCK DATA: AGENTE IA ─────────────────────────────────────────────────────
const getNow = () => new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
const INITIAL_CHAT = [
  { id:1, role:'agent', time:'ahora', text:'👋 Hola, soy el **Agente BarOps**. Tengo acceso en tiempo real a tu inventario, ventas y equipo.\n\nPregúntame lo que necesites o usa las sugerencias rápidas de abajo.' },
];

// ─── MOCK DATA: CARTA (INGREDIENTS) ──────────────────────────────────────────
const INGREDIENTS_DB = [
  { id:'ing1', name:'Ginebra London Dry', unit:'cl', cost:0.18 },
  { id:'ing2', name:'Tónica Premium',     unit:'ud', cost:1.20 },
  { id:'ing3', name:'Limón fresco',       unit:'ud', cost:0.15 },
  { id:'ing4', name:'Hielo',              unit:'kg', cost:0.50 },
  { id:'ing5', name:'Ron Blanco',         unit:'cl', cost:0.14 },
  { id:'ing6', name:'Zumo de lima',       unit:'cl', cost:0.08 },
  { id:'ing7', name:'Azúcar',             unit:'g',  cost:0.002 },
  { id:'ing8', name:'Menta fresca',       unit:'ud', cost:0.10 },
  { id:'ing9', name:'Vodka Premium',      unit:'cl', cost:0.22 },
  { id:'ing10', name:'Aperol',            unit:'cl', cost:0.16 },
  { id:'ing11', name:'Prosecco',          unit:'cl', cost:0.12 },
  { id:'ing12', name:'Campari',           unit:'cl', cost:0.20 },
  { id:'ing13', name:'Vermut Rojo',       unit:'cl', cost:0.10 },
  { id:'ing14', name:'Soda',              unit:'cl', cost:0.03 },
  { id:'ing15', name:'Triple Sec',        unit:'cl', cost:0.12 },
  { id:'ing16', name:'Tequila Blanco',    unit:'cl', cost:0.25 },
  { id:'ing17', name:'Whisky Bourbon',    unit:'cl', cost:0.20 },
  { id:'ing18', name:'Angostura',         unit:'dash', cost:0.05 },
];

const marginColor = (m) => m >= 70 ? C.teal : m >= 50 ? C.amber : '#EF4444';

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
};

const generateCSV = (headers, rows) => {
  const csv = [headers, ...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  return csv;
};

const downloadCSV = (csv, filename) => {
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const formatDateISO = (date = new Date()) => date.toISOString().split('T')[0];

const getPublicLogoUrl = (filename) => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  if (!filename) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/logos/${filename}`;
};

// ─── ATOMS ────────────────────────────────────────────────────────────────────
// (Atoms extracted to src/components/ui/index.jsx)
// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, localName, onOpenLocalSettings, onLogout }) {
  const [mobile, setMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(localStorage.getItem('barops_local_photo') || '');

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { userRole, cartItems, setShowCartDrawer } = useApp() || {};

  const NAV = [
    { id:'dashboard',  Icon:LayoutDashboard, label:'DASHBOARD'  },
    { id:'inventario', Icon:Package,         label:'INVENTARIO' },
    { id:'historial',  Icon:ClipboardList,   label:'PEDIDOS'    },
    ...(userRole === 'manager' ? [
      { id:'staffing',   Icon:Users,           label:'STAFFING'   },
      { id:'analytics',  Icon:BarChart2,       label:'ANALYTICS'  },
      { id:'pricing',    Icon:CreditCard,      label:'BILLING'    },
    ] : []),
    { id:'agente',     Icon:Bot,             label:'AGENTE IA'  },
    { id:'carta',      Icon:BookOpen,        label:'CARTA'      },
  ];

  const handleNavClick = (id) => {
    setActive(id);
    if (mobile) setSidebarOpen(false);
  };

  const sidebarContent = (
    <>
      <div style={{ padding:'24px 22px 20px', borderBottom:`1px solid ${C.border2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} alt="Logo" />
          <div style={{ fontFamily:F, fontSize:'24px', fontWeight:700, color:C.orange, letterSpacing:'7px', lineHeight:1 }}>BAROPS</div>
        </div>
        <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'3px', marginTop:8 }}>SISTEMA OPERATIVO</div>
      </div>
      <div style={{ padding:'16px 14px', borderBottom:`1px solid ${C.border}`, background:`linear-gradient(135deg, ${C.card}44 0%, ${C.cardAlt}44 100%)` }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{
            width:52, height:52, borderRadius:6, background:C.cardAlt, border:`2px solid ${C.orange}`,
            display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0,
            boxShadow:`0 0 16px ${C.orange}33`
          }}>
            {localPhoto ? (
              <img src={localPhoto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            ) : (
              <Store size={24} color={C.orange}/>
            )}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:3 }}>LOCAL</div>
            <div style={{ fontFamily:F, fontSize:'14px', color:C.text, lineHeight:'1.3', fontWeight:700, wordBreak:'break-word' }}>{localName}</div>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:6 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:C.teal, boxShadow:`0 0 6px ${C.teal}` }}/>
              <span style={{ fontFamily:F, fontSize:'12px', color:C.teal, letterSpacing:'1px' }}>ACTIVO</span>
            </div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1, padding:'10px 0' }}>
        {NAV.map(({ id,Icon,label }) => {
          const on = active===id;
          return (
            <div key={id} onClick={()=>handleNavClick(id)} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 22px', cursor:'pointer',
              background:on?`${C.orange}12`:'transparent',
              borderLeft:on?`2px solid ${C.orange}`:'2px solid transparent',
              transition:'all 0.12s',
            }}>
              <Icon size={14} color={on?C.orange:C.textSec}/>
              <span style={{ fontFamily:F, fontSize:'14px', letterSpacing:'2.5px', color:on?C.orange:C.textSec, fontWeight:on?700:400 }}>
                {label}
              </span>
            </div>
          );
        })}
      </nav>
      <div style={{ padding:'16px 22px', borderTop:`1px solid ${C.border2}` }}>
        {userRole === 'manager' && (
          <button onClick={() => onOpenLocalSettings?.()} style={{ width:'100%', padding:'10px 14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, marginBottom:12, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:10 }}>
            <Store size={14} color={C.orange}/>
            <div style={{ textAlign:'left', flex:1 }}>
              <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px' }}>GESTIÓN</div>
              <div style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'1.5px', fontWeight:700 }}>LOCAL</div>
            </div>
          </button>
        )}
        {(() => {
          const sub = localStorage.getItem('barops_subscription') ? JSON.parse(localStorage.getItem('barops_subscription')) : null;
          const bg = sub?.status==='active'?C.purpleBg:C.tealBg;
          const color = sub?.status==='active'?C.purple:C.teal;
          const label = sub?.status==='active'?'ACTIVO':'TRIAL';
          return (
            <div style={{ padding:'10px 14px', background:bg, border:`1px solid ${color}44`, borderRadius:4, marginBottom:12, cursor:'pointer' }} onClick={() => setActive('pricing')}>
              <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px' }}>PLAN ACTUAL</div>
              <div style={{ fontFamily:F, fontSize:'16px', color, letterSpacing:'4px', fontWeight:700, marginTop:3 }}>PRO</div>
              <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec, marginTop:2 }}>{label}{sub?' · 14 días':''}</div>
            </div>
          );
        })()}
        <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'4px 0' }}>
          <HelpCircle size={12} color={C.textSec}/>
          <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px' }}>AYUDA & SOPORTE</span>
        </div>
        <div onClick={onLogout} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 0', marginTop: 12, borderTop: `1px solid ${C.border2}` }}>
          <LogOut size={12} color={C.red}/>
          <span style={{ fontFamily:F, fontSize:'13px', color:C.red, letterSpacing:'1.5px', fontWeight:700 }}>CERRAR SESIÓN</span>
        </div>
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        <div style={{ position:'fixed', top:0, left:0, right:0, height:60, background:C.cardAlt, borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', boxSizing:'border-box', zIndex:1000 }}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ background:'none', border:'none', cursor:'pointer', color:C.orange, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {sidebarOpen ? <X size={20}/> : <ChevronDown size={20} style={{transform:'rotate(-90deg)'}}/>}
          </button>
          <div style={{ fontFamily:F, fontSize:'16px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>BAROPS</div>
        {(cartItems && cartItems.length > 0) && (
          <div onClick={() => setShowCartDrawer(true)} style={{ cursor:'pointer', background:C.orange, borderRadius:20, padding:'4px 10px', display:'flex', alignItems:'center', gap:6, color:'#000' }}>
            <ShoppingCart size={14} />
            <span style={{ fontSize:12, fontWeight:700 }}>{cartItems.length}</span>
          </div>
        )}
          <div style={{ width:20 }}/>
        </div>
        {sidebarOpen && (
          <>
            <div onClick={()=>setSidebarOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:999 }}/>
            <div style={{ position:'fixed', top:60, left:0, width:224, maxHeight:'calc(100vh - 60px)', background:C.cardAlt, borderRight:`1px solid ${C.border2}`, display:'flex', flexDirection:'column', overflowY:'auto', zIndex:1001 }}>
              {sidebarContent}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div style={{ width:224, minHeight:'100vh', background:C.cardAlt, borderRight:`1px solid ${C.border2}`, display:'flex', flexDirection:'column', flexShrink:0 }}>
      {sidebarContent}
    </div>
  );
}

// ─── SCREEN 1: DASHBOARD ──────────────────────────────────────────────────────

// ─── SCREEN 1: DASHBOARD ──────────────────────────────────────────────────────
// ─── DASHBOARD HELPERS ────────────────────────────────────────────────────────
const CounterUp = ({ value, duration = 800, prefix = '', suffix = '', decimals = 0 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let startTimestamp = null;
    const endValue = parseFloat(value) || 0;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * endValue;
      setDisplay(current);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return (
    <span style={{ fontWeight: 700 }}>
      {prefix}
      {display.toLocaleString('es-ES', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}
      {suffix}
    </span>
  );
};

const Skeleton = ({ width = '100%', height = 20, borderRadius = 4, mb = 0 }) => (
  <div className="skeleton-pulse" style={{ 
    width, height, borderRadius, marginBottom: mb,
    background: '#1A1A1A',
    overflow: 'hidden',
    position: 'relative'
  }}>
    <style>{`
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
      .skeleton-pulse { animation: pulse 1.5s ease-in-out infinite; }
    `}</style>
  </div>
);

const formatDateRelative = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHour < 24) return `Hace ${diffHour}h`;
  if (diffDay === 1) return 'Ayer';
  return `Hace ${diffDay} días`;
};

const getSeverityColor = (s) => {
  if (s <= 0) return '#EF4444';
  if (s <= 5) return '#F59E0B';
  return '#10B981';
};

const getSeverityLabel = (s) => {
  if (s <= 0) return 'CRÍTICO';
  if (s <= 5) return 'MEDIO';
  return 'ESTABLE';
};

function Dashboard({ onNavigate }) {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ products: [], cocktails: [], movements: [] });
  const [expandedAlerts, setExpandedAlerts] = useState(false);
  const [agentQuery, setAgentQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';
  const { localName, userRole, setCartItems } = useApp() || {};

  const handlePedir = (p) => {
    if (setCartItems) {
      setCartItems(prev => {
        const ex = prev.find(i => i.id === p.id);
        if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { ...p, qty: 1 }];
      });
      setToast('Añadido al carrito');
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const CHIPS = [
    '¿Cómo mejorar mi margen en Gin Tonics?',
    'Genera la lista de pedido para este finde',
    '¿Cuál es mi cóctel más rentable?',
    '¿Qué bartender me recomiendas para el sábado?',
  ];

  const handleAgentSubmit = (q) => {
    const finalQuery = q || agentQuery;
    if (!finalQuery.trim()) return;
    localStorage.setItem('barops_agent_query', finalQuery);
    onNavigate('agente');
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      
      const [pRes, cRes, mRes] = await Promise.all([
        supabase.from('productos').select('*').eq('local_id', LOCAL_ID),
        supabase.from('cocteles').select('*').eq('local_id', LOCAL_ID),
        supabase.from('movimientos_stock')
          .select('*, productos(nombre)')
          .eq('local_id', LOCAL_ID)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (pRes.error) throw pRes.error;
      if (cRes.error) throw cRes.error;
      if (mRes.error) throw mRes.error;

      setData({
        products: pRes.data || [],
        cocktails: cRes.data || [],
        movements: mRes.data || []
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Mock data para gráficos de Dashboard (Recharts)
  const chartData = [
    { name: 'Lun', ingresos: 1200, costes: 350 },
    { name: 'Mar', ingresos: 1100, costes: 320 },
    { name: 'Mié', ingresos: 1450, costes: 410 },
    { name: 'Jue', ingresos: 1800, costes: 480 },
    { name: 'Vie', ingresos: 2900, costes: 850 },
    { name: 'Sáb', ingresos: 3200, costes: 980 },
    { name: 'Dom', ingresos: 2400, costes: 620 },
  ];

  // Derived Metrics
  const criticals = data.products.filter(p => parseFloat(p.stock_actual || 0) <= parseFloat(p.stock_minimo || 0));
  const preventives = data.products.filter(p => {
    const s = parseFloat(p.stock_actual || 0);
    const m = parseFloat(p.stock_minimo || 0);
    return s > m && s <= m * 1.5;
  });
  const stablest = data.products.length - criticals.length;
  const valorStock = data.products.reduce((acc, p) => acc + (parseFloat(p.stock_actual || 0) * parseFloat(p.coste_unitario || 0)), 0);
  const activeCocktails = data.cocktails.filter(c => c.estado === 'activo').length;
  const draftCocktails = data.cocktails.filter(c => c.estado === 'borrador').length;
  const revisionCocktails = data.cocktails.filter(c => c.estado === 'revision').length;
  
  const mermaRiesgo = criticals.reduce((acc, p) => {
    const diff = Math.max(0, parseFloat(p.stock_minimo || 0) - parseFloat(p.stock_actual || 0));
    return acc + (diff * parseFloat(p.coste_unitario || 0));
  }, 0);

  // Greeting logic
  const hour = new Date().getHours();
  const greeting = hour >= 6 && hour < 13 ? "Buenos días" : hour >= 13 && hour < 20 ? "Buenas tardes" : "Buenas noches";
  const statusMsg = criticals.length > 0 
    ? { text: `Tienes ${criticals.length} productos críticos que necesitan atención.`, color: C.red }
    : preventives.length > 0 
    ? { text: `Todo bajo control. ${preventives.length} productos en nivel preventivo.`, color: C.amber }
    : { text: "Inventario en buen estado. Buen servicio esta noche.", color: C.teal };

  // Alertas
  const alerts = [];
  criticals.forEach(p => {
    alerts.push({
      type: 'critical',
      text: `${p.nombre}: quedan ${p.stock_actual} ${p.unidad}. Stock mínimo: ${p.stock_minimo}. Actúa hoy.`,
      action: 'PEDIR →',
      handler: () => {
        if (p.telefono_proveedor) {
          const msg = encodeURIComponent(`Hola, necesito reponer ${p.nombre}...`);
          window.open(`https://wa.me/${p.telefono_proveedor.replace(/\s+/g,'')}?text=${msg}`, '_blank');
        } else {
          navigator.clipboard.writeText(`Necesito reponer ${p.nombre}`);
          setToast('Mensaje copiado — envíalo a tu proveedor');
        }
      }
    });
  });

  preventives.forEach(p => {
    alerts.push({
      type: 'preventive',
      text: `${p.nombre}: stock para aprox. ${Math.round(p.stock_actual / (p.stock_minimo || 1) * 3)} días. Pide pronto.`,
      action: 'VER INVENTARIO →',
      handler: () => onNavigate('inventario')
    });
  });

  if (draftCocktails > 0) {
    alerts.push({
      type: 'carta',
      text: `Tienes ${draftCocktails} cócteles en borrador sin publicar.`,
      action: 'IR A CARTA →',
      handler: () => onNavigate('carta')
    });
  }

  if (alerts.length === 0) {
    alerts.push({ type: 'info', text: "Todo el inventario en niveles correctos ✓" });
  }

  const visibleAlerts = expandedAlerts ? alerts : alerts.slice(0, 8);

  // Recent Movements Relative Time
  const getRelTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff/3600)} h`;
    if (diff < 172800) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
  };

  if (error) {
    return (
      <div style={{ flex:1, padding:40, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
        <Card sx={{ padding:32, textAlign:'center', maxWidth:400 }}>
          <AlertTriangle size={48} color={C.red} style={{ marginBottom:16 }} />
          <h2 style={{ fontFamily:F, color:C.text }}>Error al cargar datos</h2>
          <p style={{ fontFamily:F, color:C.textSec, fontSize:'14px', marginBottom:24 }}>{error}</p>
          <Btn onClick={fetchData}>REINTENTAR</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:isMobile?'20px 16px':'28px 32px', overflowY:'auto', overflowX:'hidden', fontFamily:F, background:C.bg, width:'100%' }}>
      {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}

      {/* SECCIÓN 1 — SALUDO INTELIGENTE */}
      <div style={{ display:'flex', flexDirection:isMobile?'column':'row', justifyContent:'space-between', alignItems:isMobile?'flex-start':'flex-end', marginBottom:24, gap:isMobile?8:0 }}>
        <div>
          {loading ? (
            <>
              <Skeleton width={200} height={28} mb={8} />
              <Skeleton width={350} height={16} />
            </>
          ) : (
            <>
              <h1 style={{ margin:0, fontSize:isMobile?'20px':'24px', fontWeight:700, color:C.text, letterSpacing:'-0.5px' }}>
                {greeting}, <span style={{ color:C.orange }}>{localName}</span>
              </h1>
              <p style={{ margin:'8px 0 0', fontSize:isMobile?'12px':'14px', color:statusMsg.color, fontWeight:500 }}>
                {statusMsg.text}
              </p>
            </>
          )}
        </div>
        {!isMobile && <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec, letterSpacing:'2px', textTransform:'uppercase' }}>
            {new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>}
      </div>

      {/* SECCIÓN 1.5 — ACCESOS RÁPIDOS */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2, 1fr)':'repeat(4, 1fr)', gap:12, marginBottom:32 }}>
        <Btn variant="ghost" onClick={() => onNavigate('inventario')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <Package size={20} color={C.teal} />
          <span style={{ fontSize:'13px', letterSpacing:'1px', fontWeight:700 }}>NUEVO PEDIDO</span>
        </Btn>
        <Btn variant="ghost" onClick={() => onNavigate('inventario')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <AlertTriangle size={20} color={C.red} />
          <span style={{ fontSize:'13px', letterSpacing:'1px', fontWeight:700 }}>REGISTRAR MERMA</span>
        </Btn>
        <Btn variant="ghost" onClick={() => onNavigate('carta')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <Wine size={20} color={C.purple} />
          <span style={{ fontSize:'13px', letterSpacing:'1px', fontWeight:700 }}>ESCANDALLOS</span>
        </Btn>
        <Btn variant="ghost" onClick={() => handleAgentSubmit('¿Cómo mejoro mi margen hoy?')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:`${C.orange}10`, border:`1px solid ${C.orange}44`, height:'auto' }}>
          <Bot size={20} color={C.orange} />
          <span style={{ fontSize:'13px', letterSpacing:'1px', color:C.orange, fontWeight:700 }}>CONSULTAR IA</span>
        </Btn>
      </div>

      {/* SECCIÓN 2 — ALERTAS DEL DÍA */}
      <div style={{ marginBottom:32, width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ fontSize:'14px', letterSpacing:'3px', color:C.textSec, margin:0, fontWeight:700 }}>ACCIONES DE HOY ({alerts.length})</h2>
        </div>
        <Card sx={{ overflow:'hidden', maxHeight:'200px', overflowY:'auto', overflowX:'auto', width:'100%', boxSizing:'border-box' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:0, width:'100%' }}>
            {loading ? [1,2,3].map(i => <Skeleton key={i} height={50} />) : (
              visibleAlerts.map((a, i) => (
                <div key={i} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 16px', borderBottom:`1px solid ${C.border}`,
                  background: a.type==='critical' ? '#FF000006' : a.type==='preventive' ? '#F59E0B06' : a.type==='carta' ? '#7C3AED06' : '#00D4AA06',
                  borderLeft: `3px solid ${a.type==='critical' ? C.red : a.type==='preventive' ? C.amber : a.type==='carta' ? C.purple : C.teal}`,
                  animation: `fadeIn 0.2s ease-out ${i*50}ms both`,
                  transition:'background 0.2s'
                }} onMouseEnter={e=>e.currentTarget.style.background='#1A1A1A'} onMouseLeave={e=>e.currentTarget.style.background=a.type==='critical' ? '#FF000006' : a.type==='preventive' ? '#F59E0B06' : a.type==='carta' ? '#7C3AED06' : '#00D4AA06'}>
                  <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
                  <span style={{ fontSize:'14px', color:'#666666', fontWeight:400, flex:1 }}>{a.text}</span>
                  {a.action && <Btn variant="ghost" onClick={a.handler} sx={{ padding:'8px 16px', fontSize:'12px', flexShrink:0, marginLeft:8 }}>{a.action}</Btn>}
                </div>
              ))
            )}
            {!expandedAlerts && alerts.length > 8 && (
              <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, textAlign:'center' }}>
                <Btn variant="ghost" onClick={()=>setExpandedAlerts(true)} sx={{ fontSize:'12px' }}>VER TODAS ({alerts.length})</Btn>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* SECCIÓN 3 — 4 KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2, 1fr)':(userRole === 'manager' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)'), gap:isMobile?12:20, marginBottom:32, width:'100%' }}>
        {loading ? [1,2,3,4].map(i => <Skeleton key={i} height={120} />) : (
          <>
            <Card sx={{ padding:20, position:'relative', overflow:'hidden' }}>
              <SLabel label="SALUD INVENTARIO" color={C.orange} icon={Package}/>
              <div style={{ fontSize:'28px', color:C.text }}><CounterUp value={data.products.length} /></div>
              <div style={{ fontSize:'14px', color:C.textSec, marginTop:4 }}>
                {stablest} estables · <span style={{ color:criticals.length>0?C.red:C.textSec }}>{criticals.length} críticos</span>
              </div>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, display:'flex' }}>
                <div style={{ height:'100%', background:C.teal, width:`${(stablest/data.products.length)*100}%`, transition:'width 0.6s' }} />
                <div style={{ height:'100%', background:C.red, width:`${(criticals.length/data.products.length)*100}%`, transition:'width 0.6s' }} />
              </div>
            </Card>

            {userRole === 'manager' && (
              <Card sx={{ padding:20 }}>
                <SLabel label="VALOR EN STOCK" color={C.teal} icon={TrendingUp}/>
                <div style={{ fontSize:'28px', color:valorStock>0?C.text:C.textSec }}>
                  {valorStock > 0 ? <CounterUp value={valorStock} prefix="€" decimals={0} /> : "Sin valorar"}
                </div>
                <div style={{ fontSize:'14px', color:C.textSec, marginTop:4 }}>
                  {valorStock > 0 ? `${data.products.length} productos valorados` : "Añade costes en Inventario"}
                </div>
              </Card>
            )}

            <Card sx={{ padding:20 }}>
              <SLabel label="CARTA ACTIVA" color={C.purple} icon={BookOpen}/>
              <div style={{ fontSize:'28px', color:C.text }}><CounterUp value={activeCocktails} /></div>
              <div style={{ fontSize:'14px', color:C.textSec, marginTop:4 }}>
                <span style={{ color:draftCocktails>0?C.amber:C.textSec }}>{draftCocktails} borradores</span> · {revisionCocktails} revisión
              </div>
            </Card>

            {userRole === 'manager' && (
              <Card sx={{ padding:20 }}>
                <SLabel label="MERMA ESTIMADA" color={C.red} icon={AlertTriangle}/>
                <div style={{ fontSize:'28px', color:mermaRiesgo>0?C.red:C.teal }}>
                  {mermaRiesgo > 0 ? <CounterUp value={mermaRiesgo} prefix="€" /> : "€0"}
                </div>
                <div style={{ fontSize:'14px', color:C.textSec, marginTop:4 }}>
                  {mermaRiesgo > 0 ? "Valor en riesgo de perderse" : "Sin merma detectada"}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* SECCIÓN 3.5 — RENDIMIENTO FINANCIERO */}
      {userRole === 'manager' && (
        <div style={{ marginBottom:32, width:'100%' }}>
          <h2 style={{ fontSize:'14px', letterSpacing:'3px', color:C.textSec, margin:'0 0 16px 0', fontWeight:700 }}>RENDIMIENTO FINANCIERO (7 DÍAS)</h2>
          <Card sx={{ padding:isMobile?'16px 8px':'24px', height:300 }}>
            {loading ? <Skeleton height="100%" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border2} vertical={false} />
                  <XAxis dataKey="name" stroke={C.textSec} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke={C.textSec} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                  <Tooltip 
                    contentStyle={{ background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:8, fontFamily:F, fontSize:11 }}
                    itemStyle={{ fontWeight:700, color: C.text }}
                    formatter={(value) => [`€${value}`, undefined]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: F, paddingTop: 10 }} />
                  <Line type="monotone" name="Ingresos brutos" dataKey="ingresos" stroke={C.teal} strokeWidth={3} dot={{ r: 4, fill: C.teal, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Costes operacionales" dataKey="costes" stroke={C.orange} strokeWidth={3} dot={{ r: 4, fill: C.orange, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      {/* SECCIÓN 4 — INVENTARIO URGENTE */}
      <div style={{ marginBottom:32, width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:'14px', letterSpacing:'3px', color:C.textSec, margin:0, fontWeight:700 }}>REQUIEREN ATENCIÓN</h2>
          {!isMobile && <Btn variant="ghost" onClick={()=>onNavigate('inventario')} sx={{ fontSize:'12px' }}>VER TODO EL INVENTARIO →</Btn>}
        </div>
        {!isMobile ? (
        <Card sx={{ overflow:'hidden', maxHeight:'200px', overflowY:'auto', overflowX:'auto', width:'100%', boxSizing:'border-box' }}>
          <div style={{ overflowX:'auto', overflowY:'hidden', width:'100%' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
            <thead>
              <tr style={{ background:'#0D0D0D', borderBottom:`1px solid ${C.border}` }}>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'12px', color:'#555555', letterSpacing:'1px' }}>PRODUCTO</th>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'12px', color:'#555555', letterSpacing:'1px' }}>STOCK</th>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'12px', color:'#555555', letterSpacing:'1px' }}>ESTADO</th>
                <th style={{ textAlign:'right', padding:'10px 16px', fontSize:'12px', color:'#555555', letterSpacing:'1px' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3,4].map(i => (
                <tr key={i}><td colSpan={4} style={{ padding:10 }}><Skeleton height={40}/></td></tr>
              )) : (
                (() => {
                  const items = data.products
                    .filter(p => parseFloat(p.stock_actual || 0) <= parseFloat(p.stock_minimo || 0) * 1.5)
                    .sort((a,b) => {
                      const sA = parseFloat(a.stock_actual||0), sB = parseFloat(b.stock_actual||0);
                      if (sA === 0) return -1; if (sB === 0) return 1;
                      return sA - sB;
                    })
                    .slice(0, 8);
                  
                  if (items.length === 0) return (
                    <tr><td colSpan={4} style={{ padding:32, textAlign:'center', color:C.teal, fontSize:'13px' }}>✓ Todos los productos en niveles correctos</td></tr>
                  );

                  return items.map((p, i) => {
                    const s = parseFloat(p.stock_actual||0);
                    const m = parseFloat(p.stock_minimo||0);
                    const isZero = s === 0;
                    const isCrit = s <= m;
                    const bg = isZero ? '#FF000006' : isCrit ? '#FF6B3506' : '#F59E0B04';
                    return (
                      <tr key={p.id} style={{ background:bg, borderBottom:`1px solid ${C.border}`, transition:'background 0.2s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#1A1A1A'}
                        onMouseLeave={e=>e.currentTarget.style.background=bg}>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ color:isZero?C.red:'#666666', fontSize:'14px', fontWeight:400 }}>{p.nombre}</div>
                          <div style={{ color:'#555555', fontSize:'12px', marginTop:2 }}>{p.categoria}</div>
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ fontSize:'14px', color:'#666666' }}>{s} {p.unit || p.unidad}</div>
                          <div style={{ width:60, height:3, background:'#222', marginTop:4, borderRadius:2 }}>
                            <div style={{ width:`${Math.min(100, (s/(m||1))*50)}%`, height:'100%', background:isCrit?C.red:C.amber }} />
                          </div>
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <Badge
                            label={isZero?'SIN STOCK':isCrit?'CRÍTICO':'PREVENTIVO'}
                            color={isCrit?C.red:C.amber}
                            bg={isCrit?C.redBg:C.amberBg}
                          />
                        </td>
                        <td style={{ padding:'10px 16px', textAlign:'right' }}>
                          <Btn variant="ghost" onClick={() => p.proveedor ? handlePedir(p) : onNavigate('inventario')} sx={{ fontSize:'12px', padding:'8px 16px' }}>
                            {p.proveedor ? 'PEDIR' : 'GESTIONAR'}
                          </Btn>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
          </div>
        </Card>
        ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, width:'100%' }}>
          {loading ? [1,2,3].map(i => <Skeleton key={i} height={100} />) : (
            (() => {
              const items = data.products
                .filter(p => parseFloat(p.stock_actual || 0) <= parseFloat(p.stock_minimo || 0) * 1.5)
                .sort((a,b) => {
                  const sA = parseFloat(a.stock_actual||0), sB = parseFloat(b.stock_actual||0);
                  if (sA === 0) return -1; if (sB === 0) return 1;
                  return sA - sB;
                })
                .slice(0, 8);

              if (items.length === 0) return <Card sx={{ padding:32, textAlign:'center', color:C.teal, fontSize:'13px', width:'100%', boxSizing:'border-box' }}>✓ Todos los productos en niveles correctos</Card>;

              return items.map(p => {
                const s = parseFloat(p.stock_actual||0);
                const m = parseFloat(p.stock_minimo||0);
                const isZero = s === 0;
                const isCrit = s <= m;
                return (
                  <Card key={p.id} sx={{ padding:16, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, background:isZero ? '#FF000606' : isCrit ? '#FF6B3506' : '#F59E0B04', width:'100%', boxSizing:'border-box' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'14px', color:isZero?C.red:'#999', fontWeight:600 }}>{p.nombre}</div>
                      <div style={{ fontSize:'13px', color:C.textSec, marginTop:4 }}>{p.categoria}</div>
                      <div style={{ fontSize:'13px', color:C.textSec, marginTop:2 }}>{s} {p.unit || p.unidad} · Stock min: {m}</div>
                      <Badge label={isZero?'SIN STOCK':isCrit?'CRÍTICO':'PREVENTIVO'} color={isCrit?C.red:C.amber} bg={isCrit?C.redBg:C.amberBg} style={{ marginTop:8 }} />
                    </div>
                    <Btn variant="ghost" onClick={() => p.proveedor ? handlePedir(p) : onNavigate('inventario')} sx={{ fontSize:'12px', padding:'10px 18px', whiteSpace:'nowrap' }}>
                      {p.proveedor ? 'PEDIR' : 'GESTIONAR'}
                    </Btn>
                  </Card>
                );
              });
            })()
          )}
        </div>
        )}
      </div>

      {/* SECCIÓN 5 — DOS PANELES EN COLUMNAS */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?16:24, marginBottom:32, width:'100%' }}>
        {/* COLUMNA IZQUIERDA — ESTADO DE LA CARTA */}
        <div style={{ width:'100%' }}>
          <h2 style={{ fontSize:'14px', letterSpacing:'3px', color:C.textSec, marginBottom:16, fontWeight:700 }}>CARTA</h2>
          <Card sx={{ padding:24, height:'100%', width:'100%', boxSizing:'border-box' }}>
            {loading ? <Skeleton height={150}/> : data.cocktails.length === 0 ? (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ color:C.textSec, fontSize:'14px', marginBottom:16 }}>Sin cócteles en carta</div>
                <Btn variant="outline" onClick={()=>onNavigate('carta')}>CREAR PRIMER CÓCTEL →</Btn>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:C.teal }} />
                    <span style={{ fontSize:'13px', color:C.textSec }}>Cócteles activos</span>
                  </div>
                  <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{activeCocktails}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:C.amber }} />
                    <span style={{ fontSize:'13px', color:C.textSec }}>En revisión</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{revisionCocktails}</span>
                    {revisionCocktails > 0 && <span onClick={()=>onNavigate('carta')} style={{ color:C.orange, fontSize:'14px', cursor:'pointer', fontWeight:700 }}>Revisar →</span>}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#444' }} />
                    <span style={{ fontSize:'13px', color:C.textSec }}>Borradores</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{draftCocktails}</span>
                    {draftCocktails > 0 && <span onClick={()=>onNavigate('carta')} style={{ color:C.orange, fontSize:'14px', cursor:'pointer', fontWeight:700 }}>Ver borradores →</span>}
                  </div>
                </div>

                {criticals.length > 0 && (
                  <div style={{ marginTop:8, padding:'12px', background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:C.amber, fontSize:'14px', fontWeight:600 }}>⚠ {criticals.length} cócteles afectados por stock</span>
                    <Btn variant="ghost" onClick={()=>onNavigate('carta')} sx={{ fontSize:'12px', padding:'4px 8px', color:C.amber, borderColor:`${C.amber}44` }}>VER CARTA →</Btn>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* COLUMNA DERECHA — ACTIVIDAD RECIENTE */}
        <div>
          <h2 style={{ fontSize:'14px', letterSpacing:'3px', color:C.textSec, marginBottom:16, fontWeight:700 }}>ACTIVIDAD RECIENTE</h2>
          <Card sx={{ padding:0, height:'100%', overflow:'hidden' }}>
            {loading ? <div style={{ padding:20 }}><Skeleton height={150}/></div> : data.movements.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:C.textSec, fontSize:'14px' }}>Sin actividad registrada todavía</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column' }}>
                {data.movements.map((m, i) => (
                  <div key={m.id} style={{
                    padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center',
                    borderBottom: i < data.movements.length-1 ? `1px solid ${C.border}` : 'none'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ 
                        width:8, height:8, borderRadius:'50%', 
                        background: m.tipo==='entrada'?C.teal : m.tipo==='salida'?C.orange : m.tipo==='merma'?C.red : C.amber 
                      }} />
                      <div>
                        <div style={{ fontSize:'14px', color:C.text, fontWeight:700, letterSpacing:'0.5px' }}>
                          {m.tipo?.toUpperCase()} — {m.productos?.nombre || 'Producto'}
                        </div>
                        {m.motivo && <div style={{ fontSize:'13px', color:C.textSec, marginTop:2 }}>{m.motivo}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize:'13px', color:C.textSec }}>{getRelTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* SECCIÓN 6 — ACCESO RÁPIDO AL AGENTE */}
      <div style={{ marginBottom:40, width:'100%' }}>
        <Card sx={{ padding:isMobile?16:24, borderLeft:`2px solid ${C.orange}`, width:'100%', boxSizing:'border-box' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <span style={{ fontSize:'14px', fontWeight:700, letterSpacing:'2px', color:C.textSec }}>AGENTE BAROPS</span>
            <Badge label="IA" color={C.orange} bg={C.orangeBg} />
          </div>
          <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:isMobile?8:12, marginBottom:16, width:'100%' }}>
            <input
              style={{
                flex:1, background:C.cardAlt, border:`1px solid ${C.border2}`,
                borderRadius:4, padding:'12px 14px', color:C.text, fontFamily:F, outline:'none', fontSize:isMobile?'14px':'inherit', minWidth:0, boxSizing:'border-box'
              }}
              placeholder={isMobile?'Pregunta...':'Pregunta algo...'}
              value={agentQuery}
              onChange={e=>setAgentQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && handleAgentSubmit()}
            />
            <button
              onClick={()=>handleAgentSubmit()}
              style={{
                width:isMobile?'100%':48, height:48, background:C.orange, border:'none', borderRadius:4,
                cursor:'pointer', color:'#000', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
              }}>
              <Send size={18} />
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:isMobile?'column':'row', flexWrap:isMobile?'nowrap':'wrap', gap:isMobile?8:8, overflowX:isMobile?'hidden':'visible', overflowY:'hidden', width:'100%' }}>
            {isMobile ? CHIPS.slice(0, 2).map(c => (
              <button key={c} onClick={()=>handleAgentSubmit(c)} style={{
                background:'transparent', border:`1px solid ${C.border2}`, borderRadius:20,
                padding:'6px 10px', fontSize:'12px', color:C.textSec, cursor:'pointer',
                transition:'all 0.2s', fontFamily:F, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden', minWidth:0, flex:0.9
              }} onMouseEnter={e=>{e.target.style.borderColor=C.orange; e.target.style.color=C.orange;}}
                 onMouseLeave={e=>{e.target.style.borderColor=C.border2; e.target.style.color=C.textSec;}}>
                "{c.substring(0,30)}..."
              </button>
            )) : CHIPS.map(c => (
              <button key={c} onClick={()=>handleAgentSubmit(c)} style={{
                background:'transparent', border:`1px solid ${C.border2}`, borderRadius:20,
                padding:'6px 16px', fontSize:'14px', color:C.textSec, cursor:'pointer',
                transition:'all 0.2s', fontFamily:F
              }} onMouseEnter={e=>{e.target.style.borderColor=C.orange; e.target.style.color=C.orange;}}
                 onMouseLeave={e=>{e.target.style.borderColor=C.border2; e.target.style.color=C.textSec;}}>
                "{c}"
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}



function ImportCocktailsModal({ onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [parseErr, setParseErr] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') { setRaw(text); doParse(text); }
    };
    reader.readAsText(file);
  };

  const doParse = (csv) => {
    const { ok, items, errors } = parseCocktailsCSV(csv);
    if (!ok) { setParseErr(errors[0] || 'Error al parsear CSV'); setParsed([]); setParseErrors([]); return; }
    setParsed(items);
    setParseErrors(errors);
    setParseErr('');
    setStep(2);
  };

  const handlePaste = () => {
    if (!raw.trim()) return;
    doParse(raw);
  };

  const removeItem = (idx) => {
    setParsed(p => p.filter((_, i) => i !== idx));
  };

  const changeTipo = (idx, tipo) => {
    setParsed(p => p.map((c, i) => i === idx ? {...c, tipo} : c));
  };

  const downloadTemplate = () => {
    const tpl = `nombre,tipo,precio,descripcion\nMargarita Clásica,clasico,12.00,Patrón · Cointreau · Lima\nMojito Premium,autor,10.50,Ron Diplomático · Menta · Lima\nNegroni Paradiso,clasico,13.00,Gin · Campari · Martini`;
    const blob = new Blob([tpl], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cocteles_template.csv';
    a.click();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <Card accent={C.orange} sx={{ padding:28, maxWidth:700, width:'90%', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>IMPORTAR CÓCTELES</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={18}/>
          </button>
        </div>

        {step === 1 && (
          <div>
            <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', marginBottom:12 }}>PASO 1: CARGAR CSV</div>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder="Pega tu CSV aquí (nombre,tipo,precio,descripcion)..."
              style={{ width:'100%', height:150, padding:'12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box', marginBottom:12, resize:'vertical' }}
            />
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <Btn onClick={() => fileRef.current?.click()} sx={{ flex:1, padding:'10px', fontSize:'14px' }}>
                📎 CARGAR ARCHIVO
              </Btn>
              <Btn onClick={downloadTemplate} variant="outline" sx={{ flex:1, padding:'10px', fontSize:'14px' }}>
                📥 DESCARGAR TEMPLATE
              </Btn>
            </div>
            {parseErr && <div style={{ padding:'10px', background:'#EF444422', border:`1px solid #EF444433`, borderRadius:3, fontSize:'14px', color:'#EF4444', marginBottom:12 }}>{parseErr}</div>}
            <Btn onClick={handlePaste} sx={{ width:'100%', padding:'11px', fontSize:'14px' }}>
              → VERIFICAR CSV
            </Btn>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', marginBottom:12 }}>PASO 2: REVISAR ({parsed.length} cócteles — importarán como BORRADORES)</div>

            {parseErrors.length > 0 && (
              <div style={{ padding:'10px', background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:3, fontSize:'13px', color:C.amber, marginBottom:12 }}>
                ⚠ {parseErrors.length} filas con errores (serán ignoradas)
              </div>
            )}
            <div style={{ maxHeight:350, overflowY:'auto', marginBottom:14 }}>
              {parsed.map((c, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, marginBottom:8, gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize:'13px', color:C.textSec, marginTop:2 }}>{c.description.substring(0,50)}</div>}
                    <div style={{ fontSize:'14px', color:C.orange, fontWeight:700, marginTop:3 }}>€{c.price.toFixed(2)}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select
                      value={c.tipo}
                      onChange={(e) => changeTipo(i, e.target.value)}
                      style={{
                        padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3,
                        fontFamily:F, fontSize:'14px', color:C.textSec, cursor:'pointer', minWidth:120,
                      }}
                    >
                      <option value="clasico">CLÁSICO</option>
                      <option value="autor">DE AUTOR</option>
                    </select>
                    <button onClick={() => removeItem(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', display:'flex', flexShrink:0 }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="outline" onClick={() => setStep(1)} sx={{ flex:1, padding:'11px', fontSize:'14px' }}>← ATRÁS</Btn>
              <Btn onClick={() => { onSave(parsed); onClose(); }} sx={{ flex:1, padding:'11px', fontSize:'14px' }}>✓ IMPORTAR {parsed.length}</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── CONSUMPTION MODAL ────────────────────────────────────────────────────────
function ConsumptionModal({ item, onClose, onSave }) {
  const [weekly, setWeekly] = useState(item.weekly || '3.5 L');

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, fontFamily:F }}>
      <Card accent={C.teal} sx={{ padding:28, maxWidth:400, width:'90%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:F, fontSize:'14px', color:C.teal, letterSpacing:'3px', fontWeight:700 }}>CONFIGURAR CONSUMO</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:'13px', color:C.text, fontWeight:700, marginBottom:4 }}>{item.name}</div>
          <div style={{ fontSize:'14px', color:C.textSec, marginBottom:12 }}>Stock actual: {item.stock}</div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'1px', marginBottom:8 }}>USO SEMANAL ESTIMADO</div>
          <input
            value={weekly}
            onChange={e=>setWeekly(e.target.value)}
            placeholder="Ej: 3.5 L, 5 bot, 50 ud"
            style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box', marginBottom:12 }}
          />
          <div style={{ fontSize:'13px', color:C.textSec, lineHeight:'1.5', padding:'8px 10px', background:C.tealBg, borderRadius:3, border:`1px solid ${C.teal}33` }}>
            💡 Ejemplos: "3.5 L" para líquidos, "5 bot" para botellas, "50 ud" para unidades
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="outline" onClick={onClose} sx={{ flex:1, padding:'10px' }}>CANCELAR</Btn>
          <Btn onClick={()=>{ onSave(weekly); onClose(); }} sx={{ flex:1, padding:'10px' }}>GUARDAR</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
function ImportModal({ onClose }) {
  const { addFromImport } = useApp();
  const [step, setStep]   = useState(1);
  const [raw, setRaw]     = useState('');
  const [parsed, setParsed] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [parseErr, setParseErr] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRaw(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  };

  const handleAnalyze = () => {
    if (!raw.trim()) { setParseErr('Pega el contenido del CSV o sube un archivo.'); return; }
    const result = parseCSV(raw);
    if (!result.ok) { setParseErr(result.error); return; }
    if (result.items.length === 0) { setParseErr('No se encontraron filas válidas. Revisa el formato.'); return; }
    setParseErr(''); setParsed(result.items); setParseErrors(result.errors); setStep(2);
  };

  const imageRef = useRef(null);

  const handleImageSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStep(0); // loading state
    setLoadingMsg(`Subiendo y analizando ${file.name} con IA (OCR)...`);
    setTimeout(() => setLoadingMsg('Extrayendo productos y unidades...'), 1500);
    setTimeout(() => setLoadingMsg('Conciliando con base de datos...'), 3000);
    
    setTimeout(() => {
      const mockParsed = [
        { id: 'ocr1', name: 'SANTA TERESA gran reserva', cat: 'Ron', stock: 12, unit: 'bot', cpu: 10.95 },
        { id: 'ocr2', name: 'DON JULIO 70 th.', cat: 'Tequila', stock: 6, unit: 'bot', cpu: 57.34 },
        { id: 'ocr3', name: 'TEQUILA SIETE LEGUAS BLANCO', cat: 'Tequila', stock: 3, unit: 'bot', cpu: 47.94 },
        { id: 'ocr4', name: 'MAESTRO DOBEL DIAMANTE', cat: 'Tequila', stock: 5, unit: 'bot', cpu: 247.00 },
        { id: 'ocr5', name: 'TEQUILA DON JULIO BLANCO', cat: 'Tequila', stock: 6, unit: 'bot', cpu: 36.99 },
        { id: 'ocr6', name: 'GREY GOOSE ORIGINAL', cat: 'Vodka', stock: 6, unit: 'bot', cpu: 35.46 },
        { id: 'ocr7', name: 'BEEFEATER 70CL', cat: 'Ginebra', stock: 18, unit: 'bot', cpu: 11.08 },
        { id: 'ocr8', name: 'JOHNNIE WALKER BLACK LABEL', cat: 'Whisky', stock: 18, unit: 'bot', cpu: 20.43 },
        { id: 'ocr9', name: 'SAINT GERMAIN 70CL', cat: 'Licor', stock: 2, unit: 'bot', cpu: 23.50 }
      ];
      setParsed(mockParsed);
      setStep(2);
    }, 4500);
  };

  const removeItem = (id) => setParsed(p => p.filter(x => x.id !== id));

  const [isImporting, setIsImporting] = useState(false);

  const handleConfirm = async () => {
    setIsImporting(true);
    setParseErr('');
    try {
      const res = await addFromImport(parsed);
      if (!res.success) throw new Error(res.error);
      onClose();
    } catch (err) {
      setParseErr(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='plantilla_almacen_barops.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center' };
  const modal   = { background:C.card, border:`1px solid ${C.border2}`, borderRadius:4, width:'min(760px,94vw)', maxHeight:'90vh', display:'flex', flexDirection:'column', fontFamily:F };

  return (
    <div style={overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:`1px solid ${C.border2}` }}>
          <div>
            <div style={{ fontSize:'13px', fontWeight:700, letterSpacing:'4px', color:C.text }}>IMPORTAR ALMACÉN</div>
            <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'1px', marginTop:3 }}>
              {step===1?'Pega tu CSV o sube el archivo de inventario':'Revisa los productos antes de confirmar'}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:'13px', color:step===1?C.orange:C.textSec, letterSpacing:'2px' }}>01 CARGAR</span>
            <span style={{ fontSize:'13px', color:C.border2 }}>──</span>
            <span style={{ fontSize:'13px', color:step===2?C.orange:C.textSec, letterSpacing:'2px' }}>02 CONFIRMAR</span>
            <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:C.textSec,display:'flex',marginLeft:8 }}><X size={16}/></button>
          </div>
        </div>

        {step===0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:20 }}>
            <div className="barops-spinner" style={{ width:50, height:50, border:`3px solid ${C.border2}`, borderTopColor:C.teal, borderRadius:'50%', animation:'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            <div style={{ color:C.teal, fontFamily:F, fontSize:'14px', letterSpacing:'2px' }}>{loadingMsg}</div>
          </div>
        )}

        {step===1 && (
          <div style={{ padding:'24px', overflowY:'auto' }}>
            {/* Template download */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:C.tealBg, border:`1px solid ${C.teal}33`, borderRadius:3, marginBottom:18 }}>
              <div>
                <div style={{ fontSize:'14px', color:C.teal, fontWeight:700, letterSpacing:'2px' }}>PLANTILLA CSV</div>
                <div style={{ fontSize:'14px', color:C.textSec, marginTop:2 }}>Columnas: nombre · categoria · stock · unidad · precio · volumen_cl</div>
              </div>
              <Btn variant="outline" onClick={downloadTemplate} sx={{ padding:'12px 20px', fontSize:'13px', borderColor:C.teal, color:C.teal }}>
                DESCARGAR
              </Btn>
            </div>

            {/* Format hint */}
            <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'1px', marginBottom:8 }}>
              UNIDADES ACEPTADAS: <span style={{ color:C.text }}>bot / l / cl / ud / kg</span>
              &nbsp;·&nbsp; Si usas <span style={{ color:C.text }}>bot</span>, añade columna <span style={{ color:C.text }}>volumen_cl</span> (ej: 70 para 70cl)
            </div>

            {/* Textarea */}
            <textarea
              value={raw}
              onChange={e=>setRaw(e.target.value)}
              placeholder={`Pega aquí el CSV. Ejemplo:\n\nnombre,categoria,stock,unidad,precio,volumen_cl\nGin Hendrick's,Ginebra,3,bot,15.20,70\nCampari,Amaro,2,bot,14.90,100\nLimones frescos,Fruta fresca,80,ud,0.12,`}
              style={{
                width:'100%', height:200, padding:'12px', background:C.cardAlt,
                border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F,
                fontSize:'14px', color:C.text, outline:'none', resize:'vertical',
                lineHeight:'1.6', boxSizing:'border-box',
              }}
            />

            {/* Or file input */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12 }}>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:'none' }}/>
              <Btn variant="ghost" onClick={()=>fileRef.current?.click()} sx={{ padding:'8px 16px', fontSize:'13px' }}>
                CARGAR ARCHIVO .CSV
              </Btn>
              <span style={{ fontSize:'14px', color:C.textSec }}>— o pega directamente en el área de texto</span>
            </div>

            {parseErr && (
              <div style={{ marginTop:12, padding:'10px 14px', background:C.redBg, border:`1px solid #EF444433`, borderRadius:3, fontSize:'14px', color:'#EF4444' }}>
                ⚠ {parseErr}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
              <input ref={imageRef} type="file" accept="image/*" onChange={handleImageSelected} style={{ display:'none' }}/>
              <Btn variant="teal" onClick={() => imageRef.current?.click()} sx={{ padding:'10px 24px', fontSize:'14px', letterSpacing:'1px', display:'flex', alignItems:'center', gap:8 }}>
                <Camera size={16}/> ESCANEAR ALBARÁN (IA)
              </Btn>
              <Btn onClick={handleAnalyze} sx={{ padding:'10px 28px', fontSize:'14px', letterSpacing:'2px' }}>
                ANALIZAR CSV →
              </Btn>
            </div>
          </div>
        )}

        {step===2 && (
          <div style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
            {parseErrors.length>0 && (
              <div style={{ padding:'10px 24px', background:C.amberBg, borderBottom:`1px solid ${C.amber}33`, fontSize:'14px', color:C.amber }}>
                ⚠ {parseErrors.length} fila(s) ignorada(s) por precio inválido
              </div>
            )}
            <div style={{ overflowY:'auto', flex:1, padding:'0 0 8px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:C.cardAlt, borderBottom:`1px solid ${C.border2}` }}>
                    {['NOMBRE','CATEGORÍA','STOCK','UNIDAD','€/UNIDAD','ACCIÓN'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'12px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item,i)=>(
                    <tr key={item.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'transparent':C.cardAlt }}>
                      <td style={{ padding:'10px 16px', fontSize:'14px', color:C.text, fontWeight:600 }}>{item.name}</td>
                      <td style={{ padding:'10px 16px', fontSize:'14px', color:C.textSec }}>{item.cat}</td>
                      <td style={{ padding:'10px 16px', fontSize:'14px', color:C.text }}>{item.stock}</td>
                      <td style={{ padding:'10px 16px', fontSize:'14px', color:C.textSec }}>{item.unit}</td>
                      <td style={{ padding:'10px 16px', fontSize:'14px', color:C.teal, fontWeight:700 }}>€{item.cpu.toFixed(4)}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <button onClick={()=>removeItem(item.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#EF4444',display:'flex',padding:'2px' }}>
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length===0&&(
                <div style={{ textAlign:'center', padding:'40px', fontSize:'14px', color:C.textSec }}>
                  Has eliminado todos los productos. Vuelve atrás para revisar.
                </div>
              )}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:`1px solid ${C.border2}` }}>
              <Btn variant="ghost" onClick={()=>setStep(1)} sx={{ padding:'9px 18px', fontSize:'13px' }}>← VOLVER</Btn>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize:'14px', color:C.textSec }}>{parsed.length} producto{parsed.length!==1?'s':''} listos para importar</span>
                <Btn disabled={parsed.length===0} onClick={handleConfirm} sx={{ padding:'10px 28px', fontSize:'14px', letterSpacing:'2px' }}>
                  CONFIRMAR E IMPORTAR
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INVENTARIO: LOCAL_ID ────────────────────────────────────────────────────
const INV_LOCAL_ID = '00000000-0000-0000-0000-000000000001';

// ─── INVENTARIO: ESTADO BADGE ────────────────────────────────────────────────
function EstadoBadge({ stock, minimo }) {
  const s = parseFloat(stock)||0, m = parseFloat(minimo)||0;
  if (m===0) return <Badge label="ESTABLE" color={C.teal} bg={C.tealBg}/>;
  if (s<=m) return <Badge label="CRITICO" color={C.red} bg={C.redBg}/>;
  if (s<=m*1.5) return <Badge label="PREVENTIVO" color={C.amber} bg={C.amberBg}/>;
  return <Badge label="ESTABLE" color={C.teal} bg={C.tealBg}/>;
}

// ─── INVENTARIO: BARRA DE STOCK ──────────────────────────────────────────────
function StockMiniBar({ stock, minimo }) {
  const s = parseFloat(stock)||0, m = parseFloat(minimo)||0;
  const max = m>0 ? m*3 : Math.max(s*1.5,1);
  const pct = Math.min(100, (s/max)*100);
  const color = m>0 ? (s<=m?C.red : s<=m*2?C.amber : C.teal) : C.teal;
  return (
    <div style={{ width:'100%', height:3, background:'#2a2a2a', borderRadius:2, marginTop:4, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2 }}/>
    </div>
  );
}

// ─── INVENTARIO: EDICION INLINE DE STOCK ─────────────────────────────────────
function InlineStock({ item, onSaved, setToast }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [hover, setHover]     = useState(false);
  const inputRef = useRef(null);

  const startEdit = () => {
    setVal(String(parseFloat(item.stock_actual)||0));
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 30);
  };

  const cancel = () => { setEditing(false); setHover(false); };

  const confirm = async () => {
    const newVal = parseFloat(val);
    if (isNaN(newVal)) { cancel(); return; }
    setSaving(true);
    try {
      const oldVal = parseFloat(item.stock_actual)||0;
      const diff   = newVal - oldVal;
      
      // Remove updated_at to avoid schema errors if column doesn't exist
      const { error } = await supabase
        .from('productos')
        .update({ stock_actual: newVal })
        .eq('id', item.id);
        
      if (error) throw error;

      await supabase.from('movimientos_stock').insert({
        producto_id: item.id,
        local_id:    INV_LOCAL_ID,
        tipo:        'ajuste',
        cantidad:    diff,
        motivo:      'Ajuste manual de stock',
        fecha:       new Date().toISOString().split('T')[0],
      });

      onSaved(item.id, newVal);
      setToast('Stock actualizado');
      setEditing(false);
    } catch(e) {
      setToast('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleKey = (e) => {
    if (e.key==='Enter') confirm();
    if (e.key==='Escape') cancel();
  };

  if (!editing) return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={startEdit}
      style={{ 
        cursor:'pointer', 
        display:'inline-flex', 
        flexDirection: 'column',
        gap: 2,
        position: 'relative',
        padding: '4px 8px',
        borderRadius: 4,
        background: hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
        <span style={{ fontFamily:F, fontSize:'16px', fontWeight:700, color:C.text }}>{parseFloat(item.stock_actual)||0}</span>
        <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>{item.unidad}</span>
      </div>
      <div style={{ 
        fontFamily:F, 
        fontSize:'12px', 
        color:C.orange, 
        letterSpacing:'1px', 
        fontWeight:700,
        opacity: hover ? 1 : 0,
        transform: hover ? 'translateY(0)' : 'translateY(2px)',
        transition: 'all 0.2s'
      }}>
        EDITAR
      </div>
    </div>
  );

  return (
    <div style={{ 
      display:'inline-flex', 
      flexDirection:'column', 
      gap:8,
      background: C.cardAlt,
      border: `1px solid ${C.orange}44`,
      borderRadius: 6,
      padding: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 10,
      minWidth: 120
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input
          ref={inputRef}
          type="number"
          value={val}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={handleKey}
          style={{
            width: '100%',
            background: '#111',
            border: `1px solid ${C.orange}88`,
            borderRadius: 3,
            outline:'none',
            fontFamily:F,
            fontSize:'14px',
            fontWeight:700,
            color:C.orange,
            padding:'6px 8px',
            textAlign: 'center'
          }}
        />
        <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec, fontWeight: 700 }}>{item.unidad}</span>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <button 
          onClick={confirm} 
          disabled={saving} 
          style={{ 
            flex: 1,
            background: C.teal, 
            border: 'none', 
            borderRadius: 3,
            cursor:'pointer', 
            color:'#000', 
            fontSize:'13px', 
            fontWeight:800,
            padding: '6px 0',
            letterSpacing: '1px'
          }}
        >
          {saving ? '...' : 'OK'}
        </button>
        <button 
          onClick={cancel} 
          style={{ 
            flex: 1,
            background: 'transparent', 
            border: `1px solid ${C.border2}`, 
            borderRadius: 3,
            cursor:'pointer', 
            color:C.textSec, 
            fontSize:'13px', 
            fontWeight:800,
            padding: '6px 0',
            letterSpacing: '1px'
          }}
        >
          ESC
        </button>
      </div>
    </div>
  );
}

// ─── INVENTARIO: DRAWER DE EDICION ───────────────────────────────────────────
function ProductDrawer({ item, isOpen, onClose, onSaved, setToast }) {
  const CATS = ['Destilados','Frutas y Frescos','Secos','Texturizantes','Mixers','Otros'];
  const UNITS = ['ud','bot','cl','ml','l','kg','g'];
  const [tab, setTab]   = useState('producto');
  const [form, setForm] = useState({});
  const [hist, setHist] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      nombre:             item.nombre||'',
      categoria:          item.categoria||'',
      unidad:             item.unidad||'ud',
      stock_actual:       String(parseFloat(item.stock_actual)||0),
      stock_minimo:       String(parseFloat(item.stock_minimo)||0),
      coste_unitario:     String(parseFloat(item.coste_unitario)||0),
      proveedor:          item.proveedor||'',
      telefono_proveedor: item.telefono_proveedor||'',
      notas:              item.notas||'',
      ultima_reposicion:  item.ultima_reposicion||'',
    });
    setTab('producto');
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item || tab!=='historial') return;
    (async () => {
      setLoadingHist(true);
      try {
        const { data } = await supabase.from('movimientos_stock')
          .select('*').eq('producto_id', item.id)
          .order('created_at', { ascending:false }).limit(20);
        setHist(data||[]);
      } catch(_) {}
      finally { setLoadingHist(false); }
    })();
  }, [isOpen, item, tab]);

  const fmtFecha = (d) => {
    if (!d) return '';
    const dt = new Date(d), now = new Date();
    const diff = Math.floor((now - dt) / 86400000);
    if (diff===0) return 'Hoy';
    if (diff===1) return 'Ayer';
    return dt.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'});
  };

  const tipoColor = { entrada:C.teal, salida:C.orange, ajuste:C.amber, merma:C.red };

  const handleSave = async () => {
    setSaving(true);
    try {
      const oldStock = parseFloat(item.stock_actual)||0;
      const newStock = parseFloat(form.stock_actual)||0;
      const payload  = {
        nombre:             form.nombre,
        categoria:          form.categoria,
        unidad:             form.unidad,
        stock_actual:       newStock,
        stock_minimo:       parseFloat(form.stock_minimo)||0,
        coste_unitario:     parseFloat(form.coste_unitario)||0,
        proveedor:          form.proveedor||null,
        telefono_proveedor: form.telefono_proveedor||null,
        notas:              form.notas||null,
        ultima_reposicion:  form.ultima_reposicion||null,
      };
      // updated_at omitido — puede no existir en el schema
      const { error } = await supabase.from('productos').update(payload).eq('id', item.id);
      if (error) throw error;
      if (newStock !== oldStock) {
        await supabase.from('movimientos_stock').insert({
          producto_id: item.id, local_id: INV_LOCAL_ID,
          tipo:'ajuste', cantidad: newStock-oldStock,
          motivo:'Edicion desde ficha de producto',
          fecha: new Date().toISOString().split('T')[0],
        });
      }
      onSaved(item.id, payload);
      setToast(`${form.nombre} guardado`);
      onClose();
    } catch(e) { setToast('Error: '+e.message); }
    finally { setSaving(false); }
  };

  if (!isOpen||!item) return null;
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const stockVal   = parseFloat(form.stock_actual)||0;
  const costVal    = parseFloat(form.coste_unitario)||0;
  const stockMin   = parseFloat(form.stock_minimo)||0;
  const valorTotal = (stockVal * costVal).toFixed(2);
  const estadoStr  = stockMin===0?'ESTABLE':stockVal<=stockMin?'CRITICO':stockVal<=stockMin*1.5?'PREVENTIVO':'ESTABLE';
  const estadoCol  = estadoStr==='CRITICO'?C.red:estadoStr==='PREVENTIVO'?C.amber:C.teal;

  const inputStyle = {
    width:'100%', padding:'8px 10px', fontFamily:F, fontSize:'14px',
    background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3,
    color:C.text, outline:'none',
  };
  const labelStyle = { display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1200 }}/>
      <div style={{
        position:'fixed', top:0, right:0, width:480, height:'100vh',
        background:C.card, borderLeft:`1px solid ${C.border2}`,
        zIndex:1201, display:'flex', flexDirection:'column', overflowY:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:F, fontSize:'16px', fontWeight:700, color:C.text }}>{form.nombre||item.nombre}</div>
            <div style={{ marginTop:4 }}><Badge label={form.categoria||'—'} color={C.orange} bg={C.orangeBg}/></div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}><X size={18}/></button>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border2}`, flexShrink:0 }}>
          {[['producto','PRODUCTO'],['historial','HISTORIAL']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1, padding:'12px', fontFamily:F, fontSize:'13px', letterSpacing:'2px', fontWeight:700,
              background:'none', border:'none', cursor:'pointer',
              color:tab===id?C.orange:C.textSec,
              borderBottom:tab===id?`2px solid ${C.orange}`:'2px solid transparent',
            }}>{label}</button>
          ))}
        </div>
        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {tab==='producto' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={labelStyle}>NOMBRE</label><input style={inputStyle} value={form.nombre} onChange={e=>f('nombre',e.target.value)}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>CATEGORIA</label>
                  <select style={inputStyle} value={form.categoria} onChange={e=>f('categoria',e.target.value)}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>UNIDAD</label>
                  <select style={inputStyle} value={form.unidad} onChange={e=>f('unidad',e.target.value)}>
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>STOCK ACTUAL</label>
                  <input type="number" style={inputStyle} value={form.stock_actual} onChange={e=>f('stock_actual',e.target.value)}/>
                </div>
                <div>
                  <label style={labelStyle}>STOCK MINIMO</label>
                  <input type="number" style={inputStyle} value={form.stock_minimo} onChange={e=>f('stock_minimo',e.target.value)}/>
                  <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, marginTop:3 }}>Alerta cuando baje de este nivel</div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>COSTE UNITARIO (€)</label>
                <input type="number" style={inputStyle} value={form.coste_unitario} onChange={e=>f('coste_unitario',e.target.value)}/>
                <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, marginTop:3 }}>Coste por {form.unidad} de este producto</div>
              </div>
              <div>
                <label style={labelStyle}>PROVEEDOR</label>
                <input style={inputStyle} value={form.proveedor} onChange={e=>f('proveedor',e.target.value)} placeholder="Nombre del proveedor principal"/>
              </div>
              <div>
                <label style={labelStyle}>TELEFONO PROVEEDOR</label>
                <input style={inputStyle} value={form.telefono_proveedor} onChange={e=>f('telefono_proveedor',e.target.value)} placeholder="+34 600 000 000"/>
              </div>
              <div>
                <label style={labelStyle}>ULTIMA REPOSICION</label>
                <input type="date" style={inputStyle} value={form.ultima_reposicion} onChange={e=>f('ultima_reposicion',e.target.value)}/>
              </div>
              <div>
                <label style={labelStyle}>NOTAS</label>
                <textarea rows={3} style={{...inputStyle, resize:'vertical'}} value={form.notas} onChange={e=>f('notas',e.target.value)} placeholder="Notas internas, marca preferida, alternativas..."/>
              </div>
              {/* Resumen */}
              <div style={{ background:'#1A1A1A', border:`1px solid ${C.border}`, borderRadius:4, padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec }}>Valor en inventario</span>
                  <span style={{ fontFamily:F, fontSize:'13px', fontWeight:700, color:C.teal }}>€{valorTotal}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec }}>Estado</span>
                  <span style={{ fontFamily:F, fontSize:'14px', fontWeight:700, color:estadoCol }}>{estadoStr}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {loadingHist ? (
                <div style={{ textAlign:'center', padding:32, fontFamily:F, fontSize:'14px', color:C.textSec }}>Cargando historial...</div>
              ) : hist.length===0 ? (
                <div style={{ textAlign:'center', padding:32 }}>
                  <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec }}>Sin movimientos registrados todavia</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {hist.map(m=>(
                    <div key={m.id} style={{ padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ minWidth:60, fontFamily:F, fontSize:'13px', color:C.textSec }}>{fmtFecha(m.fecha||m.created_at)}</div>
                      <Badge label={(m.tipo||'ajuste').toUpperCase()} color={tipoColor[m.tipo]||C.amber} bg={(tipoColor[m.tipo]||C.amber)+'18'}/>
                      <span style={{ fontFamily:F, fontSize:'13px', fontWeight:700, color:(m.cantidad||0)>=0?C.teal:C.red }}>
                        {(m.cantidad||0)>=0?'+':''}{m.cantidad||0}
                      </span>
                      <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec, flex:1 }}>{m.motivo||''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Footer save */}
        <div style={{ padding:'16px 24px', borderTop:`1px solid ${C.border2}`, flexShrink:0 }}>
          <Btn onClick={handleSave} disabled={saving} sx={{ width:'100%', justifyContent:'center', padding:'13px', fontSize:'14px', letterSpacing:'2px' }}>
            {saving?'GUARDANDO...':'GUARDAR CAMBIOS'}
          </Btn>
        </div>
      </div>
    </>
  );
}

// ─── SCREEN 2: INVENTARIO ─────────────────────────────────────────────────────
function Inventario() {
  const { inventoryLoading = false, cartItems, setCartItems, setShowCartDrawer, userRole } = useApp() || {};
  const [items, setItems]         = useState([]);   // raw DB rows
  const [loading, setLoading]     = useState(true);
  const [riskFilter, setRiskFilter]   = useState('all');
  const [categoryTab, setCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast]         = useState(null);
  const [showImport, setShowImport]   = useState(false);
  const [drawerItem, setDrawerItem]   = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const CATEGORY_TABS = [
    { id:'all', label:'TODOS' },
    { id:'destilados', label:'DESTILADOS' },
    { id:'frutas', label:'FRUTAS Y FRESCOS' },
    { id:'secos', label:'SECOS' },
    { id:'texturizantes', label:'TEXTURIZANTES' },
    { id:'mixers', label:'MIXERS' },
    { id:'otros', label:'OTROS' },
  ];
  const RISK_FILTERS = [
    { id:'all', label:'TODOS' },
    { id:'critical', label:'CRITICO' },
    { id:'preventivo', label:'PREVENTIVO' },
    { id:'stable', label:'ESTABLE' },
  ];

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('productos').select('*').eq('local_id', INV_LOCAL_ID).order('nombre');
      if (error) throw error;
      setItems(data || []);
    } catch(e) { setToast('Error cargando inventario: '+e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  // stats
  const totalRefs   = items.length;
  const criticos    = items.filter(p => parseFloat(p.stock_actual||0) <= parseFloat(p.stock_minimo||0) && parseFloat(p.stock_minimo||0)>0).length;
  const valorTotal  = items.reduce((s,p) => s + (parseFloat(p.stock_actual||0)*parseFloat(p.coste_unitario||0)), 0);

  const getCatGroup = (cat) => {
    if (!cat) return 'otros';
    const l = cat.toLowerCase();
    if (['ginebra','vodka','ron','whisky','tequila','mezcal','brandy','cognac','destilado','licor','vermut','amaro','bitter','aperitivo','espumoso','vino','cava','champagne','cerveza'].some(w=>l.includes(w))) return 'destilados';
    if (['fruta','fresco','fresca','zumo','jugo','citrico','hierba','flor','vegetal'].some(w=>l.includes(w))) return 'frutas';
    if (['seco','fruto seco','deshidratado','especia','semilla','polvo'].some(w=>l.includes(w))) return 'secos';
    if (['texturizante','gelificante','emulsionante','agar','lecitina','xantana'].some(w=>l.includes(w))) return 'texturizantes';
    if (['mixer','tonica','soda','ginger','agua','refresco','sirope','jarabe','azucar'].some(w=>l.includes(w))) return 'mixers';
    return 'otros';
  };

  const getEstado = (p) => {
    const s = parseFloat(p.stock_actual||0), m = parseFloat(p.stock_minimo||0);
    if (m===0) return 'stable';
    if (s<=m)   return 'critical';
    if (s<=m*1.5) return 'preventivo';
    return 'stable';
  };

  const fmtDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    const diff = Math.floor((Date.now()-dt)/86400000);
    if (diff>30) return { text: dt.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}), warn:true };
    return { text: dt.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}), warn:false };
  };

  let visible = items;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    visible = visible.filter(i => (i.nombre||'').toLowerCase().includes(q) || (i.categoria||'').toLowerCase().includes(q));
  } else if (categoryTab !== 'all') {
    visible = visible.filter(i => getCatGroup(i.categoria) === categoryTab);
  }
  if (riskFilter !== 'all') {
    visible = visible.filter(i => getEstado(i) === riskFilter);
  }

  // Update single item stock in local state
  const handleStockSaved = (id, newStock) => {
    setItems(prev => prev.map(p => p.id===id ? {...p, stock_actual:newStock} : p));
  };

  // Update full item after drawer save
  const handleDrawerSaved = (id, payload) => {
    setItems(prev => prev.map(p => p.id===id ? {...p, ...payload} : p));
  };

  const handlePedir = (p) => {
    if (setCartItems) {
      setCartItems(prev => {
        const ex = prev.find(i => i.id === p.id);
        if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { ...p, qty: 1 }];
      });
      setToast('Añadido al carrito');
    }
  };

  const handleGenerarPedidoCompleto = () => {
    if (!setCartItems) return;
    
    // DEMO: Populate the cart with the AI Recommended Mock items
    const mockToOrder = [
      { id: 'mock1', nombre: 'Aperol', categoria: 'Aperitivo', qty: 6, unidad: 'botellas' },
      { id: 'mock2', nombre: 'Campari', categoria: 'Aperitivo', qty: 4, unidad: 'botellas' },
      { id: 'mock3', nombre: "Gin Hendrick's", categoria: 'Ginebra', qty: 3, unidad: 'botellas' },
      { id: 'mock4', nombre: 'Limones frescos', categoria: 'Frutas', qty: 3, unidad: 'kg' },
      { id: 'mock5', nombre: 'Vermut Martini', categoria: 'Vermut', qty: 2, unidad: 'botellas' }
    ];

    setCartItems(prev => {
      let newCart = [...prev];
      mockToOrder.forEach(p => {
        const ex = newCart.find(i => i.id === p.id);
        if (ex) {
          ex.qty += p.qty;
        } else {
          newCart.push({ ...p });
        }
      });
      return newCart;
    });
    
    setToast('Recomendación IA añadida al carrito.');
    if (setShowCartDrawer) setTimeout(() => setShowCartDrawer(true), 600);
  };

  if (loading || inventoryLoading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
      <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO INVENTARIO...</div>
    </div>
  );

  if (items.length === 0) return (
    <div style={{ flex:1, padding:'28px 32px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:F }}>
      {showImport && <ImportModal onClose={()=>setShowImport(false)}/>}
      <Package size={48} color={C.textSec} style={{ marginBottom:16 }}/>
      <h2 style={{ color:C.text, fontSize:'20px', letterSpacing:'2px', marginBottom:8 }}>INVENTARIO VACIO</h2>
      <p style={{ color:C.textSec, fontSize:'13px', marginBottom:24 }}>No hay productos registrados en la base de datos.</p>
      <Btn onClick={()=>setShowImport(true)} sx={{ padding:'12px 24px', fontSize:'14px', letterSpacing:'2px' }}>IMPORTAR INVENTARIO INICIAL</Btn>
    </div>
  );

  const TH = { padding:'10px 14px', textAlign:'left', fontSize:'12px', color:C.textSec, letterSpacing:'2px', fontWeight:700, fontFamily:F, whiteSpace:'nowrap' };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobile?'16px 12px':'24px 28px',
      fontFamily: F,
      overflow: 'hidden',
      background: C.bg
    }}>
      {toast    && <Toast msg={toast} onClose={()=>setToast(null)}/>}
      {showImport && <ImportModal onClose={()=>setShowImport(false)}/>}
      <ProductDrawer item={drawerItem} isOpen={!!drawerItem} onClose={()=>setDrawerItem(null)} onSaved={handleDrawerSaved} setToast={setToast}/>

      {/* Header (Always Fixed) */}
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <div style={{ display:'flex', flexDirection:isMobile?'column':'row', justifyContent:'space-between', alignItems:isMobile?'flex-start':'flex-start', gap:isMobile?12:0 }}>
          <div>
            <h1 style={{ fontFamily:F, fontSize:isMobile?'16px':'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>INVENTARIO INTELIGENTE</h1>
            <p style={{ fontFamily:F, fontSize:isMobile?'10px':'11px', color:C.textSec, margin:'6px 0 0', display:'flex', flexWrap:'wrap', alignItems:'center', gap:isMobile?6:10 }}>
              <span>{totalRefs} referencias</span>
              <span style={{ color:criticos>0?C.red:C.textSec, fontWeight:criticos>0?700:400 }}>· {criticos} criticos</span>
              <span>· €{valorTotal.toFixed(0)} en stock</span>
            </p>
          </div>
          {userRole === 'manager' && (
            <Btn variant="outline" onClick={()=>setShowImport(true)} sx={{ padding:'9px 18px', fontSize:'13px', letterSpacing:'2px', width:isMobile?'100%':'auto', marginRight: (!isMobile && cartItems && cartItems.length > 0) ? '130px' : '0', transition: 'all 0.2s ease' }}>
              IMPORTAR ALMACÉN
            </Btn>
          )}
        </div>
      </div>

      {/* Sections & Filters (Fixed) */}
      <div style={{ flexShrink: 0 }}>
        {/* Row 1: Categories */}
        <div style={{ display:'flex', flexWrap:isMobile?'wrap':'nowrap', gap:6, overflowX:isMobile?'visible':'auto', paddingBottom:8, marginBottom: 8, scrollbarWidth: 'none' }}>
          {CATEGORY_TABS.map(t=>(
            <button key={t.id} onClick={()=>setCategoryTab(t.id)} style={{
              padding:isMobile?'4px 10px':'6px 16px', borderRadius:2, fontFamily:F, fontSize:isMobile?'8px':'9px', letterSpacing:'2px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              background:categoryTab===t.id?C.orange:C.cardAlt, color:categoryTab===t.id?'#000':C.textSec,
              border:categoryTab===t.id?`1px solid ${C.orange}`:`1px solid ${C.border2}`,
              transition: 'all 0.2s', flex:isMobile?1:'initial'
            }}>{t.label}</button>
          ))}
        </div>

        {/* Row 2: Risk Filters */}
        <div style={{ display:'flex', flexWrap:isMobile?'wrap':'nowrap', gap:6, marginBottom: 16 }}>
          {RISK_FILTERS.map(f=>(
            <button key={f.id} onClick={()=>setRiskFilter(f.id)} style={{
              padding:isMobile?'4px 10px':'6px 16px', borderRadius:2, fontFamily:F, fontSize:isMobile?'8px':'9px', letterSpacing:'2px', fontWeight:700, cursor:'pointer',
              background:riskFilter===f.id?C.orange:C.cardAlt, color:riskFilter===f.id?'#000':C.textSec,
              border:riskFilter===f.id?`1px solid ${C.orange}`:`1px solid ${C.border2}`,
              transition: 'all 0.2s', flex:isMobile?1:'initial'
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Smart Search Bar - Positioned exactly above the window */}
      <div style={{ flexShrink: 0, marginBottom: 12 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={14} color={C.textSec} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
          <input
            type="text"
            placeholder={categoryTab === 'all' ? "Buscar producto..." : `Buscar en ${CATEGORY_TABS.find(t=>t.id===categoryTab)?.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={e=>setSearchQuery(e.target.value)}
            style={{
              width:'100%',
              padding:isMobile?'14px 14px 14px 40px':'12px 14px 12px 40px',
              borderRadius:4,
              fontFamily:F,
              fontSize:isMobile?'14px':'13px',
              background:C.cardAlt,
              border: searchQuery ? `1px solid ${C.orange}` : `1px solid ${C.border2}`,
              color:C.text,
              outline:'none',
              transition: 'all 0.2s'
            }}
            onFocus={e=>{
              e.target.style.borderColor=C.orange;
              e.target.style.background='#161616';
            }}
            onBlur={e=>{
              if(!searchQuery) e.target.style.borderColor=C.border2;
              e.target.style.background=C.cardAlt;
            }}
          />
        </div>
      </div>

      {/* FIXED WINDOW: Internal Scroll Product List */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: isMobile?'transparent':C.card,
        border: isMobile?'none':`1px solid ${C.border2}`,
        borderRadius: 4,
        marginBottom: 20
      }}>
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {visible.length===0 ? (
            <div style={{ padding: 40, textAlign:'center', color: C.textSec }}>
              Sin resultados para "{searchQuery}"
            </div>
          ) : !isMobile ? (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:780 }}>
                <thead>
                  <tr style={{ background:'#0D0D0D', position:'sticky', top:0, zIndex:10, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{...TH, width:'28%'}}>PRODUCTO</th>
                    <th style={{...TH, width:'14%'}}>STOCK</th>
                    <th style={{...TH, width:'11%'}}>ESTADO</th>
                    <th style={{...TH, width:'9%'}}>MINIMO</th>
                    <th style={{...TH, width:'11%'}}>COSTE</th>
                    <th style={{...TH, width:'11%'}}>ULT. REPOSICION</th>
                    <th style={{...TH, width:'16%'}}>ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p,i) => {
                    const estado   = getEstado(p);
                    const repDate  = fmtDate(p.ultima_reposicion);
                    const valStock = (parseFloat(p.stock_actual||0)*parseFloat(p.coste_unitario||0)).toFixed(2);
                    const esCrit   = estado==='critical' || estado==='preventivo';
                    return (
                      <tr key={p.id} style={{ borderBottom:`1px solid #1A1A1A`, background:i%2===0?'transparent':'#0D0D0D0A', minHeight:64 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='#161616';}}
                        onMouseLeave={e=>{e.currentTarget.style.background=i%2===0?'transparent':'#0D0D0D0A';}}>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <div style={{ fontFamily:F, fontSize:'13px', fontWeight:700, color:C.text }}>{p.nombre}</div>
                          <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, marginTop:2 }}>{p.categoria||'—'}</div>
                          {p.proveedor && (
                            <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:'12px' }}>▲</span>{p.proveedor}
                            </div>
                          )}
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <InlineStock item={p} onSaved={handleStockSaved} setToast={setToast}/>
                          <StockMiniBar stock={p.stock_actual} minimo={p.stock_minimo}/>
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <EstadoBadge stock={p.stock_actual} minimo={p.stock_minimo}/>
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:2 }}>MIN</div>
                          <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec }}>{parseFloat(p.stock_minimo)||0} {p.unidad}</div>
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <div style={{ fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700 }}>€{parseFloat(p.coste_unitario||0).toFixed(2)}</div>
                          <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, marginTop:2 }}>€{valStock} total</div>
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          {repDate ? (
                            <div style={{ fontFamily:F, fontSize:'14px', color:repDate.warn?C.amber:C.textSec }}>{repDate.text}</div>
                          ) : (
                            <div style={{ fontFamily:F, fontSize:'14px', color:'#444' }}>Sin datos</div>
                          )}
                        </td>

                        <td style={{ padding:'14px 14px', verticalAlign:'middle' }}>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                            {esCrit && (
                              <button onClick={()=>handlePedir(p)} style={{
                                fontFamily:F, fontSize:'12px', letterSpacing:'1.5px', fontWeight:700,
                                padding:'8px 16px', borderRadius:2, cursor:'pointer',
                                background:C.orange, color:'#000', border:'none',
                              }}>PEDIR</button>
                            )}
                            <Btn variant="ghost" onClick={()=>setDrawerItem(p)} sx={{ padding:'8px 16px', fontSize:'12px' }}>
                              EDITAR
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, padding:12 }}>
              {visible.map(p => {
                const estado   = getEstado(p);
                const repDate  = fmtDate(p.ultima_reposicion);
                const valStock = (parseFloat(p.stock_actual||0)*parseFloat(p.coste_unitario||0)).toFixed(2);
                const esCrit   = estado==='critical' || estado==='preventivo';
                return (
                  <Card key={p.id} sx={{ padding:16, background:esCrit?'#FF6B3506':'#0D0D0D0A', border:esCrit?`1px solid ${C.orange}33`:`1px solid ${C.border2}` }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{p.nombre}</div>
                        <div style={{ fontSize:'13px', color:C.textSec, marginTop:3 }}>{p.categoria||'—'}</div>
                        {p.proveedor && <div style={{ fontSize:'12px', color:C.textSec, marginTop:2 }}>▲ {p.proveedor}</div>}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <div>
                          <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>STOCK</div>
                          <InlineStock item={p} onSaved={handleStockSaved} setToast={setToast}/>
                          <StockMiniBar stock={p.stock_actual} minimo={p.stock_minimo}/>
                        </div>
                        <div>
                          <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>ESTADO</div>
                          <EstadoBadge stock={p.stock_actual} minimo={p.stock_minimo}/>
                        </div>
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <div>
                          <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>MINIMO</div>
                          <div style={{ fontSize:'14px', color:C.textSec }}>{parseFloat(p.stock_minimo)||0} {p.unidad}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>COSTE UNITARIO</div>
                          <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>€{parseFloat(p.coste_unitario||0).toFixed(2)}</div>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>VALOR EN STOCK</div>
                        <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>€{valStock}</div>
                      </div>

                      {repDate && (
                        <div>
                          <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:4 }}>ÚLTIMA REPOSICIÓN</div>
                          <div style={{ fontSize:'14px', color:repDate.warn?C.amber:C.textSec }}>{repDate.text}</div>
                        </div>
                      )}

                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        {esCrit && (
                          <button onClick={()=>handlePedir(p)} style={{
                            flex:1, fontFamily:F, fontSize:'13px', letterSpacing:'1.5px', fontWeight:700,
                            padding:'10px', borderRadius:4, cursor:'pointer',
                            background:C.orange, color:'#000', border:'none'
                          }}>PEDIR</button>
                        )}
                        <Btn variant="ghost" onClick={()=>setDrawerItem(p)} sx={{ flex:1, padding:'10px', fontSize:'13px' }}>
                          EDITAR
                        </Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Cards (Fixed at bottom) */}
      {!isMobile && <div style={{ flexShrink: 0, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <Card accent={C.purple} sx={{ padding:20 }}>
          <SLabel label="PREDICCION ESTE FIN DE SEMANA" color={C.purple} icon={Zap}/>
          {[["Gin Tonic Hendrick's","~52 uds"],["Aperol Spritz","~48 uds"],["Negroni","~38 uds"],["Mojito","~35 uds"],["Old Fashioned","~22 uds"]].map(([n,u],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:'14px' }}>
              <span style={{ color:C.textSec }}>#{i+1} {n}</span>
              <span style={{ color:C.purple, fontWeight:700 }}>{u}</span>
            </div>
          ))}
        </Card>
        <Card accent={C.amber} sx={{ padding:20 }}>
          <SLabel label="COSTE TEORICO VS REAL" color={C.amber} icon={TrendingUp}/>
          {[['Coste teorico ventas','€4.280',C.textSec],['Coste real registrado','€4.990',C.amber],['Diferencia (merma)','+€710',C.red],['Porcentaje de merma','14.2%',C.red],['Objetivo BarOps','< 8%',C.teal]].map(([l,v,co],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:'14px' }}>
              <span style={{ color:C.textSec }}>{l}</span><span style={{ color:co, fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card accent={C.teal} sx={{ padding:20 }}>
          <SLabel label="PEDIDO RECOMENDADO IA" color={C.teal} icon={ShoppingCart}/>
          {[["Aperol","6 botellas","HOY",C.red],["Campari","4 botellas","HOY",C.red],["Gin Hendrick's","3 botellas","MANANA",C.amber],["Limones frescos","3 kg","MANANA",C.amber],["Vermut Martini","2 botellas","ESTA SEM.",C.teal]].map(([n,q,u,co],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${C.border}`, fontSize:'14px' }}>
              <span style={{ color:C.text }}>{n}</span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ color:C.textSec, fontSize:'14px' }}>{q}</span>
                <span style={{ color:co, fontWeight:700, fontSize:'12px', letterSpacing:'1px' }}>{u}</span>
              </div>
            </div>
          ))}
          {userRole === 'manager' && <Btn variant="teal" onClick={handleGenerarPedidoCompleto} sx={{ width:'100%', marginTop:14, justifyContent:'center', padding:'9px', letterSpacing:'2px', fontSize:'13px' }}>GENERAR PEDIDO COMPLETO</Btn>}
        </Card>
      </div>}
    </div>
  );
}


// ─── SCREEN 3: STAFFING REDISEÑADO ────────────────────────────────────────────
function Staffing() {
  const [toast, setToast]       = useState(null);
  const [covOpen, setCovOpen]   = useState(false);
  const [availFilter, setAF]    = useState('all');
  const [assigned, setAssigned] = useState({});

  const totalCostWeek = [...OPEN_SHIFTS,...COVERED_SHIFTS]
    .reduce((a,s)=>a+parseInt(s.cost.replace('€','')),0);
  const openPending = OPEN_SHIFTS.filter(s=>!assigned[s.id]);
  const filteredTalent = availFilter==='all' ? TALENT : TALENT.filter(t=>t.avail===availFilter);

  const doAssign = (shiftId, name) => {
    setAssigned(p=>({...p,[shiftId]:name}));
    setToast(`${name} asignado correctamente`);
  };

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>STAFFING</h1>
          <p style={{ fontFamily:F, fontSize:'14px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            Semana 28 Abr – 3 May · {openPending.length} turno{openPending.length!==1?'s':''} sin cubrir
          </p>
        </div>
        <Btn onClick={()=>setToast('Formulario de turno urgente abierto')} sx={{ padding:'10px 20px', fontSize:'14px' }}>
          <Plus size={14}/> PUBLICAR TURNO URGENTE
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
        {[
          { label:'TURNOS SEMANA',   value:`${COVERED_SHIFTS.length+Object.keys(assigned).length}/${COVERED_SHIFTS.length+OPEN_SHIFTS.length}`, color:C.teal   },
          { label:'COSTE EST. SEMANA',value:`€${totalCostWeek}`,                                                                                  color:C.orange },
          { label:'SIN CUBRIR',      value:String(openPending.length),                                                                            color:'#EF4444'},
          { label:'URGENTES',        value:String(openPending.filter(s=>s.status==='urgent').length),                                             color:'#EF4444'},
        ].map(({ label,value,color },i)=>(
          <Card key={i} accent={color} sx={{ padding:'14px 18px', background:`${color}0D` }}>
            <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'26px', color, fontWeight:700, letterSpacing:'1px', lineHeight:1 }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'58% 1fr', gap:16 }}>

        {/* LEFT — Open shifts + matching */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={13} color='#EF4444'/>
            <span style={{ fontFamily:F, fontSize:'14px', color:'#EF4444', letterSpacing:'3px', fontWeight:700 }}>NECESITAN COBERTURA</span>
          </div>

          {OPEN_SHIFTS.map(shift=>{
            const isAssigned = !!assigned[shift.id];
            const matchedTalent = TALENT.filter(t=>shift.match.includes(t.name));
            const borderColor = isAssigned?C.teal:shift.status==='urgent'?'#EF4444':C.amber;
            return (
              <Card key={shift.id} accent={borderColor} sx={{ overflow:'hidden' }}>
                {/* header */}
                <div style={{
                  padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center',
                  background: isAssigned?C.tealBg:shift.status==='urgent'?'#EF444410':C.amberBg,
                  borderBottom:`1px solid ${borderColor}33`,
                }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{shift.profile}</span>
                      {isAssigned
                        ? <Badge label="CUBIERTO" color={C.teal} bg={C.tealBg}/>
                        : <ShiftBadge status={shift.status}/>
                      }
                    </div>
                    <div style={{ display:'flex', gap:16 }}>
                      <span style={{ fontSize:'14px', color:C.textSec }}>{shift.date}</span>
                      <span style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{shift.time}</span>
                      <span style={{ fontSize:'14px', color:C.orange, fontWeight:700 }}>{shift.cost}</span>
                    </div>
                  </div>
                  {isAssigned&&(
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'14px', color:C.teal }}>→ {assigned[shift.id]}</div>
                      <button onClick={()=>setAssigned(p=>{const n={...p};delete n[shift.id];return n;})}
                        style={{ background:'none',border:'none',color:C.textSec,fontFamily:F,fontSize:'13px',cursor:'pointer',marginTop:2,letterSpacing:'0.5px' }}>
                        desasignar
                      </button>
                    </div>
                  )}
                </div>
                {/* suggestions */}
                {!isAssigned&&(
                  <div style={{ padding:'12px 16px' }}>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>SUGERENCIAS DE COBERTURA</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {matchedTalent.map(p=>(
                        <div key={p.id} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'9px 12px', background:C.cardAlt,
                          border:`1px solid ${p.avail==='today'?C.teal+'33':C.border}`, borderRadius:3,
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <Avatar ini={p.ini} size={32}/>
                            <div>
                              <div style={{ fontSize:'13px', color:C.text, fontWeight:700 }}>{p.name}</div>
                              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
                                <span style={{ fontSize:'13px', color:C.textSec }}>{p.spec}</span>
                                <Stars rating={p.rating}/>
                              </div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <AvailBadge avail={p.avail}/>
                            <span style={{ fontSize:'14px', color:C.orange, fontWeight:700 }}>{p.rate}</span>
                            <Btn variant="teal" sx={{ padding:'10px 18px', fontSize:'12px' }} onClick={()=>doAssign(shift.id,p.name)}>
                              <UserCheck size={11}/> ASIGNAR
                            </Btn>
                          </div>
                        </div>
                      ))}
                      {matchedTalent.length===0&&(
                        <div style={{ fontSize:'14px', color:C.textSec, padding:'8px 0' }}>Sin coincidencias — amplía la búsqueda</div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Collapsible covered */}
          <button onClick={()=>setCovOpen(p=>!p)} style={{
            display:'flex', alignItems:'center', gap:8, background:'none',
            border:`1px solid ${C.border2}`, borderRadius:3, padding:'10px 14px',
            cursor:'pointer', width:'100%', fontFamily:F, color:C.textSec, fontSize:'14px', letterSpacing:'2px',
          }}>
            {covOpen?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
            TURNOS CUBIERTOS ESTA SEMANA ({COVERED_SHIFTS.length})
            <span style={{ marginLeft:'auto', color:C.teal, fontSize:'14px', fontWeight:700 }}>
              €{COVERED_SHIFTS.reduce((a,s)=>a+parseInt(s.cost.replace('€','')),0)}
            </span>
          </button>
          {covOpen&&(
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {COVERED_SHIFTS.map(s=>(
                <Card key={s.id} sx={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:'14px', color:C.textSec, marginBottom:2 }}>{s.date} · {s.time}</div>
                    <div style={{ fontSize:'13px', color:C.text, fontWeight:700 }}>{s.profile}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'14px', color:C.teal, fontWeight:700 }}>→ {s.pro}</div>
                      <Stars rating={s.rating}/>
                    </div>
                    <span style={{ fontSize:'14px', color:C.textSec }}>{s.cost}</span>
                    <Badge label="CUBIERTO" color={C.teal} bg={C.tealBg}/>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Talent directory */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Users size={13} color={C.teal}/>
            <span style={{ fontFamily:F, fontSize:'14px', color:C.teal, letterSpacing:'3px', fontWeight:700 }}>RED DE TALENTO</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['all','TODOS'],['today','HOY'],['weekend','FINDE']].map(([id,label])=>(
              <button key={id} onClick={()=>setAF(id)} style={{
                flex:1, padding:'6px 4px', fontFamily:F, fontSize:'12px', letterSpacing:'1.5px', fontWeight:700,
                cursor:'pointer', borderRadius:2,
                background:availFilter===id?C.teal:C.cardAlt,
                color:availFilter===id?'#000':C.textSec,
                border:availFilter===id?`1px solid ${C.teal}`:`1px solid ${C.border2}`,
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filteredTalent.map(p=>(
              <Card key={p.id} accent={p.avail==='today'?C.teal:undefined} sx={{ padding:'14px' }}>
                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <Avatar ini={p.ini} size={38}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'13px', color:C.text, fontWeight:700 }}>{p.name}</div>
                    <div style={{ fontSize:'13px', color:C.textSec, margin:'2px 0 4px' }}>{p.spec}</div>
                    <Stars rating={p.rating}/>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'15px', color:C.orange, fontWeight:700 }}>{p.rate}</div>
                    <AvailBadge avail={p.avail}/>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {(p.tags||[]).map(t=>(
                      <span key={t} style={{ padding:'2px 6px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:2, fontFamily:F, fontSize:'12px', color:C.textSec }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <Btn disabled={p.avail==='unavailable'} onClick={()=>setToast(`Solicitud enviada a ${p.name}`)} sx={{ marginLeft:8, flexShrink:0, padding:'5px 10px', fontSize:'12px' }}>
                    CONTRATAR
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 4: AGENTE IA — CONECTADO A CLAUDE ─────────────────────────────────
function AgenteIA() {
  const { customInv, localName } = useApp() || { customInv: [], localName: 'Mi Local' };
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [messages, setMessages] = useState(INITIAL_CHAT);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [apiErr, setApiErr]     = useState(null);
  const bottomRef               = useRef(null);

  const CHIPS = [
    '¿Cuál fue el producto más vendido ayer?',
    '¿Qué licores se me van a agotar este fin de semana?',
    '¿Cuál es mi cóctel más rentable?',
    '¿Qué bartender me recomiendas para el sábado?',
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:'smooth' }); },[messages, loading]);

  const buildSystemPrompt = () => {
    let inventoryText = 'No hay inventario registrado.';
    if (customInv && customInv.length > 0) {
      inventoryText = customInv.map(item => {
        const riskIndicator = item.risk === 'critical' ? '🔴 CRÍTICO' : item.risk === 'medium' ? '🟡 MEDIO' : '🟢 ESTABLE';
        return `- ${item.name}: ${item.stock} → ${item.days} días restantes ${riskIndicator} (Coste: ${item.cost})`;
      }).join('\n');
    }

    return `Eres el Agente BarOps de ${localName}. Eres un analista de negocio experto en hostelería.
Tienes acceso en tiempo real a los datos del local. Respondes siempre en español, de forma directa y con datos concretos.
Cuando calcules costes, usa los precios de proveedor exactos. Usa emojis con moderación solo cuando aporten claridad.
Termina siempre con una recomendación accionable en 1 línea.

== INVENTARIO ACTUAL (DATOS REALES DE BASE DE DATOS) ==
${inventoryText}

== VENTAS DE AYER Y PREVISIONES (SIMULADAS) ==
- Producto más vendido ayer: Gin Tonic (Hendrick's) con 45 unidades.
- Previsión para este fin de semana: Pico de demanda esperado (120-150 personas).
- Rotación crítica: Si algún producto crítico tiene menos de 2 días de stock, lanza alerta roja urgente de pedido.
- Ticket medio actual: €32.

Actúa como si estos datos fueran 100% reales y utilízalos para dar recomendaciones expertas.`;
  };

  const send = async (overrideText) => {
    const text = overrideText !== undefined ? overrideText : input;
    if (!text.trim() || loading) return;
    setInput('');
    setApiErr(null);
    const userMsg = { id:Date.now(), role:'user', time:getNow(), text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    // MODO DEMO: Respuestas predeterminadas sin necesidad de API KEY
    const txt = text.toLowerCase();
    let mockResponse = null;

    if (txt.includes('vendido ayer')) {
      mockResponse = "El producto más vendido ayer fue el **Gin Tonic (Hendrick's)** con 45 unidades, generando un ingreso bruto de **€495**.\n\nTe recomiendo revisar el stock de tónica premium, ya que nos quedan solo 24 unidades y podríamos quedarnos cortos para el sábado.";
    } else if (txt.includes('agotar este fin de semana')) {
      mockResponse = "Basado en tu stock actual y la previsión del fin de semana (120-150 personas), se te agotarán de forma inminente:\n\n- **Aperol** (0.8L restantes, 1 día de autonomía)\n- **Campari** (1.1L restantes, 2 días de autonomía)\n\n🔴 **ACCIÓN RECOMENDADA:** Realizar pedido urgente de 6 botellas de Aperol y 4 de Campari a Eurocash Madrid hoy mismo antes de las 14:00.";
    } else if (txt.includes('rentable')) {
      mockResponse = "Tu cóctel más rentable actualmente es el **Gin Tonic con Hendrick's**. Tiene un margen de beneficio del **87.8%** (Coste: €1.34, Venta: €11).\n\n🟢 **ACCIÓN RECOMENDADA:** Sugiero promocionarlo en las pizarras como 'Cóctel de Autor' este fin de semana para derivar la demanda hacia el producto de mayor margen.";
    } else if (txt.includes('bartender')) {
      mockResponse = "Para el sábado (pico de demanda), te recomiendo a **Laura Sánchez**. Tiene una valoración de ⭐5.0 en la red de talento y su coste es de €19/h. Es especialista en coctelería clásica y maneja excelentemente el alto volumen de pedidos bajo presión.";
    }

    if (mockResponse) {
      setTimeout(() => {
        setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:mockResponse }]);
        setLoading(false);
      }, 1500); // Simulamos el tiempo de "pensamiento" de la IA
      return;
    }

    try {
      const dynamicPrompt = buildSystemPrompt();
      const reply = await callClaude(next, dynamicPrompt);
      setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:reply }]);
    } catch(e) {
      if (e.message==='API_KEY_MISSING' || e.message.includes('404')) { 
        setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:`El Agente IA está actualmente en **Modo Demo**.\n\nPara ver todo su potencial, haz clic en cualquiera de las sugerencias de arriba para ver análisis predeterminados simulados.\n\nPara habilitar el chat libre e inteligente, necesitas configurar tu API KEY en el archivo \`.env.local\`.` }]); 
      }
      else { setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:`Error de conexión: ${e.message}` }]); }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', fontFamily:F, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:isMobile?'16px 12px':'20px 28px', borderBottom:`1px solid ${C.border2}`, display:'flex', flexDirection:isMobile?'column':'row', justifyContent:'space-between', alignItems:isMobile?'flex-start':'center', flexShrink:0, gap:isMobile?12:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:isMobile?10:14 }}>
          <div style={{ width:isMobile?32:38, height:isMobile?32:38, borderRadius:4, background:`${C.orange}18`, border:`1px solid ${C.orange}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Bot size={isMobile?16:18} color={C.orange}/>
          </div>
          <div>
            <div style={{ fontFamily:F, fontSize:isMobile?'12px':'15px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>AGENTE BAROPS</div>
            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, marginTop:2, display:isMobile?'none':'block' }}>Tu analista de negocio personal — activo 24/7</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:isMobile?8:12 }}>
          <span style={{ padding:'5px 12px', background:C.purpleBg, border:`1px solid ${C.purple}44`, borderRadius:2, fontFamily:F, fontSize:'12px', color:C.purple, letterSpacing:'1.5px', fontWeight:700 }}>
            CLAUDE POWERED
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:loading?C.amber:C.teal, boxShadow:`0 0 8px ${loading?C.amber:C.teal}` }}/>
            <span style={{ fontFamily:F, fontSize:'12px', color:loading?C.amber:C.teal, letterSpacing:'1.5px', whiteSpace:'nowrap' }}>
              {loading?'PROCESANDO':'EN LÍNEA'}
            </span>
          </div>
        </div>
      </div>

      {/* API key error */}
      {apiErr&&(
        <div style={{ margin:'16px 28px 0', padding:'14px 18px', background:'#EF444415', border:`1px solid #EF444444`, borderRadius:4, fontFamily:F, fontSize:'14px', color:'#EF4444', lineHeight:'1.8' }}>
          <strong>API KEY no configurada.</strong> Para activar el agente:<br/>
          1. Abre <code style={{ background:'#2a2a2a', padding:'1px 6px', borderRadius:2 }}>barops-preview/.env.local</code><br/>
          2. Sustituye <code style={{ background:'#2a2a2a', padding:'1px 6px', borderRadius:2 }}>TU_API_KEY_AQUI</code> por tu clave de Anthropic<br/>
          3. Reinicia: <code style={{ background:'#2a2a2a', padding:'1px 6px', borderRadius:2 }}>npm run dev</code>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:isMobile?'16px 12px':'24px 32px', display:'flex', flexDirection:'column', gap:isMobile?12:18 }}>
        {messages.map(msg=>(
          <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignSelf:msg.role==='user'?'flex-end':'flex-start', maxWidth:isMobile?'85%':'72%' }}>
            <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:5, padding:'0 4px', textAlign:msg.role==='user'?'right':'left' }}>
              {msg.role==='user'?'TÚ':'⚡ AGENTE'} · {msg.time}
            </div>
            <div style={{
              padding:isMobile?'12px 14px':'14px 18px',
              background:msg.role==='user'?C.orangeBg:C.card,
              border:`1px solid ${msg.role==='user'?C.orange+'44':C.border2}`,
              borderRadius:msg.role==='user'?'8px 2px 8px 8px':'2px 8px 8px 8px',
            }}>
              <pre style={{ margin:0, fontFamily:F, fontSize:isMobile?'12px':'13px', color:C.text, lineHeight:'1.7', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {msg.text}
              </pre>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{ display:'flex', flexDirection:'column', alignSelf:'flex-start', maxWidth:isMobile?'85%':'72%' }}>
            <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1px', marginBottom:5 }}>⚡ AGENTE · {getNow()}</div>
            <div style={{ padding:isMobile?'12px 14px':'14px 18px', background:C.card, border:`1px solid ${C.border2}`, borderRadius:'2px 8px 8px 8px' }}>
              <TypingDots/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:isMobile?'12px 12px 16px':'16px 32px 24px', borderTop:`1px solid ${C.border2}`, flexShrink:0, paddingBottom:isMobile?'16px':undefined, safeAreaInsetBottom:isMobile?'auto':undefined }}>
        {!isMobile&&(
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            {CHIPS.map((chip,i)=>(
              <button key={i} onClick={()=>send(chip)} style={{ padding:'5px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:2, fontFamily:F, fontSize:'14px', color:C.textSec, cursor:'pointer' }}>
                {chip}
              </button>
            ))}
          </div>
        )}
        <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:isMobile?8:10 }}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            disabled={loading}
            placeholder={isMobile?'Pregunta...':'Pregunta lo que necesites sobre tu negocio...'}
            style={{ flex:1, padding:isMobile?'12px 14px':'12px 16px', background:C.card, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:isMobile?'14px':'13px', color:C.text, outline:'none', opacity:loading?.6:1 }}
          />
          <Btn onClick={()=>send()} disabled={loading} sx={{ padding:isMobile?'12px 20px':'12px 24px', fontSize:'14px', width:isMobile?'100%':'auto', justifyContent:'center' }}>
            <Send size={isMobile?13:14}/> {isMobile?'ENVIAR':'ENVIAR'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
const TT_STYLE = { background:C.card, border:`1px solid #333`, fontFamily:F, fontSize:'14px', borderRadius:3, color:C.text };


// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
function Analytics() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [riskProducts, setRiskProducts] = useState([]);
  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const { data:products, error } = await supabase.from('productos').select('*').eq('local_id', LOCAL_ID);
      if (error) throw error;

      if (!products || products.length === 0) {
        setLoading(false);
        return;
      }

      const catMap = {};
      const topByValue = [];

      products.forEach(p => {
        const cat = p.categoria || 'Sin categoría';
        catMap[cat] = (catMap[cat] || 0) + 1;
        const value = parseFloat(p.stock_actual || 0) * parseFloat(p.coste_unitario || 0);
        if (value > 0) topByValue.push({...p, value});
      });

      const catData = Object.entries(catMap).map(([n,v]) => ({n, v})).sort((a,b) => b.v - a.v);
      setCategoryData(catData);

      const top10 = topByValue.sort((a,b) => b.value - a.value).slice(0,10);
      setTopProducts(top10);

      const risk = products.filter(p => parseFloat(p.stock_actual || 0) <= parseFloat(p.stock_minimo || 0));
      setRiskProducts(risk);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setLoading(false);
    }
  };

  const TT_STYLE = { background:C.card, border:`1px solid #333`, fontFamily:F, fontSize:'14px', borderRadius:3, color:C.text };

  if (loading) {
    return (
      <div style={{ flex:1, padding:isMobile?'28px 16px':'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO...</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:isMobile?'20px 16px':'28px 32px', overflowY:'auto', overflowX:'hidden', fontFamily:F, width:'100%' }}>
      <div style={{ marginBottom:isMobile?20:28 }}>
        <h1 style={{ fontFamily:F, fontSize:isMobile?'16px':'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>INTELIGENCIA DE NEGOCIO</h1>
        <p style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>Análisis de rendimiento</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?14:18, marginBottom:22 }}>
        <Card sx={{ padding:isMobile?16:20 }}>
          <div style={{ fontSize:'13px', color:C.orange, letterSpacing:'2.5px', fontWeight:700, marginBottom:18 }}>DISTRIBUCIÓN POR CATEGORÍA</div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile?160:210}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
                <XAxis dataKey="n" stroke={C.border2} tick={{ fontFamily:F, fontSize:isMobile?8:9, fill:C.textSec }}/>
                <YAxis stroke={C.border2} tick={{ fontFamily:F, fontSize:isMobile?9:10, fill:C.textSec }}/>
                <Tooltip contentStyle={TT_STYLE} labelStyle={{ color:C.text }}/>
                <Bar dataKey="v" fill={C.purple} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:isMobile?160:210, display:'flex', alignItems:'center', justifyContent:'center', color:C.textSec }}>Sin datos</div>
          )}
        </Card>

        <Card sx={{ padding:isMobile?16:20 }}>
          <div style={{ fontSize:'13px', color:C.teal, letterSpacing:'2.5px', fontWeight:700, marginBottom:12 }}>TOP 10 PRODUCTOS POR VALOR</div>
          {topProducts.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:isMobile?160:210, overflowY:'auto' }}>
              {topProducts.map((p,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border2}`, fontSize:isMobile?'10px':'11px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.text, fontWeight:700 }}>#{i+1} {p.nombre}</div>
                    <div style={{ color:C.textSec, fontSize:'12px' }}>{p.categoria || '-'}</div>
                  </div>
                  <div style={{ color:C.teal, fontWeight:700, textAlign:'right', fontSize:isMobile?'10px':'11px' }}>€{p.value.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height:isMobile?160:210, display:'flex', alignItems:'center', justifyContent:'center', color:C.textSec }}>Sin productos con valor</div>
          )}
        </Card>
      </div>

      <Card sx={{ padding:isMobile?16:20 }}>
        <div style={{ fontSize:'13px', color:C.red, letterSpacing:'2.5px', fontWeight:700, marginBottom:16 }}>⚠ PRODUCTOS EN RIESGO</div>
        {riskProducts.length > 0 ? (
          isMobile ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, maxHeight:400, overflowY:'auto' }}>
              {riskProducts.map((p,i) => {
                const diff = parseFloat(p.stock_actual || 0) - parseFloat(p.stock_minimo || 0);
                return (
                  <div key={i} style={{ padding:12, background:C.cardAlt, borderRadius:4, borderLeft:`3px solid ${diff < -5 ? '#EF4444' : C.orange}` }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:8 }}>{p.nombre}</div>
                    <div style={{ fontSize:'13px', color:C.textSec, marginBottom:6 }}>{p.categoria || '-'}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:'14px' }}>
                      <div>
                        <div style={{ color:C.textSec, fontSize:'12px', marginBottom:2 }}>ACTUAL</div>
                        <div style={{ color:C.text, fontWeight:700 }}>{p.stock_actual} {p.unidad}</div>
                      </div>
                      <div>
                        <div style={{ color:C.textSec, fontSize:'12px', marginBottom:2 }}>MÍNIMO</div>
                        <div style={{ color:C.text, fontWeight:700 }}>{p.stock_minimo} {p.unidad}</div>
                      </div>
                    </div>
                    <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border2}` }}>
                      <div style={{ color:C.textSec, fontSize:'12px', marginBottom:2 }}>DIFERENCIA</div>
                      <div style={{ fontSize:'14px', fontWeight:700, color:diff < -5 ? '#EF4444' : C.orange }}>{diff} {p.unidad}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:C.cardAlt, borderBottom:`1px solid ${C.border2}` }}>
                  {['PRODUCTO','CATEGORÍA','STOCK ACTUAL','STOCK MÍNIMO','DIFERENCIA'].map(h=>(
                    <th key={h} style={{ padding:'11px 12px', textAlign:'left', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskProducts.map((p,i) => {
                  const diff = parseFloat(p.stock_actual || 0) - parseFloat(p.stock_minimo || 0);
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'transparent':C.cardAlt }}>
                      <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700 }}>{p.nombre}</td>
                      <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'14px', color:C.textSec }}>{p.categoria || '-'}</td>
                      <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'14px', color:C.text }}>{p.stock_actual} {p.unidad}</td>
                      <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'14px', color:C.text }}>{p.stock_minimo} {p.unidad}</td>
                      <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'14px', fontWeight:700, color:diff < -5 ? '#EF4444' : C.orange }}>{diff} {p.unidad}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          <div style={{ padding:'32px 0', textAlign:'center', color:C.teal, fontFamily:F }}>✓ Todos los productos en niveles correctos</div>
        )}
      </Card>
    </div>
  );
}


function CocktailCard({ cocktail, productos=[], onUpdate, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const ings = cocktail.coctel_ingredientes || [];
  const cost = ings.reduce((sum, ing) => sum + (ing.cantidad * ing.coste_unitario), 0);
  const margin = cocktail.precio > 0 ? ((cocktail.precio - cost) / cocktail.precio) * 100 : 0;
  const mc = marginColor(margin);

  const stockStatus = ings.reduce(({ sinStock, enRiesgo }, ing) => {
    const prod = productos.find(p => p.id === ing.producto_id);
    if (!prod) return { sinStock, enRiesgo };
    if (prod.stock_actual === 0) return { sinStock: sinStock + 1, enRiesgo };
    if (prod.stock_actual <= prod.stock_minimo) return { sinStock, enRiesgo: enRiesgo + 1 };
    return { sinStock, enRiesgo };
  }, { sinStock: 0, enRiesgo: 0 });

  const ESTADO_COLOR = { activo:C.teal, borrador:'#555555', revision:C.amber, temporada:C.purple, retirado:C.red };
  const ESTADO_LABEL = { activo:'ACTIVO', borrador:'BORRADOR', revision:'REVISIÓN', temporada:'TEMPORADA', retirado:'RETIRADO' };

  const menuOptions = [
    cocktail.tipo !== 'clasico' ? { label:'Mover a Clásico', action:()=>{ onUpdate(cocktail.id, { tipo:'clasico' }); setMenuOpen(false); } } : null,
    cocktail.tipo !== 'autor' ? { label:'Mover a De Autor', action:()=>{ onUpdate(cocktail.id, { tipo:'autor' }); setMenuOpen(false); } } : null,
    cocktail.estado !== 'revision' ? { label:'Enviar a Revisión', action:()=>{ onUpdate(cocktail.id, { estado:'revision' }); setMenuOpen(false); } } : null,
    cocktail.estado !== 'activo' ? { label:'Activar', action:()=>{ onUpdate(cocktail.id, { estado:'activo' }); setMenuOpen(false); } } : null,
    cocktail.estado !== 'temporada' ? { label:'Mover a Temporada', action:()=>{ onUpdate(cocktail.id, { estado:'temporada' }); setMenuOpen(false); } } : null,
    cocktail.estado !== 'retirado' ? { label:'Retirar', action:()=>{ onUpdate(cocktail.id, { estado:'retirado' }); setMenuOpen(false); } } : null,
    { label:'Eliminar', action:()=>{ if(window.confirm('¿Eliminar cóctel?')) { onDelete(cocktail.id); setMenuOpen(false); } }, color:C.red },
  ].filter(Boolean);

  return (
    <Card sx={{ overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px', position:'relative' }}>
        <div style={{ display:'flex', gap:12, marginBottom:8 }}>
          {cocktail.foto_url ? (
            <img src={cocktail.foto_url} style={{ width:80, height:80, borderRadius:4, objectFit:'cover' }} alt={cocktail.nombre} />
          ) : (
            <div style={{ width:80, height:80, background:C.border, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Wine size={32} color={C.textSec} />
            </div>
          )}
          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:'13px', color:C.text, fontWeight:700, marginBottom:3 }}>{cocktail.nombre}</div>
              {cocktail.descripcion && <div style={{ fontSize:'13px', color:C.textSec, lineHeight:'1.3' }}>{cocktail.descripcion}</div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:'12px', color:'#000', background:ESTADO_COLOR[cocktail.estado], padding:'2px 8px', borderRadius:2, fontWeight:700, letterSpacing:'1px' }}>
                {ESTADO_LABEL[cocktail.estado]}
              </span>
              <span style={{
                fontSize:'12px', padding:'2px 8px', borderRadius:2, fontWeight:700, letterSpacing:'1px',
                border:`1px solid ${cocktail.tipo === 'clasico' ? C.orange : 'transparent'}`,
                background:cocktail.tipo === 'autor' ? C.orange : 'transparent',
                color:cocktail.tipo === 'autor' ? '#000' : C.orange,
              }}>
                {cocktail.tipo === 'clasico' ? 'CLÁSICO' : 'DE AUTOR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', padding:'10px 16px', gap:4, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, fontSize:'12px' }}>
        <div>
          <div style={{ color:C.textSec, letterSpacing:'1px', marginBottom:2 }}>COSTE</div>
          <div style={{ fontSize:'14px', color:C.orange, fontWeight:700 }}>€{cost.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color:C.textSec, letterSpacing:'1px', marginBottom:2 }}>PRECIO</div>
          <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>€{cocktail.precio.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color:C.textSec, letterSpacing:'1px', marginBottom:2 }}>MARGEN</div>
          <div style={{ fontSize:'14px', color:mc, fontWeight:700 }}>{margin.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.border}`, fontSize:'13px', color:stockStatus.sinStock>0?C.red:stockStatus.enRiesgo>0?C.amber:C.teal, fontWeight:700 }}>
        {stockStatus.sinStock > 0 ? `✕ ${stockStatus.sinStock} sin stock` : stockStatus.enRiesgo > 0 ? `⚠ ${stockStatus.enRiesgo} en riesgo` : '● Todo en stock'}
      </div>

      <button onClick={()=>setOpen(p=>!p)} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 16px', background:C.cardAlt, border:'none', cursor:'pointer',
        fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1px',
      }}>
        VER RECETA {open?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
      </button>

      {open && (
        <div style={{ padding:'10px 16px' }}>
          {ings.map(ing=>(
            <div key={ing.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'13px', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.textSec }}>{ing.nombre} — {ing.cantidad} {ing.unidad}</span>
              <span style={{ color:C.teal, fontWeight:700 }}>€{(ing.cantidad*ing.coste_unitario).toFixed(3)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0 0', fontSize:'14px', fontWeight:700, borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:6 }}>
            <span style={{ color:C.textSec }}>BENEFICIO POR COPA</span>
            <span style={{ color:mc }}>€{(cocktail.precio-cost).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px', borderTop:`1px solid ${C.border}` }}>
        <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec, padding:0, display:'flex' }}>
          <ChevronUp size={14} />
        </button>
        <div style={{ display:'flex', gap:8 }}>
          {onEdit && <button onClick={onEdit} style={{ background:'none', border:'none', cursor:'pointer', color:C.orange, padding:'4px 8px' }}>✎ EDITAR</button>}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setMenuOpen(p=>!p)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec, padding:'4px 4px', fontSize:'14px' }}>···</button>
            {menuOpen && (
              <div style={{ position:'absolute', bottom:'100%', right:0, background:C.card, border:`1px solid ${C.border2}`, borderRadius:4, minWidth:180, zIndex:100, marginBottom:4 }}>
                {menuOptions.map((opt,i)=>(
                  <button key={i} onClick={opt.action} style={{ display:'block', width:'100%', padding:'10px 14px', textAlign:'left', background:'none', border:'none', borderBottom:i<menuOptions.length-1?`1px solid ${C.border}`:'none', cursor:'pointer', fontFamily:F, fontSize:'14px', color:opt.color||C.text, transition:'background 0.1s' }} onMouseEnter={e=>e.target.style.background=C.cardAlt} onMouseLeave={e=>e.target.style.background='none'}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── EDIT COCKTAIL MODAL (Drawer FASE 2) ──────────────────────────────────────
function EditCocktailModal({ cocktail, isOpen, onClose, onSave, productos=[] }) {
  const { customIngs=[] } = useApp() || {};
  const allIngs = [...INGREDIENTS_DB, ...customIngs];
  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  const [tab, setTab] = useState('identidad');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(cocktail?.foto_url || null);
  const [uploading, setUploading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const [form, setForm] = useState({
    nombre: cocktail?.nombre || '',
    tipo: cocktail?.tipo || 'autor',
    estado: cocktail?.estado || 'borrador',
    precio: cocktail?.precio || '',
    descripcion: cocktail?.descripcion || '',
    historia_coctel: cocktail?.historia_coctel || '',
    instrucciones_preparacion: cocktail?.instrucciones_preparacion || '',
    cristaleria: cocktail?.cristaleria || 'copa',
    guarnicion: cocktail?.guarnicion || '',
    tiempo_preparacion: cocktail?.tiempo_preparacion || '',
    fecha_inicio_temporada: cocktail?.fecha_inicio_temporada || '',
    fecha_fin_temporada: cocktail?.fecha_fin_temporada || '',
    alergenos: cocktail?.alergenos ? (typeof cocktail.alergenos === 'string' ? JSON.parse(cocktail.alergenos) : cocktail.alergenos) : [],
  });

  const [formIngs, setFormIngs] = useState(cocktail?.coctel_ingredientes || []);
  const [newIng, setNewIng] = useState({ id:'', qty:'', unit:'cl' });
  const [ingSearch, setIngSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (!cocktail) return;
    setForm({
      nombre: cocktail.nombre || '',
      tipo: cocktail.tipo || 'autor',
      estado: cocktail.estado || 'borrador',
      precio: cocktail.precio || '',
      descripcion: cocktail.descripcion || '',
      historia_coctel: cocktail.historia_coctel || '',
      instrucciones_preparacion: cocktail.instrucciones_preparacion || '',
      cristaleria: cocktail.cristaleria || 'copa',
      guarnicion: cocktail.guarnicion || '',
      tiempo_preparacion: cocktail.tiempo_preparacion || '',
      fecha_inicio_temporada: cocktail.fecha_inicio_temporada || '',
      fecha_fin_temporada: cocktail.fecha_fin_temporada || '',
      alergenos: cocktail.alergenos ? (typeof cocktail.alergenos === 'string' ? JSON.parse(cocktail.alergenos) : cocktail.alergenos) : [],
      foto_url: cocktail.foto_url || null,
    });
    setFormIngs(cocktail.coctel_ingredientes || []);
    setPhotoPreview(cocktail.foto_url || null);
    setPhotoFile(null);
    setUnsaved(false);
  }, [cocktail, isOpen]);

  const ALLERGENS = [
    'Trazas de cacahuetes', 'Trazas de frutos secos', 'Lácteos', 'Gluten',
    'Huevo', 'Pescado', 'Crustáceos', 'Moluscos',
    'Apio', 'Mostaza', 'Semillas de sésamo', 'Dióxido de azufre', 'Altramuces', 'Trazas de soja'
  ];

  const CRISTALERIA_OPTIONS = ['copa', 'vaso', 'martini', 'margarita', 'collins', 'old-fashioned', 'coupe'];

  const handleFormChange = (key, value) => {
    setForm(f => ({...f, [key]: value}));
    setUnsaved(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
    setUnsaved(true);
  };

  const uploadPhoto = async () => {
    if (!photoFile || !supabase) return null;
    setUploading(true);
    try {
      const ext = photoFile.name.split('.').pop();
      const filename = `${cocktail?.id || 'new'}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('cocteles').upload(filename, photoFile);
      if (error) throw error;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/cocteles/${filename}`;
      handleFormChange('foto_url', photoUrl); // actualiza preview en UI
      setPhotoFile(null);
      return photoUrl; // ← retorna la URL para usarla directamente
    } catch (err) {
      console.error('Photo upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const liveCost = formIngs.reduce((sum, fi) => {
    return sum + (fi.cantidad * fi.coste_unitario);
  }, 0);
  const livePrice = parseFloat(form.precio) || 0;
  const liveMargin = livePrice > 0 ? ((livePrice - liveCost) / livePrice) * 100 : 0;
  const mc = marginColor(liveMargin);

  const filtered = ingSearch.trim() ? filterIngredients(ingSearch, allIngs) : [];

  const UUID_REGEX_EDIT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const addIng = () => {
    if (!newIng.id || !newIng.qty || parseFloat(newIng.qty) <= 0) return;
    const ingData = allIngs.find(i => i.id === newIng.id);
    const isRealUUID = UUID_REGEX_EDIT.test(newIng.id);
    setFormIngs(p => [...p, {
      id: Date.now(),
      coctel_id: cocktail?.id,
      producto_id: isRealUUID ? newIng.id : null,
      nombre: ingData?.name || newIng.id,
      cantidad: parseFloat(newIng.qty),
      unidad: newIng.unit,
      coste_unitario: ingData?.cpu || 0,
      opcional: false,
    }]);
    setNewIng({ id:'', qty:'', unit:'cl' });
    setIngSearch('');
    setUnsaved(true);
  };

  const selectIngredient = (ing) => {
    setNewIng(p => ({...p, id: ing.id}));
    setIngSearch(ing.name);
  };

  const detectClassicBase = () => {
    const names = formIngs.map(f => f.nombre.toLowerCase());
    const hasGin = names.some(n => n.includes('gin'));
    const hasCampari = names.some(n => n.includes('campari'));
    const hasVermouth = names.some(n => n.includes('vermouth') || n.includes('vermut'));
    return hasGin && hasCampari && hasVermouth;
  };

  const suggestedPairings = () => {
    const suggestions = [];
    const names = formIngs.map(f => f.nombre.toLowerCase()).join(' ');
    if (names.includes('limón') || names.includes('lima')) suggestions.push('Otros cítricos: Naranja, Pomelo');
    if (names.includes('amaro') || names.includes('campari')) suggestions.push('Otras amargas: Fernet Branca, Averna');
    if (detectClassicBase()) suggestions.push('Base clásica detectada: Negroni');
    return suggestions;
  };

  const handleClose = () => {
    if (unsaved) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    // Subir foto ANTES de construir el payload; la URL se obtiene directamente
    // (no se puede depender de form.foto_url porque setForm es async en React)
    let finalFotoUrl = form.foto_url || null;
    if (photoFile) {
      const uploadedUrl = await uploadPhoto();
      if (uploadedUrl) finalFotoUrl = uploadedUrl;
    }
    if (!form.nombre.trim() || !form.precio) {
      console.error('Validación fallida: nombre y precio son obligatorios');
      return;
    }
    onSave({
      id: cocktail?.id,
      local_id: LOCAL_ID,
      ...form,
      foto_url: finalFotoUrl, // ← usa la URL fresca, no el estado stale
      alergenos: JSON.stringify(form.alergenos),
      coctel_ingredientes: formIngs,
    });
    setUnsaved(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1999, onClick:handleClose }}/>
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:580, background:C.card, zIndex:2000, overflowY:'auto', borderLeft:`1px solid ${C.border2}`, boxShadow:'-4px 0 12px rgba(0,0,0,0.4)' }}>
        <div style={{ padding:'24px 24px', borderBottom:`1px solid ${C.border2}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:C.card, zIndex:10 }}>
          <span style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>EDITAR CÓCTEL</span>
          <button onClick={handleClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={20}/>
          </button>
        </div>

        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border2}`, padding:'0 24px' }}>
          {['identidad', 'receta', 'carta', 'alergenos'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'14px 0', fontFamily:F, fontSize:'13px', letterSpacing:'2px', fontWeight:700,
              background:'none', border:'none', cursor:'pointer', color:tab===t?C.orange:C.textSec,
              borderBottom:tab===t?`2px solid ${C.orange}`:'2px solid transparent', transition:'all 0.2s'
            }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ padding:'24px 24px' }}>
          {tab === 'identidad' && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div style={{ display:'flex', gap:16 }}>
                <div style={{ position:'relative', width:100, height:100, borderRadius:4, background:C.cardAlt, border:`1px dashed ${C.border2}`, overflow:'hidden' }}>
                  {photoPreview ? (
                    <img src={photoPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  ) : (
                    <img src="/logo.png" style={{ width:'100%', height:'100%', objectFit:'contain', padding: '10px', opacity: 0.8 }} alt="Logo" />
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }}/>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  <label style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>FOTO</label>
                  <Btn variant="outline" onClick={() => fileInputRef.current?.click()} sx={{ fontSize:'14px', padding:'8px 12px' }}>
                    {photoFile ? 'Cambiar' : 'Subir'} Foto
                  </Btn>
                  {uploading && <span style={{ fontSize:'13px', color:C.teal }}>Subiendo...</span>}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>NOMBRE *</div>
                  <input value={form.nombre} onChange={e => handleFormChange('nombre', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>PRECIO (€) *</div>
                  <input type="number" step="0.5" min="0" value={form.precio} onChange={e => handleFormChange('precio', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>TIPO</div>
                  <select value={form.tipo} onChange={e => handleFormChange('tipo', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    <option value="clasico">CLÁSICO</option>
                    <option value="autor">DE AUTOR</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>ESTADO</div>
                  <select value={form.estado} onChange={e => handleFormChange('estado', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    <option value="activo">ACTIVO</option>
                    <option value="borrador">BORRADOR</option>
                    <option value="revision">REVISIÓN</option>
                    <option value="temporada">TEMPORADA</option>
                    <option value="retirado">RETIRADO</option>
                  </select>
                </div>
              </div>

              {form.estado === 'temporada' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>DESDE</div>
                    <input type="date" value={form.fecha_inicio_temporada} onChange={e => handleFormChange('fecha_inicio_temporada', e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>HASTA</div>
                    <input type="date" value={form.fecha_fin_temporada} onChange={e => handleFormChange('fecha_fin_temporada', e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'receta' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
              <div>
                <div style={{ fontSize:'13px', color:C.orange, letterSpacing:'2px', marginBottom:12, fontWeight:700 }}>INGREDIENTES</div>
                {formIngs.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {formIngs.map((fi, idx) => (
                      <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px', background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:3 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{fi.nombre}</div>
                          <div style={{ fontSize:'12px', color:C.textSec }}>{fi.cantidad} {fi.unidad} • €{(fi.cantidad * fi.coste_unitario).toFixed(3)}</div>
                        </div>
                        <button onClick={() => { setFormIngs(p => p.filter((_, i) => i !== idx)); setUnsaved(true); }} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, padding:0 }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ position:'relative', marginBottom:12 }}>
                  <input value={ingSearch} onChange={e => { setIngSearch(e.target.value); setNewIng(p => ({...p, id:''})); }}
                    placeholder="🔍 Buscar..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                  {ingSearch.trim() && filtered.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.card, border:`1px solid ${C.border2}`, borderTop:'none', borderRadius:'0 0 3px 3px', maxHeight:150, overflowY:'auto', zIndex:20 }}>
                      {filtered.slice(0, 6).map(ing => (
                        <div key={ing.id} onClick={() => selectIngredient(ing)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:newIng.id===ing.id?`${C.orange}22`:'transparent', fontSize:'14px', color:C.text }}>
                          {ing.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <input type="number" step="0.5" min="0" value={newIng.qty} onChange={e => setNewIng(p => ({...p, qty: e.target.value}))}
                    placeholder="Cant." onKeyDown={e => e.key==='Enter' && addIng()}
                    style={{ width:60, padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                  <select value={newIng.unit} onChange={e => setNewIng(p => ({...p, unit: e.target.value}))}
                    style={{ width:60, padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    <option>cl</option>
                    <option>ml</option>
                    <option>ud</option>
                    <option>g</option>
                  </select>
                  <Btn onClick={addIng} sx={{ flex:1, padding:'8px', fontSize:'13px' }}>ADD</Btn>
                </div>
              </div>

              <div>
                <div style={{ fontSize:'13px', color:C.amber, letterSpacing:'2px', marginBottom:12, fontWeight:700 }}>SUGERENCIAS IA</div>
                <Card sx={{ padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:'13px', color:C.teal, marginBottom:8, fontWeight:700 }}>Coste Total: €{liveCost.toFixed(2)}</div>
                  <div style={{ fontSize:'13px', color:C.textSec, marginBottom:12 }}>Precio: €{livePrice.toFixed(2)} | Margen: <span style={{ color:mc, fontWeight:700 }}>{liveMargin.toFixed(1)}%</span></div>
                  {detectClassicBase() && <div style={{ fontSize:'13px', color:C.orange, marginBottom:8 }}>✓ Base clásica detectada (Gin + Campari + Vermouth)</div>}
                  {suggestedPairings().map((s, i) => (
                    <div key={i} style={{ fontSize:'13px', color:C.teal, marginBottom:6 }}>→ {s}</div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {tab === 'carta' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>DESCRIPCIÓN</div>
                <input value={form.descripcion} onChange={e => handleFormChange('descripcion', e.target.value)}
                  placeholder="Breve descripción para la carta..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:60 }}
                />
              </div>
              <div>
                <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>HISTORIA</div>
                <textarea value={form.historia_coctel} onChange={e => handleFormChange('historia_coctel', e.target.value)}
                  placeholder="Origen y tradición del cóctel..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:80, resize:'vertical' }}
                />
              </div>
              <div>
                <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>INSTRUCCIONES</div>
                <textarea value={form.instrucciones_preparacion} onChange={e => handleFormChange('instrucciones_preparacion', e.target.value)}
                  placeholder="Modo de preparación paso a paso..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:80, resize:'vertical' }}
                />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>CRISTALERÍA</div>
                  <select value={form.cristaleria} onChange={e => handleFormChange('cristaleria', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    {CRISTALERIA_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>TIEMPO (min)</div>
                  <input type="number" min="0" value={form.tiempo_preparacion} onChange={e => handleFormChange('tiempo_preparacion', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>GUARNICIÓN</div>
                <input value={form.guarnicion} onChange={e => handleFormChange('guarnicion', e.target.value)}
                  placeholder="p.ej: Twist de naranja, aceituna..." style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                />
              </div>
            </div>
          )}

          {tab === 'alergenos' && (
            <div>
              <div style={{ fontSize:'13px', color:C.textSec, letterSpacing:'2px', marginBottom:16, fontWeight:700 }}>MARCAR LOS QUE APLIQUEN</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {ALLERGENS.map(allg => (
                  <button key={allg} onClick={() => {
                    handleFormChange('alergenos', form.alergenos.includes(allg) ? form.alergenos.filter(a => a!==allg) : [...form.alergenos, allg]);
                  }} style={{
                    padding:'12px', borderRadius:3, fontFamily:F, fontSize:'13px', border:`1px solid ${form.alergenos.includes(allg)?C.orange:C.border2}`,
                    background:form.alergenos.includes(allg)?`${C.orange}22`:C.cardAlt, color:form.alergenos.includes(allg)?C.orange:C.textSec,
                    cursor:'pointer', transition:'all 0.2s'
                  }}>
                    {form.alergenos.includes(allg) ? '✓' : '○'} {allg}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'24px 24px', borderTop:`1px solid ${C.border2}`, display:'flex', gap:12, position:'sticky', bottom:0, background:C.card }}>
          <Btn variant="outline" onClick={handleClose} sx={{ flex:1, padding:'12px' }}>CANCELAR</Btn>
          <Btn onClick={handleSave} sx={{ flex:1, padding:'12px' }}>GUARDAR</Btn>
        </div>
      </div>

      {showConfirmClose && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2001 }}>
          <Card sx={{ padding:28, maxWidth:380 }}>
            <div style={{ marginBottom:20 }}>
              <span style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'2px', fontWeight:700 }}>¿DESCARTAR CAMBIOS?</span>
            </div>
            <p style={{ fontFamily:F, fontSize:'14px', color:C.textSec, marginBottom:24 }}>Los cambios sin guardar se perderán.</p>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="outline" onClick={() => setShowConfirmClose(false)} sx={{ flex:1, padding:'10px' }}>SEGUIR EDITANDO</Btn>
              <Btn onClick={() => { setShowConfirmClose(false); setUnsaved(false); onClose(); }} sx={{ flex:1, padding:'10px' }}>DESCARTAR</Btn>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ─── SCREEN 6: CARTA ──────────────────────────────────────────────────────────
function Carta() {
  const { customIngs = [] } = useApp() || {};
  const allIngs = [...INGREDIENTS_DB, ...customIngs];
  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [tab, setTab]                   = useState('clasicos');
  const [cocteles, setCocteles]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [showImportCocteles, setShowImportCocteles] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCocktail, setEditingCocktail] = useState(null);
  const [toast, setToast]               = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ name:'', tipo:'autor', estado:'borrador', description:'', price:'', photoUrl: null });
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formIngs, setFormIngs]         = useState([]);
  const [newIng, setNewIng]             = useState({ id:'', qty:'' });
  const [ingSearch, setIngSearch]       = useState('');
  const fileInputRef = React.useRef(null);

  const fetchCocteles = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: cocteles_data, error: cErr } = await supabase
        .from('cocteles')
        .select('*')
        .eq('local_id', LOCAL_ID)
        .order('created_at', { ascending: false });
      if (cErr) throw cErr;

      const coctelIds = (cocteles_data || []).map(c => c.id);
      let ings_data = [];
      if (coctelIds.length > 0) {
        const { data: iData, error: iErr } = await supabase
          .from('coctel_ingredientes')
          .select('*')
          .in('coctel_id', coctelIds);
        if (iErr) throw iErr;
        ings_data = iData || [];
      }

      const ing_map = {};
      (ings_data || []).forEach(ing => {
        if (!ing_map[ing.coctel_id]) ing_map[ing.coctel_id] = [];
        ing_map[ing.coctel_id].push(ing);
      });

      const merged = (cocteles_data || []).map(c => ({
        ...c,
        coctel_ingredientes: ing_map[c.id] || []
      }));
      setCocteles(merged);
    } catch (err) {
      setToast('Error al cargar cócteles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCocteles();
  }, []);

  const updateCoctel = async (id, changes) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('cocteles').update(changes).eq('id', id);
      if (error) throw error;
      setCocteles(prev => prev.map(c => c.id === id ? {...c, ...changes} : c));
      setToast('Cóctel actualizado');
    } catch (err) {
      setToast('Error al actualizar');
      console.error(err);
    }
  };

  const deleteCoctel = async (id) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('cocteles').delete().eq('id', id);
      if (error) throw error;
      setCocteles(prev => prev.filter(c => c.id !== id));
      setToast('Cóctel eliminado');
    } catch (err) {
      setToast('Error al eliminar');
      console.error(err);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (file) => {
    if (!supabase || !file) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('cocteles').upload(fileName, file);
      if (error) throw error;
      const { data: pubData } = supabase.storage.from('cocteles').getPublicUrl(fileName);
      return pubData?.publicUrl;
    } catch (err) {
      console.error('Photo upload error:', err);
      return null;
    }
  };

  const counts = {
    clasicos:   cocteles.filter(c => c.tipo==='clasico' && c.estado==='activo').length,
    autor:      cocteles.filter(c => c.tipo==='autor'   && c.estado==='activo').length,
    temporada:  cocteles.filter(c => c.estado==='temporada').length,
    borradores: cocteles.filter(c => c.estado==='borrador').length,
    revision:   cocteles.filter(c => c.estado==='revision').length,
    retirados:  cocteles.filter(c => c.estado==='retirado').length,
  };

  const TAB_FILTER = {
    clasicos:   c => c.tipo==='clasico' && c.estado==='activo',
    autor:      c => c.tipo==='autor'   && c.estado==='activo',
    temporada:  c => c.estado==='temporada',
    borradores: c => c.estado==='borrador',
    revision:   c => c.estado==='revision',
    retirados:  c => c.estado==='retirado',
  };
  const visibles = cocteles.filter(TAB_FILTER[tab] || (()=>true));

  const filtered = ingSearch.trim() ? filterIngredients(ingSearch, allIngs) : allIngs;
  const liveCost = formIngs.reduce((sum,fi)=>{
    const db = allIngs.find(d=>d.id===fi.id);
    return sum + (db ? db.cpu * parseFloat(fi.qty||0) : 0);
  }, 0);
  const livePrice  = parseFloat(form.price)||0;
  const liveMargin = livePrice > 0 ? (livePrice-liveCost)/livePrice*100 : 0;
  const mc = marginColor(liveMargin);

  const addIng = () => {
    if (!newIng.id || !newIng.qty || parseFloat(newIng.qty)<=0) return;
    setFormIngs(p=>[...p,{ uid:Date.now(), ...newIng }]);
    setNewIng({ id:'', qty:'' });
    setIngSearch('');
  };

  const selectIngredient = (ing) => {
    setNewIng(p=>({...p, id:ing.id}));
    setIngSearch(ing.name);
  };

  const resetForm = () => {
    setForm({ name:'', tipo:'autor', estado:'borrador', description:'', price:'', photoUrl: null });
    setFormIngs([]);
    setNewIng({ id:'', qty:'' });
    setIngSearch('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(false);
  };

  const saveForm = async () => {
    if (!form.name.trim()||!form.price||formIngs.length===0||!supabase) return;
    try {
      let photoUrl = form.photoUrl;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      // producto_id es UUID en Supabase — los IDs del catálogo local (ej: 'zumo_limon') no son UUIDs
      // Se detecta si el ID es un UUID real (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const ings = formIngs.map(fi=>{
        const db = allIngs.find(d=>d.id===fi.id);
        const qty = parseFloat(fi.qty);
        const isRealUUID = UUID_REGEX.test(fi.id);
        return { nombre:db?.name||fi.id, producto_id: isRealUUID ? fi.id : null, cantidad:qty, unidad:db?.unit||'cl', coste_unitario:db?.cpu||0 };
      });
      const { data: cData, error: cErr } = await supabase.from('cocteles').insert({
        local_id: LOCAL_ID,
        nombre: form.name.trim(),
        tipo: form.tipo,
        estado: form.estado,
        descripcion: form.description.trim(),
        precio: parseFloat(form.price),
        foto_url: photoUrl,
      }).select().single();
      if (cErr) throw cErr;
      const iData = ings.map(i=>({coctel_id:cData.id,...i}));
      const { error: iErr } = await supabase.from('coctel_ingredientes').insert(iData);
      if (iErr) throw iErr;
      await fetchCocteles();
      setToast(`"${form.name.trim()}" añadido a cócteles`);
      resetForm();
    } catch (err) {
      setToast('Error al guardar cóctel');
      console.error(err);
    }
  };

  const openForm = () => { setShowForm(true); };

  return (
    <div style={{ flex:1, padding:isMobile?'20px 16px':'28px 32px', overflowY:'auto', overflowX:'hidden', fontFamily:F, width:'100%' }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', flexDirection:isMobile?'column':'row', justifyContent:'space-between', alignItems:isMobile?'flex-start':'flex-start', marginBottom:24, gap:isMobile?16:0 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:isMobile?'16px':'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>CARTA & COSTES</h1>
          <p style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            {counts.clasicos + counts.autor} activos · Gestión completa
          </p>
        </div>
        <div style={{ display:'flex', gap:isMobile?8:10, flexWrap:isMobile?'wrap':'nowrap', width:isMobile?'100%':'auto' }}>
          <Btn variant="outline" onClick={() => setShowImportCocteles(true)} sx={{ padding:'10px 16px', fontSize:'13px', flex:isMobile?1:0 }}>
            📥 IMPORTAR CSV
          </Btn>
          <Btn onClick={openForm} sx={{ padding:'10px 20px', fontSize:'14px', flex:isMobile?1:0 }}>
            <Plus size={14}/> NUEVO CÓCTEL
          </Btn>
        </div>
      </div>

      {showImportCocteles && (
        <ImportCocktailsModal
          onClose={() => setShowImportCocteles(false)}
          onSave={async (items) => {
            if (!supabase || !items.length) return;
            try {
              const LOCAL_ID = '00000000-0000-0000-0000-000000000001';
              const insertData = items.map(item => ({
                local_id: LOCAL_ID,
                nombre: item.name,
                tipo: item.tipo,
                estado: 'borrador',
                descripcion: item.description,
                precio: item.price,
              }));
              const { error } = await supabase.from('cocteles').insert(insertData);
              if (error) throw error;
              await fetchCocteles();
              setShowImportCocteles(false);
              setToast(`${items.length} cócteles importados como borradores`);
            } catch (err) {
              setToast('Error al importar cócteles');
              console.error(err);
            }
          }}
        />
      )}

      {editingCocktail && (
        <EditCocktailModal
          cocktail={editingCocktail}
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setEditingCocktail(null); }}
          onSave={async (updated) => {
            if (!supabase) return;
            try {
              const { coctel_ingredientes, id, local_id, ...coctelData } = updated;
              // Columnas base (siempre existen en cocteles)
              const coctelBase = {
                nombre: coctelData.nombre,
                tipo: coctelData.tipo,
                estado: coctelData.estado,
                descripcion: coctelData.descripcion,
                precio: parseFloat(coctelData.precio) || 0,
                foto_url: coctelData.foto_url || null,
              };
              // Columnas fase 2 (requieren migración 003)
              const fase2Cols = {
                historia_coctel: coctelData.historia_coctel || null,
                instrucciones_preparacion: coctelData.instrucciones_preparacion || null,
                cristaleria: coctelData.cristaleria || 'copa',
                guarnicion: coctelData.guarnicion || null,
                tiempo_preparacion: parseInt(coctelData.tiempo_preparacion) || 0,
                alergenos: coctelData.alergenos || null,
                fecha_inicio_temporada: coctelData.fecha_inicio_temporada || null,
                fecha_fin_temporada: coctelData.fecha_fin_temporada || null,
              };
              // Intentar update completo; si falla, usar solo columnas base
              let { error: cErr } = await supabase.from('cocteles').update({ ...coctelBase, ...fase2Cols }).eq('id', id);
              if (cErr) {
                // Columnas fase 2 no existen aún → fallback a columnas base
                console.warn('Fase 2 columns not found, saving base columns only:', cErr.message);
                ({ error: cErr } = await supabase.from('cocteles').update(coctelBase).eq('id', id));
              }
              if (cErr) throw cErr;

              if (coctel_ingredientes && coctel_ingredientes.length > 0) {
                const { error: delErr } = await supabase.from('coctel_ingredientes').delete().eq('coctel_id', updated.id);
                if (delErr) throw delErr;
                const ingsData = coctel_ingredientes.map(i => ({
                  coctel_id: updated.id,
                  producto_id: i.producto_id,
                  nombre: i.nombre,
                  cantidad: i.cantidad,
                  unidad: i.unidad,
                  coste_unitario: i.coste_unitario,
                  opcional: i.opcional || false,
                }));
                const { error: insErr } = await supabase.from('coctel_ingredientes').insert(ingsData);
                if (insErr) throw insErr;
              }
              await fetchCocteles();
              setToast(`"${updated.nombre}" actualizado`);
              setShowEditModal(false);
              setEditingCocktail(null);
            } catch (err) {
              setToast('Error al actualizar cóctel');
              console.error(err);
            }
          }}
        />
      )}

      {/* Tabs */}
      <div style={{ display:'flex', flexWrap:isMobile?'wrap':'nowrap', borderBottom:`1px solid ${C.border2}`, marginBottom:22, overflowX:isMobile?'visible':'auto', gap:isMobile?0:undefined }}>
        {[
          ['clasicos', `CLÁSICOS (${counts.clasicos})`],
          ['autor', `DE AUTOR (${counts.autor})`],
          ['temporada', `TEMPORADA (${counts.temporada})`],
          ['borradores', `BORRADORES (${counts.borradores})`],
          ['revision', `REVISIÓN (${counts.revision})`],
          ['retirados', `RETIRADOS (${counts.retirados})`],
        ].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:isMobile?'8px 12px':'10px 20px', background:'transparent', cursor:'pointer',
            fontFamily:F, fontSize:isMobile?'9px':'10px', letterSpacing:'2px', fontWeight:700, whiteSpace:isMobile?'normal':'nowrap',
            color:tab===id?C.orange:C.textSec, border:'none',
            borderBottom:tab===id?`2px solid ${C.orange}`:'2px solid transparent', marginBottom:'-1px', flex:isMobile?1:0, textAlign:'center',
          }}>{label}</button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:300 }}>
          <div style={{ fontSize:'14px', color:C.textSec }}>⏳ Cargando cócteles...</div>
        </div>
      )}

      {/* Grid */}
      {!loading && (
        visibles.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(4,1fr)', gap:isMobile?12:14 }}>
            {visibles.map(c=>(
              <CocktailCard
                key={c.id}
                cocktail={c}
                onUpdate={updateCoctel}
                onDelete={deleteCoctel}
                onEdit={()=>{ setEditingCocktail(c); setShowEditModal(true); }}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:isMobile?'48px 20px':'64px 20px' }}>
            <div style={{ fontFamily:F, fontSize:'40px', color:C.border2, marginBottom:20 }}>◇</div>
            <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec, letterSpacing:'2px', marginBottom:10 }}>
              {tab==='borradores'?'TODAVÍA NO HAY BORRADORES':'NO HAY CÓCTELES EN ESTA CATEGORÍA'}
            </div>
            {(tab==='borradores'||tab==='clasicos'||tab==='autor')&&(
              <Btn onClick={openForm} sx={{ marginTop:20, padding:'11px 28px', fontSize:'14px' }}>
                <Plus size={14}/> CREAR CÓCTEL
              </Btn>
            )}
          </div>
        )
      )}

      {/* New/Edit Form Modal */}
      {showForm && (
            <Card accent={C.orange} sx={{ padding:isMobile?16:24, marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <span style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>NUEVO CÓCTEL</span>
                <button onClick={resetForm} style={{ background:'none',border:'none',cursor:'pointer',color:C.textSec,display:'flex' }}><X size={16}/></button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 300px', gap:isMobile?16:24 }}>

                {/* Left: fields */}
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>TIPO *</div>
                      <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none' }}
                      >
                        <option value="clasico">CLÁSICO</option>
                        <option value="autor">DE AUTOR</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>ESTADO</div>
                      <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none' }}
                      >
                        <option value="borrador">BORRADOR</option>
                        <option value="activo">ACTIVO</option>
                        <option value="revision">REVISIÓN</option>
                        <option value="temporada">TEMPORADA</option>
                        <option value="retirado">RETIRADO</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>PRECIO DE VENTA (€) *</div>
                      <input value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}
                        placeholder="12.00" type="number" step="0.5" min="0"
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>NOMBRE *</div>
                    <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                      placeholder="Ej: Paradiso Sour"
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>DESCRIPCIÓN / NOTAS</div>
                    <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                      placeholder="Ej: Versión de la casa con Patrón, zumo de lima y sirope de mango"
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'14px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>FOTO DEL CÓCTEL</div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }}/>
                    <Btn variant="outline" onClick={()=>fileInputRef.current?.click()} sx={{ width:'100%', padding:'9px 12px', fontSize:'14px', justifyContent:'center' }}>
                      📷 SUBIR FOTO
                    </Btn>
                  </div>

                  <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:10 }}>INGREDIENTES *</div>

                  {/* Ingredient rows */}
                  {formIngs.length>0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
                      {formIngs.map(fi=>{
                        const db = allIngs.find(d=>d.id===fi.id);
                        const cost = db ? db.cpu * parseFloat(fi.qty) : 0;
                        return (
                          <div key={fi.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:3 }}>
                            <span style={{ flex:1, fontSize:'14px', color:C.text }}>{db?.name}</span>
                            <span style={{ fontSize:'14px', color:C.textSec, minWidth:55 }}>{fi.qty} {db?.unit}</span>
                            <span style={{ fontSize:'14px', color:C.teal, minWidth:52, textAlign:'right', fontWeight:700 }}>€{cost.toFixed(3)}</span>
                            <button onClick={()=>setFormIngs(p=>p.filter(i=>i.uid!==fi.uid))} style={{ background:'none',border:'none',cursor:'pointer',color:'#EF4444',padding:'0 2px',display:'flex' }}>
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        );
                      })}
                      <div style={{ textAlign:'right', fontSize:'14px', color:C.textSec, padding:'4px 0' }}>
                        Subtotal: <span style={{ color:C.orange, fontWeight:700 }}>€{liveCost.toFixed(3)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add ingredient row */}
                  <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:8, alignItems:isMobile?'stretch':'flex-end', position:'relative' }}>
                    <div style={{ flex:1, position:'relative' }}>
                      <input
                        value={ingSearch}
                        onChange={e=>{ setIngSearch(e.target.value); setNewIng(p=>({...p,id:''})); }}
                        placeholder="🔍 Busca (escribe: lim, gin, etc)..."
                        style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:isMobile?'14px':'12px', color:C.text, outline:'none', boxSizing:'border-box' }}
                      />
                      {ingSearch.trim()&&filtered.length>0&&(
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.card, border:`1px solid ${C.border2}`, borderTop:'none', borderRadius:'0 0 3px 3px', maxHeight:200, overflowY:'auto', zIndex:10 }}>
                          {filtered.slice(0,8).map(ing=>(
                            <div key={ing.id} onClick={()=>selectIngredient(ing)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:newIng.id===ing.id?`${C.orange}22`:'transparent', transition:'all 0.1s' }}>
                              <div style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{ing.name}</div>
                              <div style={{ fontSize:'13px', color:C.textSec }}>@{ing.cat} • {ing.unit}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ width:isMobile?'100%':76, flexShrink:0 }}>
                      <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>CANTIDAD</div>
                      <input value={newIng.qty} onChange={e=>setNewIng(p=>({...p,qty:e.target.value}))}
                        onKeyDown={e=>e.key==='Enter'&&addIng()}
                        placeholder="cl / ud" type="number" step="0.5" min="0"
                        style={{ width:'100%', padding:'9px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:isMobile?'14px':'12px', color:C.text, outline:'none' }}
                      />
                    </div>
                    <Btn variant="outline" onClick={addIng} sx={{ padding:'9px 14px', flexShrink:0, alignSelf:isMobile?'auto':'flex-end', width:isMobile?'100%':'auto' }}>
                      <Plus size={13}/> ADD
                    </Btn>
                  </div>
                </div>

                {/* Right: live preview */}
                <div style={{ display:'flex', flexDirection:'column', gap:12, order:isMobile?2:0 }}>
                  {photoPreview && (
                    <Card sx={{ padding:0, overflow:'hidden' }}>
                      <img src={photoPreview} alt="Preview" style={{ width:'100%', height:isMobile?'180px':'200px', objectFit:'cover' }}/>
                    </Card>
                  )}
                  <Card accent={mc} sx={{ padding:isMobile?16:20, flex:1 }}>
                    <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:16 }}>PREVIEW EN TIEMPO REAL</div>

                    <div style={{ marginBottom:14, display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'1fr', gap:isMobile?12:0 }}>
                      <div>
                        <div style={{ fontSize:'13px', color:C.textSec, marginBottom:4 }}>COSTE TOTAL</div>
                        <div style={{ fontSize:isMobile?'24px':'30px', color:C.orange, fontWeight:700, lineHeight:1 }}>€{liveCost.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:'13px', color:C.textSec, marginBottom:4 }}>PRECIO VENTA</div>
                        <div style={{ fontSize:isMobile?'24px':'30px', color:C.text, fontWeight:700, lineHeight:1 }}>
                          {livePrice>0?`€${livePrice.toFixed(2)}`:'—'}
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:14 }}>
                      <div style={{ fontSize:'13px', color:C.textSec, marginBottom:6 }}>MARGEN REAL</div>
                      <div style={{ fontSize:isMobile?'32px':'38px', fontWeight:700, color:mc, lineHeight:1 }}>
                        {livePrice>0?`${liveMargin.toFixed(1)}%`:'—'}
                      </div>
                      {livePrice>0&&liveCost>0&&(
                        <div style={{ fontSize:'14px', color:C.textSec, marginTop:8 }}>
                          Beneficio por copa: <span style={{ color:mc, fontWeight:700 }}>€{(livePrice-liveCost).toFixed(2)}</span>
                        </div>
                      )}
                      {liveMargin>0&&liveMargin<75&&livePrice>0&&(
                        <div style={{ fontSize:'13px', color:C.amber, marginTop:10, lineHeight:'1.5', padding:'8px 10px', background:C.amberBg, borderRadius:3, border:`1px solid ${C.amber}33` }}>
                          ⚠ Margen por debajo del estándar (75%). Considera subir el precio o simplificar la receta.
                        </div>
                      )}
                      {liveMargin>=80&&livePrice>0&&(
                        <div style={{ fontSize:'13px', color:C.teal, marginTop:10, padding:'8px 10px', background:C.tealBg, borderRadius:3, border:`1px solid ${C.teal}33` }}>
                          ✓ Margen saludable para coctelería de autor
                        </div>
                      )}
                    </div>
                  </Card>

                  <div style={{ display:'flex', gap:8, flexDirection:isMobile?'column':'row' }}>
                    <Btn variant="ghost" onClick={resetForm} sx={{ flex:1, justifyContent:'center' }}>CANCELAR</Btn>
                    <Btn
                      disabled={!form.name.trim()||!form.price||formIngs.length===0}
                      onClick={saveForm}
                      sx={{ flex:1, justifyContent:'center' }}
                    >
                      GUARDAR
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          )}
    </div>
  );
}

// ─── SCREEN: HISTORIAL DE PEDIDOS ─────────────────────────────────────────────
function HistorialPedidos() {
  const { localName } = useApp() || {};
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const fetchPedidos = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPedidos(data || []);
    } catch (err) {
      console.error('Error fetching pedidos:', err);
      setToast('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPedidos(); }, []);

  const updateEstado = async (id, nuevoEstado) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
      setToast(`Pedido marcado como ${nuevoEstado.toUpperCase()}`);
    } catch (err) {
      setToast('Error al actualizar estado');
    }
  };

  const estadoConfig = {
    pendiente: { color: C.amber, bg: C.amberBg, label: 'PENDIENTE' },
    enviado:   { color: C.teal,  bg: C.tealBg,  label: 'ENVIADO' },
    recibido:  { color: '#22C55E', bg: '#22C55E15', label: 'RECIBIDO' },
    cancelado: { color: '#EF4444', bg: '#EF444415', label: 'CANCELADO' },
  };

  const canalIcon = { whatsapp: '💬', pdf: '📄', manual: '✋' };

  const filtered = filter === 'all' ? pedidos : pedidos.filter(p => p.estado === filter);

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const parseItems = (items) => {
    try { return typeof items === 'string' ? JSON.parse(items) : items || []; }
    catch { return []; }
  };

  return (
    <div style={{ flex:1, padding: isMobile ? '20px 16px' : '28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>HISTORIAL DE PEDIDOS</h1>
          <p style={{ fontFamily:F, fontSize:'14px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} registrado{pedidos.length !== 1 ? 's' : ''} · {localName}
          </p>
        </div>
        <Btn onClick={fetchPedidos} variant="outline" sx={{ padding:'8px 16px', fontSize:'12px' }}>
          <RefreshCw size={12}/> ACTUALIZAR
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:22 }}>
        {[
          { label:'TOTAL',      value: String(pedidos.length),                                        color:C.teal },
          { label:'PENDIENTES', value: String(pedidos.filter(p=>p.estado==='pendiente').length),       color:C.amber },
          { label:'ENVIADOS',   value: String(pedidos.filter(p=>p.estado==='enviado').length),         color:C.teal },
          { label:'RECIBIDOS',  value: String(pedidos.filter(p=>p.estado==='recibido').length),        color:'#22C55E' },
        ].map(({ label, value, color }, i) => (
          <Card key={i} accent={color} sx={{ padding:'14px 18px', background:`${color}0D` }}>
            <div style={{ fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:'26px', color, fontWeight:700, letterSpacing:'1px', lineHeight:1 }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {[['all','TODOS'],['pendiente','PENDIENTES'],['enviado','ENVIADOS'],['recibido','RECIBIDOS'],['cancelado','CANCELADOS']].map(([id,label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'7px 14px', fontFamily:F, fontSize:'12px', letterSpacing:'1.5px', fontWeight:700,
            cursor:'pointer', borderRadius:3,
            background: filter===id ? C.orange : C.cardAlt,
            color: filter===id ? '#000' : C.textSec,
            border: filter===id ? `1px solid ${C.orange}` : `1px solid ${C.border2}`,
          }}>{label}</button>
        ))}
      </div>

      {/* Pedidos list */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => <Skeleton key={i} height={80}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card sx={{ padding:40, textAlign:'center' }}>
          <ClipboardList size={40} color={C.textSec} style={{ marginBottom:12 }}/>
          <div style={{ fontSize:'14px', color:C.textSec, letterSpacing:'2px' }}>
            {filter === 'all' ? 'No hay pedidos registrados aún' : `No hay pedidos ${filter}s`}
          </div>
        </Card>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(pedido => {
            const ec = estadoConfig[pedido.estado] || estadoConfig.pendiente;
            const items = parseItems(pedido.items);
            const isExpanded = expandedId === pedido.id;

            return (
              <Card key={pedido.id} accent={ec.color} sx={{ overflow:'hidden' }}>
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : pedido.id)}
                  style={{
                    padding:'14px 18px', cursor:'pointer',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    background: ec.bg, borderBottom: isExpanded ? `1px solid ${ec.color}33` : 'none',
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'16px' }}>{canalIcon[pedido.canal] || '📦'}</span>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:'14px', color:C.text, fontWeight:700 }}>{pedido.proveedor}</span>
                        <Badge label={ec.label} color={ec.color} bg={ec.bg}/>
                      </div>
                      <div style={{ fontSize:'12px', color:C.textSec }}>{formatFecha(pedido.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:'13px', color:C.textSec }}>{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                    {isExpanded ? <ChevronUp size={14} color={C.textSec}/> : <ChevronDown size={14} color={C.textSec}/>}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding:'16px 18px' }}>
                    {/* Items table */}
                    <div style={{ marginBottom:16 }}>
                      {items.map((item, idx) => (
                        <div key={idx} style={{
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'8px 0', borderBottom: idx < items.length-1 ? `1px solid ${C.border}` : 'none',
                        }}>
                          <div>
                            <span style={{ fontSize:'14px', color:C.text, fontWeight:600 }}>{item.nombre}</span>
                            {item.categoria && <span style={{ fontSize:'12px', color:C.textSec, marginLeft:8 }}>{item.categoria}</span>}
                          </div>
                          <span style={{ fontSize:'14px', color:C.orange, fontWeight:700 }}>
                            {item.qty} {item.unidad}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap' }}>
                      {pedido.canal && (
                        <div style={{ fontSize:'12px', color:C.textSec }}>
                          <span style={{ letterSpacing:'1.5px' }}>CANAL:</span>{' '}
                          <span style={{ color:C.text, fontWeight:600 }}>{pedido.canal.toUpperCase()}</span>
                        </div>
                      )}
                      {pedido.creado_por && (
                        <div style={{ fontSize:'12px', color:C.textSec }}>
                          <span style={{ letterSpacing:'1.5px' }}>CREADO POR:</span>{' '}
                          <span style={{ color:C.text, fontWeight:600 }}>{pedido.creado_por}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {pedido.estado === 'pendiente' && (
                        <>
                          <Btn variant="teal" onClick={() => updateEstado(pedido.id, 'enviado')} sx={{ padding:'6px 14px', fontSize:'11px' }}>
                            <Send size={11}/> MARCAR ENVIADO
                          </Btn>
                          <Btn variant="outline" onClick={() => updateEstado(pedido.id, 'cancelado')} sx={{ padding:'6px 14px', fontSize:'11px', color:'#EF4444', borderColor:'#EF444444' }}>
                            <X size={11}/> CANCELAR
                          </Btn>
                        </>
                      )}
                      {pedido.estado === 'enviado' && (
                        <Btn variant="teal" onClick={() => updateEstado(pedido.id, 'recibido')} sx={{ padding:'6px 14px', fontSize:'11px' }}>
                          <CheckCircle size={11}/> MARCAR RECIBIDO
                        </Btn>
                      )}
                      {(pedido.estado === 'recibido' || pedido.estado === 'cancelado') && (
                        <span style={{ fontSize:'12px', color:C.textSec, letterSpacing:'1px', fontStyle:'italic' }}>
                          {pedido.estado === 'recibido' ? '✅ Pedido completado' : '❌ Pedido cancelado'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────
function Pricing() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loading, setLoading] = useState(null); // 'monthly' | 'annual' | null

  const handleCheckout = async (priceId, plan) => {
    setLoading(plan);
    // IMPORTANTE: abrir la ventana de forma SINCRÓNICA antes del await
    // Si se abre después del await, el navegador lo bloquea como popup no solicitado
    const newTab = window.open('about:blank', '_blank');
    try {
      // Para el plan mensual, aplicar coupon promocional si está configurado
      const couponId = plan === 'monthly'
        ? (import.meta.env.VITE_STRIPE_COUPON_MONTHLY || null)
        : null;
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, ...(couponId ? { couponId } : {}) }),
      });
      const data = await res.json();
      if (data.url && newTab) {
        newTab.location.href = data.url; // navegar la ventana ya abierta
      } else if (!data.url && newTab) {
        newTab.close(); // cerrar si no hay URL
      }
    } catch (err) {
      console.error('Checkout error:', err);
      if (newTab) newTab.close();
      alert('Error al iniciar checkout. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  const monthlyPrice = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || 'price_1TRNylBJLboiQ0lfk73lPLeu';
  const annualPrice  = import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || 'price_1TRO20BJLboiQ0lfe7vjpMaq';
  // coupon para el trimestre promo (50% off x3 meses) — crear en Stripe Dashboard y poner ID aquí
  // const monthlyCoupon = import.meta.env.VITE_STRIPE_COUPON_MONTHLY || null;

  return (
    <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:isMobile?'28px 16px':'40px 60px', width:'100%' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:isMobile?40:60 }}>
          <div style={{ fontFamily:F, fontSize:isMobile?'24px':'36px', fontWeight:700, color:C.text, marginBottom:12 }}>PLANES BAROPS PRO</div>
          <div style={{ fontFamily:F, fontSize:isMobile?'13px':'14px', color:C.textSec, lineHeight:'1.6' }}>
            Gestiona tu bar con datos en tiempo real. 14 dias de prueba gratis, sin compromiso.
          </div>
          {/* Promo banner — sin emojis */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:18, padding:isMobile?'8px 16px':'8px 24px', background:`linear-gradient(90deg, ${C.orange}18, ${C.purple}18)`, border:`1px solid ${C.orange}44`, borderRadius:2, flexWrap:'wrap', justifyContent:'center' }}>
            <span style={{ fontFamily:F, fontSize:isMobile?'10px':'11px', color:C.orange, fontWeight:700, letterSpacing:'1.5px' }}>
              OFERTA LANZAMIENTO · PRIMER TRIMESTRE AL 50% · SOLO POR TIEMPO LIMITADO
            </span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?24:40, marginBottom:isMobile?40:80 }}>
          {/* Monthly Plan */}
          <Card accent={C.orange} sx={{ padding:isMobile?24:40, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, background:C.orange, filter:'blur(60px)', opacity:0.07, pointerEvents:'none' }}/>
            {/* Badge oferta trimestre — sin emoji */}
            <div style={{ position:'absolute', top:20, right:20 }}>
              <Badge label='OFERTA TRIMESTRAL' color={C.orange} bg={C.orangeBg}/>
            </div>

            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>PLAN</div>
            <div style={{ fontFamily:F, fontSize:isMobile?'22px':'28px', fontWeight:700, color:C.text, marginBottom:12 }}>Mensual</div>

            {/* Precio con oferta trimestral */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
                <span style={{ fontFamily:F, fontSize:'42px', fontWeight:700, color:C.orange }}>€99</span>
                <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>/mes</span>
                <span style={{ fontFamily:F, fontSize:'14px', color:C.textSec, textDecoration:'line-through', marginLeft:4 }}>€199</span>
              </div>
              <div style={{ fontFamily:F, fontSize:'14px', color:C.orange, fontWeight:700, letterSpacing:'0.5px', lineHeight:'1.5' }}>
                Primer trimestre (3 meses) a €99/mes<br/>
                <span style={{ color:C.textSec, fontWeight:400 }}>A partir del 4.° mes: €199/mes</span>
              </div>
            </div>

            <div style={{ fontSize:'14px', color:C.textSec, lineHeight:'1.8', marginBottom:32, paddingBottom:32, borderBottom:`1px solid ${C.border2}` }}>
              <div style={{ marginBottom:8 }}>— Acceso completo a todas las funciones</div>
              <div style={{ marginBottom:8 }}>— Reportes en tiempo real</div>
              <div style={{ marginBottom:8 }}>— Gestion de staff ilimitada</div>
              <div style={{ marginBottom:8 }}>— Base de datos de cocteles</div>
              <div style={{ marginBottom:8 }}>— Agente IA BarOps</div>
              <div>— Soporte prioritario</div>
            </div>

            <Btn
              onClick={() => handleCheckout(monthlyPrice, 'monthly')}
              disabled={!monthlyPrice || !!loading}
              sx={{ width:'100%', justifyContent:'center', padding:'13px 28px', marginBottom:12, fontSize:'14px' }}
            >
              {loading === 'monthly' ? 'ABRIENDO STRIPE...' : 'PROBAR 14 DIAS GRATIS'}
            </Btn>
            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, textAlign:'center', letterSpacing:'0.5px' }}>
              Se requiere tarjeta · Cancela cuando quieras · Se abre en nueva pestana
            </div>
          </Card>

          {/* Annual Plan */}
          <Card accent={C.teal} sx={{ padding:isMobile?24:40, position:'relative', overflow:'hidden', background:`linear-gradient(145deg, #0f1a18 0%, ${C.card} 100%)` }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, background:C.teal, filter:'blur(60px)', opacity:0.1, pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:20, right:20, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
              <Badge label='MAS POPULAR' color={C.teal} bg={C.tealBg}/>
              <Badge label='AHORRA €788/ANO' color={C.teal} bg={C.tealBg}/>
            </div>

            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>PLAN</div>
            <div style={{ fontFamily:F, fontSize:isMobile?'22px':'28px', fontWeight:700, color:C.text, marginBottom:12 }}>Anual</div>

            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
                <span style={{ fontFamily:F, fontSize:'42px', fontWeight:700, color:C.teal }}>€1.600</span>
                <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>/ano</span>
              </div>
              <div style={{ fontFamily:F, fontSize:'14px', color:C.teal, fontWeight:700, lineHeight:'1.5' }}>
                €133/mes · equivale a casi 4 meses gratis<br/>
                <span style={{ display:'inline-block', marginTop:4, background:`${C.teal}22`, border:`1px solid ${C.teal}44`, padding:'1px 8px', borderRadius:2, letterSpacing:'1px' }}>
                  MEJOR PRECIO GARANTIZADO
                </span>
              </div>
            </div>

            <div style={{ fontSize:'14px', color:C.textSec, lineHeight:'1.8', marginBottom:32, paddingBottom:32, borderBottom:`1px solid ${C.border2}` }}>
              <div style={{ marginBottom:8 }}>— Todo lo del plan mensual</div>
              <div style={{ marginBottom:8 }}>— Acceso anticipado a nuevas funciones</div>
              <div style={{ marginBottom:8 }}>— Manager de onboarding dedicado</div>
              <div style={{ marginBottom:8 }}>— Exportacion ilimitada de datos</div>
              <div style={{ marginBottom:8 }}>— Formacion inicial incluida (1h)</div>
              <div>— SLA 99.9% uptime garantizado</div>
            </div>

            <Btn
              variant="teal"
              onClick={() => handleCheckout(annualPrice, 'annual')}
              disabled={!annualPrice || !!loading}
              sx={{ width:'100%', justifyContent:'center', padding:'13px 28px', marginBottom:12, fontSize:'14px', boxShadow:`0 4px 20px ${C.teal}44` }}
            >
              {loading === 'annual' ? 'ABRIENDO STRIPE...' : 'PROBAR 14 DIAS GRATIS'}
            </Btn>
            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, textAlign:'center', letterSpacing:'0.5px' }}>
              Se requiere tarjeta · Cancela cuando quieras · Se abre en nueva pestana
            </div>
          </Card>
        </div>

        {/* Trust footer — sin emojis */}
        <div style={{ textAlign:'center', borderTop:`1px solid ${C.border2}`, paddingTop:40 }}>
          <div style={{ display:'flex', justifyContent:'center', gap:40, marginBottom:24, flexWrap:'wrap' }}>
            {[
              { label:'PAGO SEGURO',       sub:'Encriptacion SSL · Stripe' },
              { label:'SIN PERMANENCIA',   sub:'Cancela en cualquier momento' },
              { label:'SIN SORPRESAS',     sub:'Facturacion 100% transparente' },
              { label:'ACCESO INMEDIATO',  sub:'Activo al completar el pago' },
            ].map((t,i) => (
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700, letterSpacing:'1px', marginBottom:3 }}>{t.label}</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>{t.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec, letterSpacing:'1px' }}>
            Pagos gestionados por <span style={{ fontWeight:700, color:C.text }}>STRIPE</span> · Apple Pay · Google Pay · Tarjeta
          </div>
        </div>
      </div>
    </div>
  );
}






function PaymentSuccess() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('barops_subscription', JSON.stringify({
        status: 'trialing',
        sessionId,
        activatedAt: Date.now(),
      }));
    }
  }, [sessionId]);

  return (
    <div style={{ flex:1, overflow:'auto', padding:'40px 20px', display:'flex', alignItems:'center', justifyContent:'center', background: `radial-gradient(circle at center, ${C.cardAlt} 0%, ${C.bg} 100%)` }}>
      <div style={{ maxWidth:600, width:'100%', textAlign:'center' }}>
        
        {/* Animated/Glowing Icon Area */}
        <div style={{ position:'relative', width:100, height:100, margin:'0 auto 40px' }}>
          <div style={{ position:'absolute', inset:0, background:C.orange, filter:'blur(30px)', opacity:0.2, borderRadius:'50%' }}></div>
          <div style={{ position:'relative', width:'100%', height:'100%', borderRadius:'50%', background:`linear-gradient(135deg, ${C.card} 0%, ${C.cardAlt} 100%)`, border:`1px solid ${C.orange}44`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px ${C.orange}33` }}>
            <Zap size={44} color={C.orange} strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ fontFamily:F, fontSize:'14px', color:C.orange, letterSpacing:'4px', marginBottom:12, fontWeight:700 }}>VERIFICACIÓN COMPLETADA</div>
        <div style={{ fontFamily:F, fontSize:'42px', fontWeight:700, color:C.text, marginBottom:20, letterSpacing:'-1px', textShadow:`0 2px 10px rgba(0,0,0,0.5)` }}>
          Bienvenido a la Élite
        </div>
        
        <div style={{ fontFamily:F, fontSize:'15px', color:C.textSec, marginBottom:40, lineHeight:'1.8', maxWidth:480, margin:'0 auto 40px' }}>
          Tu local acaba de evolucionar. Has desbloqueado el sistema operativo definitivo para hostelería de alto rendimiento. <span style={{ color:C.text }}>Prepárate para tomar el control absoluto.</span>
        </div>

        {/* Digital Membership Card */}
        <Card sx={{ padding:0, marginBottom:36, background:`linear-gradient(145deg, ${C.card} 0%, #111 100%)`, border:`1px solid ${C.border}`, position:'relative', overflow:'hidden', textAlign:'left' }}>
          <div style={{ position:'absolute', top:0, left:0, width:4, bottom:0, background:C.orange }}></div>
          <div style={{ position:'absolute', top:-50, right:-50, width:150, height:150, background:C.orange, filter:'blur(60px)', opacity:0.1 }}></div>
          
          <div style={{ padding:'24px 32px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
              <div>
                <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>MEMBERSHIP STATUS</div>
                <div style={{ fontFamily:F, fontSize:'18px', fontWeight:700, color:C.orange, letterSpacing:'1px' }}>BAROPS PRO ACCESSED</div>
              </div>
              <Badge label="ACTIVO" color={C.teal} bg={C.tealBg} />
            </div>
            
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, borderTop:`1px solid ${C.border2}`, paddingTop:20 }}>
              <div>
                <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>FASE ACTUAL</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text, fontWeight:700 }}>14 DÍAS DE PRUEBA VIP</div>
              </div>
              <div>
                <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>NIVEL DE ACCESO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text, fontWeight:700 }}>ILIMITADO (TIER 1)</div>
              </div>
            </div>
            
            {sessionId && (
              <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border2}88`, letterSpacing:'1px', opacity:0.6 }}>
                AUTH KEY: {sessionId.slice(0,24).toUpperCase()}...
              </div>
            )}
          </div>
        </Card>

        <Btn
          variant="primary"
          sx={{ padding:'16px 40px', fontSize:'14px', letterSpacing:'3px', boxShadow:`0 4px 15px ${C.orange}44`, borderRadius:3 }}
          onClick={() => { window.location.href = '/'; }}
        >
          INICIALIZAR SISTEMA
        </Btn>
      </div>
    </div>
  );
}

// ─── SCREEN: LOCAL ────────────────────────────────────────────────────────────
function Local({ localName, onLocalNameChange }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [formData, setFormData] = useState({ nombre:'', direccion:'', ciudad:'', aforo:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [localPhoto, setLocalPhoto] = useState(localStorage.getItem('barops_local_photo') || '');
  const [prefs, setPrefs] = useState({
    stockAlerts: JSON.parse(localStorage.getItem('barops_stock_alerts') || 'true'),
    shiftNotifs: JSON.parse(localStorage.getItem('barops_shift_notifs') || 'true'),
    compactMode: JSON.parse(localStorage.getItem('barops_compact_mode') || 'false'),
  });

  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchLocalData();
  }, []);

  const fetchLocalData = async () => {
    // Primero cargamos desde localStorage instantáneamente
    const cached = {
      nombre:   localStorage.getItem('barops_local_nombre') || '',
      direccion: localStorage.getItem('barops_local_direccion') || '',
      ciudad:   localStorage.getItem('barops_local_ciudad') || '',
      aforo:    localStorage.getItem('barops_local_aforo') || '',
    };
    if (cached.nombre) setFormData(cached);

    // Luego intentamos leer de Supabase (best-effort)
    try {
      if (!supabase) throw new Error('Sin Supabase');
      const { data, error } = await supabase
        .from('locales')
        .select('nombre, direccion, ciudad, aforo')
        .eq('id', LOCAL_ID)
        .maybeSingle(); // no falla si no existe la fila
      if (!error && data) {
        setFormData({
          nombre:   data.nombre    || cached.nombre,
          direccion: data.direccion || cached.direccion,
          ciudad:   data.ciudad    || cached.ciudad,
          aforo:    data.aforo     || cached.aforo,
        });
      }
    } catch (err) {
      console.warn('Supabase no disponible, usando caché local:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      setToast('El nombre del local no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      // 1. Guardar SIEMPRE en localStorage primero (garantizado)
      localStorage.setItem('barops_local_nombre',    formData.nombre);
      localStorage.setItem('barops_local_direccion', formData.direccion);
      localStorage.setItem('barops_local_ciudad',    formData.ciudad);
      localStorage.setItem('barops_local_aforo',     formData.aforo);
      // Actualizar también la clave que usa la sidebar
      localStorage.setItem('barops_local_name', formData.nombre);
      onLocalNameChange(formData.nombre);

      // 2. Intentar guardar en Supabase (best-effort, no bloquea)
      if (supabase) {
        const { error } = await supabase
          .from('locales')
          .upsert(
            { id: LOCAL_ID, nombre: formData.nombre, direccion: formData.direccion, ciudad: formData.ciudad, aforo: parseInt(formData.aforo) || null },
            { onConflict: 'id' }
          );
        if (error) {
          console.warn('Supabase save warning (datos guardados localmente):', error.message);
          setToast('Guardado localmente ✓  (Supabase: ' + error.message + ')');
          return;
        }
      }

      setToast('Cambios guardados correctamente ✓');
    } catch (err) {
      console.error('Error saving:', err);
      setToast('Guardado localmente ✓ (sin conexión a BD)');
    } finally {
      setSaving(false);
    }
  };


  const togglePref = (key) => {
    const newVal = !prefs[key];
    setPrefs(p => ({...p, [key]: newVal}));
    localStorage.setItem(`barops_${key}`, JSON.stringify(newVal));
  };

  if (loading) {
    return (
      <div style={{ flex:1, padding:isMobile?'20px 16px':'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO...</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:isMobile?'20px 16px':'28px 32px', overflowY:'auto', overflowX:'hidden', fontFamily:F, width:'100%' }}>
      {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}

      <div style={{ marginBottom:isMobile?20:32 }}>
        <h1 style={{ fontFamily:F, fontSize:isMobile?'16px':'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0, marginBottom:8 }}>CONFIGURACIÓN LOCAL</h1>
        <p style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', margin:0 }}>
          Gestiona la información de tu establecimientos y preferencias del sistema
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:isMobile?16:24, marginBottom:isMobile?20:32 }}>
        <Card sx={{ padding:isMobile?16:24 }}>
          <h2 style={{ fontFamily:F, fontSize:isMobile?'12px':'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px', marginBottom:isMobile?14:18 }}>PERFIL DEL LOCAL</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:80, height:80, borderRadius:8, background:C.cardAlt, border:`2px dashed ${C.border2}`, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {localPhoto ? (
                  <img src={localPhoto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                ) : (
                  <Store size={32} color={C.textSec}/>
                )}
              </div>
              <label style={{ display:'inline-block', padding:'8px 16px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'13px', color:C.text, letterSpacing:'1px', fontWeight:700 }}>
                SUBIR FOTO
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result;
                        setLocalPhoto(result);
                        localStorage.setItem('barops_local_photo', result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display:'none' }}
                />
              </label>
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>NOMBRE</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData(p=>({...p, nombre:e.target.value}))}
                style={{ width:'100%', padding:isMobile?'8px 10px':'10px 12px', fontFamily:F, fontSize:isMobile?'12px':'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>DIRECCIÓN</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData(p=>({...p, direccion:e.target.value}))}
                style={{ width:'100%', padding:isMobile?'8px 10px':'10px 12px', fontFamily:F, fontSize:isMobile?'12px':'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>CIUDAD</label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData(p=>({...p, ciudad:e.target.value}))}
                style={{ width:'100%', padding:isMobile?'8px 10px':'10px 12px', fontFamily:F, fontSize:isMobile?'12px':'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>AFORO</label>
              <input
                type="number"
                value={formData.aforo}
                onChange={(e) => setFormData(p=>({...p, aforo:parseInt(e.target.value) || 0}))}
                style={{ width:'100%', padding:isMobile?'8px 10px':'10px 12px', fontFamily:F, fontSize:isMobile?'12px':'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <Btn
              onClick={handleSave}
              disabled={saving}
              sx={{ width:'100%', marginTop:8, justifyContent:'center', padding:'10px', fontSize:'14px' }}
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
            </Btn>
          </div>
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap:isMobile?16:24 }}>
          <Card sx={{ padding:isMobile?16:24 }}>
            <h2 style={{ fontFamily:F, fontSize:isMobile?'12px':'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px', marginBottom:isMobile?14:18 }}>PLAN ACTUAL</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>PLAN</div>
                <div style={{ fontFamily:F, fontSize:'16px', color:C.orange, fontWeight:700, letterSpacing:'2px' }}>PRO</div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:12 }}>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>ESTADO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.teal, fontWeight:700 }}>ACTIVO</div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:12 }}>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>INICIO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text }}>29 de abril, 2026</div>
              </div>
            </div>
          </Card>

          <Card sx={{ padding:isMobile?16:24 }}>
            <h2 style={{ fontFamily:F, fontSize:isMobile?'12px':'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px', marginBottom:isMobile?14:18 }}>PREFERENCIAS</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'stockAlerts', label:'Alertas de stock crítico' },
                { key:'shiftNotifs', label:'Notificaciones de turnos' },
                { key:'compactMode', label:'Modo compacto de inventario' }
              ].map(({ key, label }) => (
                <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, borderBottom:`1px solid ${C.border2}` }}>
                  <span style={{ fontFamily:F, fontSize:'14px', color:C.text }}>{label}</span>
                  <button
                    onClick={() => togglePref(key)}
                    style={{
                      width:36, height:20, borderRadius:10, border:'none', cursor:'pointer',
                      background: prefs[key] ? C.teal : C.border2,
                      position:'relative', transition:'all 0.2s'
                    }}
                  >
                    <div style={{
                      width:16, height:16, borderRadius:'50%', background:C.bg, position:'absolute',
                      top:2, left: prefs[key] ? 18 : 2, transition:'left 0.2s'
                    }}/>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

// ─── DRAWER: LOCAL SETTINGS ───────────────────────────────────────────────────

function CartDrawer({ isOpen, onClose }) {
  const { cartItems, setCartItems, localName, customInv, userRole, savePedido } = useApp() || {};
  const [searchQuery, setSearchQuery] = useState('');
  
  if (!isOpen) return null;

  const getProvGroup = (item) => {
    const cat = item.categoria || '';
    const l = cat.toLowerCase();
    if (['ginebra','vodka','ron','whisky','tequila','mezcal','brandy','cognac','destilado','licor','vermut','amaro','bitter','aperitivo','espumoso','vino','cava','champagne','cerveza'].some(w=>l.includes(w))) return 'Proveedor de Bebidas y Destilados';
    if (['fruta','fresco','fresca','zumo','jugo','citrico','hierba','flor','vegetal', 'limones'].some(w=>l.includes(w))) return 'Proveedor de Frutas y Frescos';
    if (['seco','fruto seco','deshidratado','especia','semilla','polvo'].some(w=>l.includes(w))) return 'Proveedor de Secos y Especias';
    if (['texturizante','gelificante','emulsionante','agar','lecitina','xantana'].some(w=>l.includes(w))) return 'Proveedor de Texturizantes';
    if (['mixer','tonica','soda','ginger','agua','refresco','sirope','jarabe','azucar'].some(w=>l.includes(w))) return 'Proveedor de Mixers y Refrescos';
    return item.proveedor || 'Proveedor General / Otros';
  };

  const grouped = (cartItems || []).reduce((acc, item) => {
    const prov = getProvGroup(item);
    if (!acc[prov]) acc[prov] = [];
    acc[prov].push(item);
    return acc;
  }, {});

  const handleRemove = (id) => setCartItems(prev => prev.filter(i => i.id !== id));
  const handleUpdateQty = (id, delta) => {
    setCartItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = (i.qty || 1) + delta;
        return newQty <= 0 ? null : { ...i, qty: newQty };
      }
      return i;
    }).filter(Boolean));
  };
  
  const handleManualAdd = (item) => {
    setCartItems(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
    setSearchQuery('');
  };

  const searchResults = searchQuery.trim() ? (customInv || []).filter(i => i && i.nombre && i.nombre.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5) : [];
  
  const pedidoId = () => 'PED-' + Date.now().toString(36).toUpperCase();

  const handleSavePedido = async (prov, canal) => {
    if (savePedido) {
      await savePedido({
        proveedor: prov,
        items: grouped[prov],
        canal: canal,
      });
    }
  };

  const handleConfirmarTodo = async () => {
    for (const prov of Object.keys(grouped)) {
      await handleSavePedido(prov, 'manual');
    }
    setCartItems([]);
    onClose();
  };

  const handlePrint = async (prov) => {
    await handleSavePedido(prov, 'pdf');
    const pid = pedidoId();
    const fecha = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' });
    const hora = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
        <head>
          <title>Pedido ${pid} - ${prov}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; color: #1a1a1a; }
            .header { background: #0a0a0a; color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
            .header-left h1 { font-size: 22px; font-weight: 900; letter-spacing: 4px; color: #FF6B35; }
            .header-left p { font-size: 11px; color: #888; letter-spacing: 2px; margin-top: 4px; }
            .header-right { text-align: right; font-size: 12px; color: #aaa; }
            .header-right .pid { font-size: 14px; color: #FF6B35; font-weight: 700; letter-spacing: 1px; }
            .meta { padding: 24px 40px; background: #f8f8f8; border-bottom: 2px solid #eee; display: flex; justify-content: space-between; }
            .meta-item { font-size: 12px; color: #555; }
            .meta-item strong { display: block; font-size: 16px; color: #1a1a1a; margin-top: 4px; }
            .content { padding: 32px 40px; }
            .content h2 { font-size: 13px; letter-spacing: 3px; color: #888; margin-bottom: 16px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            thead th { background: #0a0a0a; color: #FF6B35; padding: 12px 14px; font-size: 11px; letter-spacing: 2px; font-weight: 700; text-align: left; }
            tbody td { padding: 14px; border-bottom: 1px solid #eee; font-size: 14px; }
            tbody tr:hover { background: #fafafa; }
            .num { color: #FF6B35; font-weight: 700; width: 40px; }
            .qty { font-weight: 700; color: #0a0a0a; }
            .unit { color: #888; font-size: 12px; }
            .footer { margin-top: 48px; padding: 24px 40px; border-top: 2px solid #eee; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #aaa; }
            .footer .brand { display: flex; align-items: center; gap: 8px; }
            .footer .brand span { color: #FF6B35; font-weight: 900; letter-spacing: 3px; font-size: 13px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <h1>BAROPS</h1>
              <p>SISTEMA OPERATIVO DEL BAR</p>
            </div>
            <div class="header-right">
              <div class="pid">${pid}</div>
              <div>${fecha} · ${hora}</div>
            </div>
          </div>
          <div class="meta">
            <div class="meta-item">ESTABLECIMIENTO<strong>${localName}</strong></div>
            <div class="meta-item">PROVEEDOR<strong>${prov}</strong></div>
            <div class="meta-item">PRODUCTOS<strong>${grouped[prov].length} líneas</strong></div>
          </div>
          <div class="content">
            <h2>DETALLE DEL PEDIDO</h2>
            <table>
              <thead><tr><th class="num">#</th><th>PRODUCTO</th><th>CATEGORÍA</th><th>CANTIDAD</th></tr></thead>
              <tbody>
                ${grouped[prov].map((item, idx) => `
                  <tr>
                    <td class="num">${idx + 1}</td>
                    <td>${item.nombre}</td>
                    <td>${item.categoria || '-'}</td>
                    <td><span class="qty">${item.qty}</span> <span class="unit">${item.unidad}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="footer">
            <div class="brand"><span>BAROPS</span> · Generado automáticamente</div>
            <div>${pid} · ${fecha}</div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleWhatsapp = async (prov) => {
    await handleSavePedido(prov, 'whatsapp');
    const items = grouped[prov];
    const tel = items[0]?.telefono_proveedor;
    let msg = `Hola, necesitamos el siguiente pedido para ${localName}:\n\n`;
    items.forEach(i => msg += `- ${i.nombre}: ${i.qty} ${i.unidad}\n`);
    msg = encodeURIComponent(msg);
    if (tel) window.open(`https://wa.me/${tel.replace(/\s+/g,'')}?text=${msg}`, '_blank');
    else { navigator.clipboard?.writeText(decodeURIComponent(msg)); alert('Copiado al portapapeles'); }
  };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', zIndex:9999, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)' }} onClick={onClose} />
      <div style={{ position:'relative', width:'100%', maxWidth:400, height:'100%', background:C.bg, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column', animation:'slideInRight 0.3s forwards' }}>
        <div style={{ padding:20, borderBottom:`1px solid ${C.border2}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:16, letterSpacing:2, color:C.text }}>🛒 CARRITO DE PEDIDOS</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:C.textSec, cursor:'pointer' }}><X size={20}/></button>
        </div>
        <div style={{ flex:1, minHeight: 0, overflowY:'auto', padding:20 }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ color:C.textSec, fontSize:14, textAlign:'center', marginTop:40 }}>El carrito está vacío</div>
          ) : (
            Object.entries(grouped).map(([prov, items]) => (
              <div key={prov} style={{ marginBottom: 30, background: C.cardAlt, padding: 16, borderRadius: 8, border: `1px solid ${C.border2}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.orange, marginBottom: 12 }}>{prov}</div>
                {items.map(item => (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', color:C.text }}>{item.nombre}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ display:'flex', alignItems:'center', background:C.bg, borderRadius:16, border:`1px solid ${C.border2}`, padding:'2px' }}>
                        <button onClick={()=>handleUpdateQty(item.id, -1)} style={{ background:'none', border:'none', color:C.textSec, cursor:'pointer', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center' }}>-</button>
                        <span style={{ fontSize:'13px', color:C.teal, fontWeight:700, minWidth:20, textAlign:'center' }}>{item.qty}</span>
                        <button onClick={()=>handleUpdateQty(item.id, 1)} style={{ background:'none', border:'none', color:C.textSec, cursor:'pointer', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                      </div>
                      <span style={{ fontSize:'12px', color:C.textSec, width:40 }}>{item.unidad}</span>
                      <button onClick={()=>handleRemove(item.id)} style={{ background:'none', border:'none', color:C.red, cursor:'pointer', padding:4 }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
                {userRole === 'manager' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={() => handleWhatsapp(prov)} style={{ flex: 1, padding: '8px', background: C.teal, color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>WHATSAPP</button>
                    <button onClick={() => handlePrint(prov)} style={{ flex: 1, padding: '8px', background: C.card, border: `1px solid ${C.border2}`, color: C.text, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>PDF / IMPRIMIR</button>
                  </div>
                )}
              </div>
            ))
          )}
          {userRole === 'manager' && Object.keys(grouped).length > 0 && (
            <div style={{ padding: '0 20px 16px' }}>
              <button onClick={handleConfirmarTodo} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #FF6B35, #E85A25)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 800, letterSpacing: '2px', color: '#000', boxShadow: '0 4px 12px rgba(255,107,53,0.3)' }}>CONFIRMAR Y GUARDAR PEDIDO</button>
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, padding: '0 20px 20px', borderTop: `1px solid ${C.border2}`, paddingTop: 20 }}>
          <div style={{ fontSize: 13, color: C.textSec, marginBottom: 8, letterSpacing: '1px', fontWeight: 700 }}>AÑADIR PRODUCTO EXTRA</div>
          <div style={{ position: 'relative' }}>
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar en tu inventario..." 
              style={{ width: '100%', padding: '10px 12px', background: C.cardAlt, border: `1px solid ${C.border2}`, borderRadius: 4, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: F, fontSize: 13 }}
            />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '100%', background: C.card, border: `1px solid ${C.border2}`, borderRadius: 4, zIndex: 10, maxHeight: 150, overflowY: 'auto', marginBottom: 4, boxShadow: '0 -4px 12px rgba(0,0,0,0.2)' }}>
                {searchResults.map(res => (
                  <div key={res.id} onClick={() => handleManualAdd(res)} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border2}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: C.text, fontSize: 13 }}>{res.nombre}</div>
                    <button style={{ background: 'transparent', border: 'none', color: C.teal, cursor: 'pointer', display: 'flex' }}><Plus size={16}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocalDrawer({ isOpen, onClose, localName, onLocalNameChange }) {
  const [tab, setTab] = useState('perfil');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  // PERFIL tab state
  const [perfil, setPerfil] = useState({
    nombre: '', tipo: 'Coctelería', direccion: '', ciudad: '', 
    telefono: '', email: '', aforo: '', logo_filename: ''
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [operativo, setOperativo] = useState({
    umbral_dias: 3, proveedor: '', telefono_proveedor: ''
  });
  
  // PREFS tab state
  const [prefs, setPrefs] = useState({
    stock_alerts: true, shift_alerts: true, weekly_report: false,
    compact_mode: false, weekly_day: 'Lunes'
  });
  const [users, setUsers] = useState([{ id:1, email:'admin@barops.es', rol:'ADMIN', avatar:'AB' }]);
  const [inviteEmail, setInviteEmail] = useState('');

  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const fetchData = async () => {
    // Cargar desde localStorage inmediatamente
    const cached = JSON.parse(localStorage.getItem('barops_perfil') || '{}');
    if (cached.nombre) setPerfil(p => ({...p, ...cached}));
    
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const { data, error } = await supabase
        .from('locales')
        .select('*')
        .eq('id', LOCAL_ID)
        .maybeSingle(); // no falla si la fila no existe aún

      if (!error && data) {
        const perfilData = {
          nombre: data.nombre || cached.nombre || '',
          tipo: data.tipo || cached.tipo || 'Coctelería',
          direccion: data.direccion || cached.direccion || '',
          ciudad: data.ciudad || cached.ciudad || '',
          telefono: data.telefono || cached.telefono || '',
          email: data.email || cached.email || '',
          aforo: data.aforo || cached.aforo || '',
          logo_filename: data.logo_filename || cached.logo_filename || ''
        };
        setPerfil(perfilData);
        setLogoPreview(data.logo_filename ? getPublicLogoUrl(data.logo_filename) : (cached.logoPreview || ''));
      }
      
      const config = JSON.parse(localStorage.getItem('barops_config') || '{}');
      setOperativo({
        umbral_dias: config.umbral_dias || 3,
        proveedor: config.proveedor || '',
        telefono_proveedor: config.telefono_proveedor || ''
      });
      
      const savedPrefs = JSON.parse(localStorage.getItem('barops_prefs') || '{}');
      setPrefs(p => ({...p, ...savedPrefs}));
      
      setLoading(false);
    } catch (err) {
      console.warn('Error fetching local data (usando caché):', err.message);
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) {
      setToast('Selecciona una imagen');
      return;
    }

    if (!supabase) {
      setToast('Supabase no conectado');
      console.error('Supabase client not initialized');
      return;
    }

    try {
      // Read file as data URL for immediate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      const ext = file.name.split('.').pop();
      const filename = `${LOCAL_ID}-logo-${Date.now()}.${ext}`;

      // Upload to storage with proper error handling
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(filename, file, { upsert: true });

      if (error) {
        console.error('Storage upload error:', error);
        setToast(`Error: ${error.message}`);
        return;
      }

      // Save filename to perfil state (will be saved to DB on handleSavePerfil)
      setPerfil(p => ({...p, logo_filename: filename}));
      setToast('Logo subido ✓');
    } catch (err) {
      console.error('Error uploading logo:', err);
      setToast(`Error: ${err.message || 'Error al subir logo'}`);
    }
  };

  const handleSavePerfil = async () => {
    if (!perfil.nombre?.trim()) {
      setToast('El nombre del local es obligatorio');
      return;
    }
    setSaving(true);
    try {
      // 1. SIEMPRE guardar en localStorage primero
      const perfilToSave = {
        nombre: perfil.nombre, tipo: perfil.tipo, direccion: perfil.direccion,
        ciudad: perfil.ciudad, telefono: perfil.telefono, email: perfil.email,
        aforo: perfil.aforo, logo_filename: perfil.logo_filename || '',
        logoPreview: logoPreview
      };
      localStorage.setItem('barops_perfil', JSON.stringify(perfilToSave));
      localStorage.setItem('barops_local_nombre', perfil.nombre);
      localStorage.setItem('barops_local_name', perfil.nombre);
      localStorage.setItem('barops_config', JSON.stringify(operativo));
      onLocalNameChange(perfil.nombre);

      // 2. Guardar en Supabase con upsert (funciona aunque la fila no exista)
      if (supabase) {
        const updateData = {
          id: LOCAL_ID,
          nombre: perfil.nombre,
          tipo: perfil.tipo,
          direccion: perfil.direccion,
          ciudad: perfil.ciudad,
          telefono: perfil.telefono,
          email: perfil.email,
          aforo: parseInt(perfil.aforo) || null,
          logo_filename: perfil.logo_filename || null
        };

        const { error } = await supabase
          .from('locales')
          .upsert(updateData, { onConflict: 'id' });

        if (error) {
          console.warn('Supabase warning (guardado local OK):', error.message);
          setToast(`Guardado localmente ✓ (BD: ${error.message})`);
          return;
        }
      }

      setToast('Cambios guardados ✓');
    } catch (err) {
      console.error('Error saving perfil:', err);
      setToast('Guardado localmente ✓ (sin conexión a BD)');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      localStorage.setItem('barops_prefs', JSON.stringify(prefs));
      setToast('Preferencias guardadas ✓');
    } catch (err) {
      setToast('Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  const handleExportInventario = async () => {
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const { data, error } = await supabase.from('productos').select('*').eq('local_id', LOCAL_ID);
      if (error) throw error;
      if (!data || data.length === 0) { setToast('No hay productos para exportar'); return; }
      
      const headers = ['Nombre', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Unidad', 'Coste Unitario'];
      const rows = data.map(p => [p.nombre, p.categoria || '', p.stock_actual || 0, p.stock_minimo || 0, p.unidad || '', p.coste_unitario || 0]);
      const csv = generateCSV(headers, rows);
      downloadCSV(csv, `barops-inventario-${formatDateISO()}.csv`);
      setToast('Inventario exportado ✓');
    } catch (err) {
      console.error('Error exporting inventario:', err);
      setToast('Error al exportar');
    }
  };

  const handleExportMovimientos = async () => {
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const { data, error } = await supabase.from('movimientos_stock')
        .select('*').eq('local_id', LOCAL_ID).gte('fecha', formatDateISO(startDate));
      if (error) throw error;
      if (!data || data.length === 0) { setToast('Aún no hay movimientos registrados'); return; }
      
      const headers = ['Fecha', 'Producto ID', 'Tipo', 'Cantidad', 'Motivo'];
      const rows = data.map(m => [m.fecha, m.producto_id, m.tipo, m.cantidad, m.motivo || '']);
      const csv = generateCSV(headers, rows);
      downloadCSV(csv, `barops-movimientos-${formatDateISO()}.csv`);
      setToast('Movimientos exportados ✓');
    } catch (err) {
      console.error('Error exporting movimientos:', err);
      setToast('Error al exportar');
    }
  };

  const handleExportMerma = async () => {
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const { data, error } = await supabase.from('inventario_fisico_items')
        .select('*, inventarios_fisicos(fecha_conteo)').eq('inventarios_fisicos.local_id', LOCAL_ID);
      if (error) throw error;
      if (!data || data.length === 0) { setToast('Aún no hay inventarios físicos completados'); return; }
      
      const headers = ['Producto ID', 'Cantidad Teórica', 'Cantidad Real', 'Diferencia', 'Fecha Conteo'];
      const rows = data.map(item => [
        item.producto_id,
        item.cantidad_teorica,
        item.cantidad_real,
        item.diferencia,
        item.inventarios_fisicos?.fecha_conteo || ''
      ]);
      const csv = generateCSV(headers, rows);
      downloadCSV(csv, `barops-merma-${formatDateISO()}.csv`);
      setToast('Informe de merma exportado ✓');
    } catch (err) {
      console.error('Error exporting merma:', err);
      setToast('Error al exportar');
    }
  };

  const handleInviteUser = () => {
    if (!inviteEmail.trim()) { setToast('Ingresa un email válido'); return; }
    setToast(`Invitación enviada a ${inviteEmail}`);
    setInviteEmail('');
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#00000066', zIndex:998, transition:'opacity 0.2s' }}/>
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:'420px', background:C.card, borderLeft:`1px solid ${C.border}`, zIndex:999, display:'flex', flexDirection:'column', boxShadow:'-8px 0 24px rgba(0,0,0,0.3)' }}>
        
        {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}
        
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontFamily:F, fontSize:'14px', fontWeight:700, letterSpacing:'2.5px', color:C.text, margin:0 }}>CONFIGURACIÓN</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <X size={18} color={C.textSec}/>
          </button>
        </div>

        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}`, padding:'0 4px' }}>
          {['perfil', 'equipo', 'datos'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'14px 12px', background:'none', border:'none', cursor:'pointer',
              borderBottom:`2px solid ${tab === t ? C.orange : 'transparent'}`,
              fontFamily:F, fontSize:'13px', color:tab === t ? C.orange : C.textSec, letterSpacing:'2px', fontWeight:tab === t ? 700 : 400,
              transition:'all 0.2s', textTransform:'uppercase'
            }}>
              {t === 'perfil' ? 'PERFIL' : t === 'equipo' ? 'EQUIPO' : 'DATOS'}
            </button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:C.teal }}>CARGANDO...</div>
          ) : tab === 'perfil' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ width:100, height:100, margin:'0 auto 12px', borderRadius:8, background:C.cardAlt, border:`2px dashed ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  {logoPreview ? <img src={logoPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Store size={40} color={C.textSec}/>}
                </div>
                <label style={{ display:'inline-block', padding:'8px 14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'13px', color:C.text, letterSpacing:'1px', fontWeight:700 }}>
                  SUBIR LOGO
                  <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} style={{ display:'none' }}/>
                </label>
              </div>
              {['nombre', 'tipo', 'direccion', 'ciudad', 'telefono', 'email', 'aforo'].map(field => (
                <div key={field}>
                  <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>{field}</label>
                  {field === 'tipo' ? (
                    <select value={perfil[field]} onChange={(e) => setPerfil(p => ({...p, [field]:e.target.value}))} 
                      style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text }}>
                      {['Coctelería', 'Bar', 'Restaurante-Bar', 'Club', 'Otro'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={field === 'email' ? 'email' : field === 'aforo' ? 'number' : 'text'} value={perfil[field]} onChange={(e) => setPerfil(p => ({...p, [field]:e.target.value}))} style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}/>
                  )}
                </div>
              ))}
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:14, marginTop:8 }}>
                <h3 style={{ fontFamily:F, fontSize:'13px', color:C.orange, letterSpacing:'2px', fontWeight:700, marginBottom:12 }}>CONFIGURACIÓN OPERATIVA</h3>
                {['umbral_dias', 'proveedor', 'telefono_proveedor'].map(field => (
                  <div key={field} style={{ marginBottom:10 }}>
                    <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>{field === 'umbral_dias' ? 'Umbral Stock Crítico (días)' : field === 'proveedor' ? 'Proveedor Principal' : 'Teléfono Proveedor'}</label>
                    <input type={field === 'umbral_dias' ? 'number' : 'text'} value={operativo[field]} onChange={(e) => setOperativo(p => ({...p, [field]:e.target.value}))} style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}/>
                  </div>
                ))}
              </div>
              <button onClick={handleSavePerfil} disabled={saving} style={{ width:'100%', padding:'12px', background:C.orange, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:'#000', fontWeight:700, letterSpacing:'2px', transition:'opacity 0.2s', opacity:saving ? 0.6 : 1 }}>GUARDAR CAMBIOS</button>
            </div>
          ) : tab === 'equipo' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <h3 style={{ fontFamily:F, fontSize:'13px', color:C.teal, letterSpacing:'2px', fontWeight:700, marginBottom:12 }}>EQUIPO DE ACCESO</h3>
                {users.map(u => (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', background:C.cardAlt, borderRadius:4, marginBottom:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:C.orange, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F, fontSize:'14px', fontWeight:700, color:'#000', flexShrink:0 }}>{u.avatar}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:F, fontSize:'14px', color:C.text }}>{u.email}</div>
                      <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec }}>{u.rol}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ fontFamily:F, fontSize:'13px', color:C.purple, letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>INVITAR USUARIO</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex:1, padding:'10px 12px', fontFamily:F, fontSize:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}/>
                  <button onClick={handleInviteUser} style={{ padding:'10px 14px', background:C.purple, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:'#fff', fontWeight:700 }}>ENVIAR</button>
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:14 }}>
                <h3 style={{ fontFamily:F, fontSize:'13px', color:C.amber, letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>PREFERENCIAS</h3>
                {[{key:'stock_alerts', label:'Alertas de stock crítico'}, {key:'shift_alerts', label:'Alertas de turnos'}, {key:'weekly_report', label:'Informe semanal'}, {key:'compact_mode', label:'Modo compacto'}].map(item => (
                  <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border2}` }}>
                    <span style={{ fontFamily:F, fontSize:'14px', color:C.text }}>{item.label}</span>
                    <button onClick={() => setPrefs(p => ({...p, [item.key]:!p[item.key]}))} style={{ width:44, height:24, borderRadius:12, background:prefs[item.key] ? C.orange : '#333', border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative' }}>
                      <div style={{ position:'absolute', width:20, height:20, borderRadius:'50%', background:'#fff', top:2, left:prefs[item.key] ? 22 : 2, transition:'left 0.2s' }}/>
                    </button>
                  </div>
                ))}
                <div style={{ marginTop:14 }}>
                  <label style={{ display:'block', fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>Día del Informe Semanal</label>
                  <select value={prefs.weekly_day} onChange={(e) => setPrefs(p => ({...p, weekly_day:e.target.value}))} style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text }}>
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleSavePrefs} disabled={saving} style={{ width:'100%', padding:'12px', background:C.orange, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:'#000', fontWeight:700, letterSpacing:'2px', transition:'opacity 0.2s', opacity:saving ? 0.6 : 1, marginTop:12 }}>GUARDAR PREFERENCIAS</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button onClick={handleExportInventario} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s', hover:{background:C.orange} }}>📊 EXPORTAR INVENTARIO CSV</button>
              <button onClick={handleExportMovimientos} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s' }}>📈 EXPORTAR MOVIMIENTOS CSV</button>
              <button onClick={handleExportMerma} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'14px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s' }}>📉 EXPORTAR INFORME MERMA CSV</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── COMPONENTES MÓVIL ────────────────────────────────────────────────────────

function MobileTopBar({ screen, localName }) {
  const { cartItems, setShowCartDrawer } = useApp() || {};
  const screenLabels = {
    dashboard: 'DASHBOARD', inventario: 'INVENTARIO', staffing: 'STAFFING',
    agente: 'AGENTE IA', analytics: 'ANALYTICS', carta: 'CARTA',
    pricing: 'BILLING', success: 'PAGO', local: 'LOCAL'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56,
      background: C.cardAlt, borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: `env(safe-area-inset-top)`,
      paddingLeft: `max(16px, env(safe-area-inset-left))`,
      paddingRight: `max(16px, env(safe-area-inset-right))`,
      boxSizing: 'border-box',
      zIndex: 100, fontFamily: F
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden',
          background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255, 107, 53, 0.3)'
        }}>
          <img src="/logo.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
        </div>
        <div style={{ fontSize: 11, letterSpacing: 2, color: C.text, fontWeight: 700 }}>
          {screenLabels[screen] || 'BAROPS'}
        </div>
      </div>

      <Bell size={20} color={C.textSec} style={{ cursor: 'pointer' }} />
    </div>
  );
}

function MobileBottomNav({ active, setActive, onMoreOpen }) {
  const navItems = [
    { id: 'dashboard', Icon: LayoutDashboard, label: 'INICIO' },
    { id: 'inventario', Icon: Package, label: 'STOCK' },
    { id: 'carta', Icon: BookOpen, label: 'CARTA' },
    { id: 'agente', Icon: Bot, label: 'IA' },
    { id: 'more', Icon: Menu, label: 'MÁS', isMore: true }
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 60, background: C.cardAlt, borderTop: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      paddingBottom: `env(safe-area-inset-bottom)`,
      paddingLeft: `max(0, env(safe-area-inset-left))`,
      paddingRight: `max(0, env(safe-area-inset-right))`,
      boxSizing: 'border-box',
      zIndex: 100, fontFamily: F
    }}>
      {navItems.map(({ id, Icon, label, isMore }) => (
        <button key={id} onClick={() => {
          if (isMore) onMoreOpen();
          else { setActive(id); if (navigator.vibrate) navigator.vibrate(10); }
        }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '8px 4px', minHeight: 44,
          transition: 'all 150ms', color: active === id && !isMore ? C.orange : '#444'
        }}>
          <Icon size={22} style={{ marginBottom: 3 }} />
          <div style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700 }}>{label}</div>
        </button>
      ))}
    </div>
  );
}

function MobileDrawer({ isOpen, onClose, active, setActive, localName, onOpenLocalSettings, onLogout }) {
  const NAV = [
    { id: 'dashboard', Icon: LayoutDashboard, label: 'DASHBOARD' },
    { id: 'inventario', Icon: Package, label: 'INVENTARIO' },
    { id: 'historial', Icon: ClipboardList, label: 'PEDIDOS' },
    { id: 'staffing', Icon: Users, label: 'STAFFING' },
    { id: 'agente', Icon: Bot, label: 'AGENTE IA' },
    { id: 'analytics', Icon: BarChart2, label: 'ANALYTICS' },
    { id: 'carta', Icon: BookOpen, label: 'CARTA' },
    { id: 'pricing', Icon: CreditCard, label: 'BILLING' },
  ];

  const handleNavClick = (id) => {
    setActive(id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 200, animation: 'fadeIn 0.2s'
      }} />
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 280,
        background: C.card, zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.25s ease-out',
        paddingTop: `env(safe-area-inset-top)`
      }}>
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${C.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} alt="Logo" />
            <div style={{ fontSize: 24, fontWeight: 700, color: C.orange, letterSpacing: 7 }}>BAROPS</div>
          </div>
          <div style={{ fontSize: 9, color: C.textSec, letterSpacing: 3, marginTop: 8 }}>MÓVIL</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV.map(({ id, Icon, label }) => {
            const on = active === id;
            return (
              <div key={id} onClick={() => handleNavClick(id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px',
                cursor: 'pointer', background: on ? `${C.orange}12` : 'transparent',
                borderLeft: on ? `2px solid ${C.orange}` : '2px solid transparent',
                transition: 'all 0.12s'
              }}>
                <Icon size={14} color={on ? C.orange : C.textSec} />
                <span style={{
                  fontSize: 11, letterSpacing: 2.5, color: on ? C.orange : C.textSec,
                  fontWeight: on ? 700 : 400
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </nav>

        <div style={{ padding: '16px 22px', borderTop: `1px solid ${C.border2}` }}>
          <button onClick={() => { onOpenLocalSettings?.(); onClose(); }}
            style={{
              width: '100%', padding: '10px 14px', background: C.cardAlt,
              border: `1px solid ${C.border2}`, borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 11,
              fontFamily: F, color: C.orange, fontWeight: 700, marginBottom: 12
            }}>
            <Store size={14} color={C.orange} />
            CONFIGURACIÓN
          </button>
          <button onClick={() => { onLogout?.(); onClose(); }}
            style={{
              width: '100%', padding: '10px 14px', background: `${C.red}15`,
              border: `1px solid ${C.red}44`, borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 11,
              fontFamily: F, color: C.red, fontWeight: 700
            }}>
            <LogOut size={14} color={C.red} />
            CERRAR SESIÓN
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}

function MoreBottomSheet({ isOpen, onClose, setScreen, onOpenLocalSettings, onLogout }) {
  const moreItems = [
    { id: 'staffing', Icon: Users, label: 'STAFFING', color: C.teal, action: () => { setScreen('staffing'); onClose(); } },
    { id: 'analytics', Icon: BarChart2, label: 'ANALYTICS', color: C.purple, action: () => { setScreen('analytics'); onClose(); } },
    { id: 'pricing', Icon: CreditCard, label: 'BILLING', color: C.amber, action: () => { setScreen('pricing'); onClose(); } },
    { id: 'local', Icon: Store, label: 'CONFIGURACIÓN', color: C.orange, action: () => { onOpenLocalSettings?.(); onClose(); } },
    { id: 'logout', Icon: LogOut, label: 'CERRAR SESIÓN', color: C.red, action: () => { onLogout?.(); onClose(); } }
  ];

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 300, animation: 'fadeIn 0.2s'
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.card, borderRadius: '16px 16px 0 0',
        zIndex: 301,
        paddingTop: 20,
        paddingLeft: `max(16px, env(safe-area-inset-left))`,
        paddingRight: `max(16px, env(safe-area-inset-right))`,
        paddingBottom: `calc(20px + env(safe-area-inset-bottom))`,
        boxSizing: 'border-box',
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{
          width: 40, height: 4, background: C.border2, borderRadius: 2,
          margin: '0 auto 20px', display: 'block'
        }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {moreItems.map(({ id, Icon, label, color, action }) => (
            <button key={id} onClick={action}
              style={{
                padding: '16px 12px', background: `${color}15`, border: `1px solid ${color}33`,
                borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8, fontSize: 10, fontFamily: F,
                color, fontWeight: 700, letterSpacing: 1,
                minHeight: 80, transition: 'all 0.2s'
              }}>
              <Icon size={24} color={color} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

function LoginPage({ onLogin }) {
  const canvasRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [authError, setAuthError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let width, height;
    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    setSize();
    window.addEventListener('resize', setSize);

    const NUM_PARTICLES = window.innerWidth < 768 ? 80 : 160;
    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * width, y: Math.random() * height, z: Math.random() * 2000,
      vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 3,
      size: Math.random() * 1.5 + 0.5, color: Math.random() > 0.3 ? '#FF6B35' : '#8B1A1A'
    }));
    const rays = Array.from({ length: 8 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      angle: Math.random() * Math.PI * 2, length: Math.random() * 300 + 100,
      speed: Math.random() * 4 + 2, opacity: 0, fadeDir: 0.005 + Math.random() * 0.01
    }));

    let raf;
    const animate = () => {
      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, width, height);
      rays.forEach(ray => {
        ray.x += Math.cos(ray.angle) * ray.speed; ray.y += Math.sin(ray.angle) * ray.speed;
        ray.opacity += ray.fadeDir;
        if (ray.opacity >= 0.5) ray.fadeDir *= -1;
        if (ray.opacity <= 0) { ray.x = Math.random() * width; ray.y = Math.random() * height; ray.angle = Math.random() * Math.PI * 2; ray.opacity = 0; ray.fadeDir = 0.005 + Math.random() * 0.01; }
        const grad = ctx.createLinearGradient(ray.x, ray.y, ray.x - Math.cos(ray.angle) * ray.length, ray.y - Math.sin(ray.angle) * ray.length);
        grad.addColorStop(0, `rgba(255, 107, 53, ${Math.max(0, ray.opacity)})`); grad.addColorStop(1, 'rgba(255, 107, 53, 0)');
        ctx.beginPath(); ctx.moveTo(ray.x, ray.y); ctx.lineTo(ray.x - Math.cos(ray.angle) * ray.length, ray.y - Math.sin(ray.angle) * ray.length);
        ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.stroke();
      });
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        if (p.z < 1) p.z = 2000; if (p.z > 2000) p.z = 1;
        if (p.x < 0) p.x = width; if (p.x > width) p.x = 0; if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
        const scale = 500 / p.z;
        const x2d = (p.x - width/2) * scale + width/2; const y2d = (p.y - height/2) * scale + height/2;
        const r2d = Math.max(0.1, p.size * scale); const alpha = Math.max(0, 1 - (p.z / 2000));
        ctx.beginPath(); ctx.arc(x2d, y2d, r2d, 0, Math.PI * 2); ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha; ctx.shadowBlur = 12 * scale; ctx.shadowColor = p.color; ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i]; const p2 = particles[j];
          const dx = p1.x - p2.x; const dy = p1.y - p2.y; const dz = p1.z - p2.z;
          const distSq = dx*dx + dy*dy + dz*dz;
          if (distSq < 30000) {
            const scale1 = 500 / p1.z; const x1 = (p1.x - width/2) * scale1 + width/2; const y1 = (p1.y - height/2) * scale1 + height/2;
            const scale2 = 500 / p2.z; const x2 = (p2.x - width/2) * scale2 + width/2; const y2 = (p2.y - height/2) * scale2 + height/2;
            const avgZ = (p1.z + p2.z) / 2; const alpha = Math.max(0, (1 - (avgZ / 2000)) * (1 - distSq/30000) * 0.4);
            if (alpha > 0.05) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = p1.color === p2.color ? `rgba(255, 107, 53, ${alpha})` : `rgba(139, 26, 26, ${alpha})`; ctx.lineWidth = 1; ctx.stroke(); }
          }
        }
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setSize); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setAuthError(null); setSuccessMsg(null); setIsSubmitting(true);

    try {
      if (!supabase) {
        // Fallback: si no hay Supabase, login simulado
        localStorage.setItem('barops_auth', JSON.stringify({ email, role, ts: Date.now() }));
        setTimeout(() => onLogin(role, email), 800);
        return;
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: { data: { role, display_name: email.split('@')[0] } }
        });
        if (error) throw error;
        if (data?.user?.identities?.length === 0) {
          setAuthError('Este email ya está registrado. Inicia sesión.');
          setMode('login');
        } else {
          setSuccessMsg('✅ Cuenta creada. Revisa tu email para confirmar, o inicia sesión directamente.');
          setMode('login');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        // onLogin will be triggered by onAuthStateChange listener in BarOps
      }
    } catch (err) {
      const msg = err?.message || 'Error de autenticación';
      const translations = {
        'Invalid login credentials': 'Email o contraseña incorrectos',
        'Email not confirmed': 'Confirma tu email antes de iniciar sesión',
        'User already registered': 'Este email ya está registrado',
        'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
        'Unable to validate email address: invalid format': 'Formato de email inválido',
      };
      setAuthError(translations[msg] || msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#050505',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: F, zIndex: 9999, overflow: 'hidden',
    }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,107,53,0.15), inset 0 0 15px rgba(255,107,53,0.05); border-color: rgba(255,107,53,0.3); }
          50% { box-shadow: 0 0 45px rgba(255,107,53,0.5), inset 0 0 30px rgba(255,107,53,0.15); border-color: rgba(255,107,53,0.7); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-card { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards, borderGlow 4s ease-in-out infinite; }
        .input-field {
          width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; color: #E8E8E8;
          font-family: inherit; font-size: 14px; transition: all 0.3s ease; box-sizing: border-box;
        }
        .input-field:focus { outline: none; background: rgba(255, 255, 255, 0.06); border-color: #FF6B35; box-shadow: 0 0 0 4px rgba(255, 107, 53, 0.15); }
        .input-field::placeholder { color: rgba(255, 255, 255, 0.3); }
        .submit-btn {
          width: 100%; padding: 16px; background: linear-gradient(135deg, #FF6B35, #E85A25);
          border: none; border-radius: 12px; color: #000; font-family: inherit; font-size: 13px; font-weight: 800;
          letter-spacing: 1.5px; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          text-transform: uppercase; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
          position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255, 107, 53, 0.5); }
        .submit-btn:active:not(:disabled) { transform: translateY(1px); }
        .submit-btn:disabled { opacity: 0.8; cursor: not-allowed; filter: grayscale(50%); }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite; }
      `}</style>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%' }} />

      <div className="login-card" style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px',
        margin: '0 20px', padding: '48px 40px',
        background: 'rgba(10, 10, 10, 0.45)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        borderRadius: '24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '80px', height: '80px', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            filter: 'drop-shadow(0 10px 25px rgba(255, 107, 53, 0.4))',
            borderRadius: '50%', overflow: 'hidden', background: '#050505',
            border: '2px solid rgba(255, 107, 53, 0.3)'
          }}>
            <img src="/logo.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="BarOps Logo" />
          </div>
          <h1 style={{ fontSize:'28px', fontWeight: 900, color: '#FFF', margin: '0 0 6px', letterSpacing: '2px' }}>BAROPS</h1>
          <p style={{ fontSize:'14px', color: '#FF6B35', margin: '0', letterSpacing: '3px', fontWeight: 700, textTransform: 'uppercase' }}>Sistema Operativo</p>
        </div>

        {/* Auth error/success messages */}
        {authError && (
          <div style={{ padding:'12px 16px', background:'#EF444420', border:'1px solid #EF444466', borderRadius:8, marginBottom:16, fontSize:'13px', color:'#EF4444', letterSpacing:'0.5px' }}>
            ⚠️ {authError}
          </div>
        )}
        {successMsg && (
          <div style={{ padding:'12px 16px', background:'#22C55E20', border:'1px solid #22C55E66', borderRadius:8, marginBottom:16, fontSize:'13px', color:'#22C55E', letterSpacing:'0.5px' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              display: 'block', fontSize:'13px', color: focusedInput === 'email' ? '#FF6B35' : '#888',
              letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase',
              fontWeight: 700, transition: 'color 0.3s'
            }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput(null)}
              placeholder="tu@email.com" className="input-field" />
          </div>

          <div>
            <label style={{
              display: 'block', fontSize:'13px', color: focusedInput === 'password' ? '#FF6B35' : '#888',
              letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase',
              fontWeight: 700, transition: 'color 0.3s'
            }}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedInput('password')} onBlur={() => setFocusedInput(null)}
              placeholder="••••••••" className="input-field" />
          </div>

          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize:'13px', color: '#888', letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>Rol</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: role === 'manager' ? '1px solid #FF6B35' : '1px solid transparent' }}>
                  <input type="radio" name="role" value="manager" checked={role === 'manager'} onChange={(e) => setRole(e.target.value)} style={{ accentColor: '#FF6B35' }} />
                  <span style={{ color: role === 'manager' ? '#FF6B35' : '#888', fontSize: '12px', fontWeight: 700 }}>MANAGER</span>
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: role === 'bartender' ? '1px solid #FF6B35' : '1px solid transparent' }}>
                  <input type="radio" name="role" value="bartender" checked={role === 'bartender'} onChange={(e) => setRole(e.target.value)} style={{ accentColor: '#FF6B35' }} />
                  <span style={{ color: role === 'bartender' ? '#FF6B35' : '#888', fontSize: '12px', fontWeight: 700 }}>BARTENDER</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <button type="submit" disabled={isSubmitting || !email.trim() || !password.trim()} className="submit-btn">
              {isSubmitting ? (
                <><div className="spinner"></div> {mode === 'signup' ? 'CREANDO CUENTA...' : 'AUTENTICANDO...'}</>
              ) : (
                mode === 'signup' ? 'CREAR CUENTA' : 'INICIAR SESIÓN'
              )}
            </button>
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setAuthError(null); setSuccessMsg(null); }} className="submit-btn" style={{
              background: 'transparent', border: '1px solid rgba(255, 107, 53, 0.5)',
              color: '#FF6B35', boxShadow: 'none'
            }}>
              {mode === 'login' ? 'CREAR CUENTA' : 'YA TENGO CUENTA'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', fontSize:'13px', color: '#555', letterSpacing: '0.5px' }}>
          {supabase ? '🔐 Autenticación segura con Supabase' : '⚡ Demo Mode — sin conexión a Supabase'}
        </div>
      </div>
    </div>
  );
}

export default function BarOps() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [cartItems, setCartItems] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [userRole, setUserRole] = useState('manager');
  const [userEmail, setUserEmail] = useState('');

  // ─── Supabase Auth State Listener ─────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      // Fallback: check localStorage for demo mode
      const stored = localStorage.getItem('barops_auth');
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          setUserRole(auth?.role || 'manager');
          setUserEmail(auth?.email || '');
          setIsLoggedIn(true);
        } catch { /* ignore */ }
      }
      setAuthLoading(false);
      return;
    }

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserRole(session.user.user_metadata?.role || 'manager');
        setUserEmail(session.user.email || '');
        setIsLoggedIn(true);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserRole(session.user.user_metadata?.role || 'manager');
        setUserEmail(session.user.email || '');
        setIsLoggedIn(true);
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setUserRole('manager');
        setUserEmail('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('barops_auth');
    setIsLoggedIn(false);
  };

  const params = new URLSearchParams(window.location.search);
  const initialScreen = (params.get('payment') === 'success' || params.get('session_id')) ? 'success' : 'dashboard';
  const [screen, setScreen] = useState(initialScreen);
  const [customIngs, setCustomIngs] = useState([]);
  const [customInv, setCustomInv] = useState([]);
  const [localName, setLocalName] = useState(
    localStorage.getItem('barops_local_nombre') ||
    localStorage.getItem('barops_local_name') ||
    'Mi Local'
  );
  const [showLocalDrawer, setShowLocalDrawer] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const handleLogin = (role, email) => {
    setTimeout(() => {
      setUserRole(role);
      setUserEmail(email || '');
      setIsLoggedIn(true);
    }, 100);
  };

  // Sincroniza el nombre del local desde Supabase (best-effort, localStorage manda)
  const fetchLocalName = async () => {
    try {
      if (!supabase) return;
      const { data } = await supabase
        .from('locales')
        .select('nombre')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      if (data?.nombre) {
        setLocalName(data.nombre);
        localStorage.setItem('barops_local_nombre', data.nombre);
        localStorage.setItem('barops_local_name', data.nombre);
      }
    } catch (err) {
      // localStorage ya tiene el valor correcto
    }
  };

  useEffect(() => {
    fetchLocalName();
  }, []);

  const fetchInventory = async () => {
    setInventoryLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      const { data, error } = await supabase.from('productos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const mapped = data.map(dbItem => {
        const stockQty = parseFloat(dbItem.stock_actual) || 0;
        let pct = Math.min(100, Math.round(stockQty * 10)); 
        let days = Math.min(90, Math.round(stockQty * 5));
        
        return {
          id: dbItem.id,
          name: dbItem.nombre,
          cat: dbItem.categoria,
          stock: `${stockQty} ${dbItem.unidad}`,
          unit: dbItem.unidad,
          cpu: dbItem.coste_unitario,
          cost: `€${parseFloat(dbItem.coste_unitario).toFixed(2)}/${dbItem.unidad}`,
          pct,
          days,
          weekly: `~${Math.round(stockQty/2)} uds`,
          risk: days <= 3 ? 'critical' : days <= 7 ? 'medium' : 'stable'
        };
      });
      setCustomInv(mapped);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const addFromImport = async (items) => {
    if (!supabase) return { success: false, error: "Supabase no conectado" };

    const localId = '00000000-0000-0000-0000-000000000001';

    // Map parsed items to Supabase schema
    const supabaseItems = items.map(item => ({
      local_id: localId,
      nombre: item.name,
      categoria: item.cat,
      unidad: item.unit,
      stock_actual: typeof item.rawStock === 'number' ? item.rawStock : (item.stock || 0),
      stock_minimo: 0,
      coste_unitario: item.cpu
    }));

    try {
      const { error } = await supabase
        .from('productos')
        .upsert(supabaseItems, {
          onConflict: 'nombre,local_id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      await fetchInventory();
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const savePedido = async ({ proveedor, items, canal }) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('pedidos').insert({
        local_id: '00000000-0000-0000-0000-000000000001',
        proveedor,
        items: JSON.stringify(items.map(i => ({ nombre: i.nombre, categoria: i.categoria, qty: i.qty, unidad: i.unidad }))),
        estado: canal === 'manual' ? 'pendiente' : 'enviado',
        canal,
        creado_por: userEmail,
      });
      if (error) console.error('Error guardando pedido:', error);
    } catch (err) {
      console.error('savePedido error:', err);
    }
  };

  const ctx = { customIngs, customInv, addFromImport, fetchInventory, localName, setLocalName, userRole, setScreen, cartItems, setCartItems, setShowCartDrawer, savePedido, inventoryLoading };

  const getScreenComponent = () => {
    const screens = {
      dashboard:  <Dashboard onNavigate={setScreen}/>,
      inventario: <Inventario/>,
      historial:  <HistorialPedidos/>,
      staffing:   <Staffing/>,
      agente:     <AgenteIA/>,
      analytics:  <Analytics/>,
      carta:      <Carta/>,
      pricing:    <Pricing/>,
      success:    <PaymentSuccess/>,
    };
    return screens[screen] || screens.dashboard;
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  try {
    if (!isLoggedIn) {
      return <LoginPage onLogin={handleLogin} />;
    }

    return (
      <AppCtx.Provider value={ctx}>
        <div style={{ display:'flex', flexDirection:isMobile?'column':'row', width:'100%', height:'100vh', background:C.bg, overflow:'hidden', fontFamily:F }}>
          <style>{`
            *{box-sizing:border-box;}
            html,body,#root{margin:0;padding:0;width:100%;height:100%;}
            ::-webkit-scrollbar{width:5px;}
            ::-webkit-scrollbar-track{background:#0a0a0a;}
            ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:3px;}
            ::-webkit-scrollbar-thumb:hover{background:#444;}
            input::placeholder{color:#444;font-family:'Courier New',Courier,monospace;}
            button:not(:disabled):hover{filter:brightness(1.1);}
            pre{font-family:'Courier New',Courier,monospace !important;}
            code{font-family:'Courier New',Courier,monospace;}
            @media (max-width: 1024px) {
              body { font-size: 14px; }
            }
          `}</style>

          {!isMobile && <Sidebar active={screen} setActive={setScreen} localName={localName} onOpenLocalSettings={()=>setShowLocalDrawer(true)} onLogout={handleLogout}/>}

          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', marginTop:isMobile?56:0, paddingBottom:isMobile?60:0 }}>
            {getScreenComponent()}
          </div>
        </div>

        {isMobile && (
          <>
            <MobileTopBar screen={screen} localName={localName} />
            <MobileBottomNav active={screen} setActive={setScreen} onMoreOpen={() => setShowMoreSheet(true)} />
            <MoreBottomSheet isOpen={showMoreSheet} onClose={() => setShowMoreSheet(false)} setScreen={setScreen} onOpenLocalSettings={() => { setShowLocalDrawer(true); setShowMoreSheet(false); }} onLogout={handleLogout} />
          </>
        )}

        {/* Floating Action Button for Cart (Desktop) */}
        {(!isMobile && cartItems && cartItems.length > 0) && (
          <div onClick={() => setShowCartDrawer(true)} style={{ position:'fixed', top:24, right:24, cursor:'pointer', display:'flex', alignItems:'center', gap:10, background:C.orange, padding:'10px 18px', borderRadius:20, color:'#000', zIndex:5000, boxShadow:'0 10px 25px rgba(255,107,53,0.3)', transition:'transform 0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            <ShoppingCart size={18}/>
            <span style={{ fontSize:14, fontWeight:800, fontFamily:F }}>{cartItems.length} ITEMS</span>
          </div>
        )}

        <CartDrawer isOpen={showCartDrawer} onClose={()=>setShowCartDrawer(false)} />
        <LocalDrawer isOpen={showLocalDrawer} onClose={()=>setShowLocalDrawer(false)} localName={localName} onLocalNameChange={setLocalName}/>
      </AppCtx.Provider>
    );
  } catch (error) {
    console.error('BarOps render error:', error);
    return (
      <div style={{ width:'100%', height:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', color:'#FF6B35', fontFamily:F, flexDirection:'column' }}>
        <div style={{ fontSize:'24px', marginBottom:'16px' }}>⚠️</div>
        <div style={{ fontSize:'14px', textAlign:'center', maxWidth:'400px' }}>
          Error al cargar la aplicación. Por favor recarga la página.
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop:'20px', padding:'10px 20px', background:'#FF6B35', color:'#000', border:'none', borderRadius:'4px', cursor:'pointer', fontFamily:F, fontWeight:'bold' }}>
          Recargar
        </button>
      </div>
    );
  }
}

import React from 'react';
import { Menu, LogOut, LayoutDashboard, Package, Users, Bot, BarChart2, Bell, Settings, CreditCard, Store, Search, Wine, ChevronUp, ChevronDown } from 'lucide-react';
import { C, F } from '../../constants/theme';
import { Btn, Card, Avatar, Badge } from '../ui';

export function Sidebar({ active, setActive, localName, onOpenLocalSettings, onLogout }) {
  const [mobile, setMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(localStorage.getItem('barops_local_photo') || '');

  useEffect(() => {
    const handleResize = () => setMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const NAV = [
    { id:'dashboard',  Icon:LayoutDashboard, label:'DASHBOARD'  },
    { id:'inventario', Icon:Package,         label:'INVENTARIO' },
    { id:'staffing',   Icon:Users,           label:'STAFFING'   },
    { id:'agente',     Icon:Bot,             label:'AGENTE IA'  },
    { id:'analytics',  Icon:BarChart2,       label:'ANALYTICS'  },
    { id:'carta',      Icon:BookOpen,        label:'CARTA'      },
    { id:'pricing',    Icon:CreditCard,      label:'BILLING'    },
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
        <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'3px', marginTop:8 }}>SISTEMA OPERATIVO</div>
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
            <div style={{ fontFamily:F, fontSize:'8px', color:C.textSec, letterSpacing:'2px', marginBottom:3 }}>LOCAL</div>
            <div style={{ fontFamily:F, fontSize:'12px', color:C.text, lineHeight:'1.3', fontWeight:700, wordBreak:'break-word' }}>{localName}</div>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:6 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:C.teal, boxShadow:`0 0 6px ${C.teal}` }}/>
              <span style={{ fontFamily:F, fontSize:'8px', color:C.teal, letterSpacing:'1px' }}>ACTIVO</span>
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
              <span style={{ fontFamily:F, fontSize:'11px', letterSpacing:'2.5px', color:on?C.orange:C.textSec, fontWeight:on?700:400 }}>
                {label}
              </span>
            </div>
          );
        })}
      </nav>
      <div style={{ padding:'16px 22px', borderTop:`1px solid ${C.border2}` }}>
        <button onClick={() => onOpenLocalSettings?.()} style={{ width:'100%', padding:'10px 14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, marginBottom:12, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:10 }}>
          <Store size={14} color={C.orange}/>
          <div style={{ textAlign:'left', flex:1 }}>
            <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px' }}>GESTIÓN</div>
            <div style={{ fontFamily:F, fontSize:'11px', color:C.orange, letterSpacing:'1.5px', fontWeight:700 }}>LOCAL</div>
          </div>
        </button>
        {(() => {
          const sub = localStorage.getItem('barops_subscription') ? JSON.parse(localStorage.getItem('barops_subscription')) : null;
          const bg = sub?.status==='active'?C.purpleBg:C.tealBg;
          const color = sub?.status==='active'?C.purple:C.teal;
          const label = sub?.status==='active'?'ACTIVO':'TRIAL';
          return (
            <div style={{ padding:'10px 14px', background:bg, border:`1px solid ${color}44`, borderRadius:4, marginBottom:12, cursor:'pointer' }} onClick={() => setActive('pricing')}>
              <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px' }}>PLAN ACTUAL</div>
              <div style={{ fontFamily:F, fontSize:'16px', color, letterSpacing:'4px', fontWeight:700, marginTop:3 }}>PRO</div>
              <div style={{ fontFamily:F, fontSize:'11px', color:C.textSec, marginTop:2 }}>{label}{sub?' · 14 días':''}</div>
            </div>
          );
        })()}
        <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'4px 0' }}>
          <HelpCircle size={12} color={C.textSec}/>
          <span style={{ fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px' }}>AYUDA & SOPORTE</span>
        </div>
        <div onClick={onLogout} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 0', marginTop: 12, borderTop: `1px solid ${C.border2}` }}>
          <LogOut size={12} color={C.red}/>
          <span style={{ fontFamily:F, fontSize:'10px', color:C.red, letterSpacing:'1.5px', fontWeight:700 }}>CERRAR SESIÓN</span>
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

export function MobileTopBar({ screen, localName }) {
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

export function MobileBottomNav({ active, setActive, onMoreOpen }) {
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

export function MobileDrawer({ isOpen, onClose, active, setActive, localName, onOpenLocalSettings, onLogout }) {
  const NAV = [
    { id: 'dashboard', Icon: LayoutDashboard, label: 'DASHBOARD' },
    { id: 'inventario', Icon: Package, label: 'INVENTARIO' },
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

export function MoreBottomSheet({ isOpen, onClose, setScreen, onOpenLocalSettings, onLogout }) {
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


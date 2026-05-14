import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Package, Users, Bot, BarChart2, Bell, Settings, CreditCard, Store, Search, Wine, ChevronUp, ChevronDown, CheckCircle, X, AlertTriangle, TrendingUp, TrendingDown, Send, HelpCircle, Plus, ShoppingCart, BookOpen, Trash2, Menu, LogOut } from 'lucide-react';
import { C, F } from '../constants/theme';
import { Badge, RiskBadge, ShiftBadge, AvailBadge, StockBar, Stars, Avatar, Toast, Btn, Card, SLabel, TypingDots, Skeleton } from '../components/ui';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard({ onNavigate }) {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ products: [], cocktails: [], movements: [] });
  const [expandedAlerts, setExpandedAlerts] = useState(false);
  const [agentQuery, setAgentQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';
  const { localName } = useApp();

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
          <div style={{ fontFamily:F, fontSize:'12px', color:C.textSec, letterSpacing:'2px', textTransform:'uppercase' }}>
            {new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>}
      </div>

      {/* SECCIÓN 1.5 — ACCESOS RÁPIDOS */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2, 1fr)':'repeat(4, 1fr)', gap:12, marginBottom:32 }}>
        <Btn variant="ghost" onClick={() => onNavigate('inventario')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <Package size={20} color={C.teal} />
          <span style={{ fontSize:'10px', letterSpacing:'1px', fontWeight:700 }}>NUEVO PEDIDO</span>
        </Btn>
        <Btn variant="ghost" onClick={() => onNavigate('inventario')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <AlertTriangle size={20} color={C.red} />
          <span style={{ fontSize:'10px', letterSpacing:'1px', fontWeight:700 }}>REGISTRAR MERMA</span>
        </Btn>
        <Btn variant="ghost" onClick={() => onNavigate('carta')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:C.card, border:`1px solid ${C.border2}`, height:'auto' }}>
          <Wine size={20} color={C.purple} />
          <span style={{ fontSize:'10px', letterSpacing:'1px', fontWeight:700 }}>ESCANDALLOS</span>
        </Btn>
        <Btn variant="ghost" onClick={() => handleAgentSubmit('¿Cómo mejoro mi margen hoy?')} sx={{ padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, background:`${C.orange}10`, border:`1px solid ${C.orange}44`, height:'auto' }}>
          <Bot size={20} color={C.orange} />
          <span style={{ fontSize:'10px', letterSpacing:'1px', color:C.orange, fontWeight:700 }}>CONSULTAR IA</span>
        </Btn>
      </div>

      {/* SECCIÓN 2 — ALERTAS DEL DÍA */}
      <div style={{ marginBottom:32, width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ fontSize:'11px', letterSpacing:'3px', color:C.textSec, margin:0, fontWeight:700 }}>ACCIONES DE HOY ({alerts.length})</h2>
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
                  <span style={{ fontSize:'11px', color:'#666666', fontWeight:400, flex:1 }}>{a.text}</span>
                  {a.action && <Btn variant="ghost" onClick={a.handler} sx={{ padding:'4px 10px', fontSize:'8px', flexShrink:0, marginLeft:8 }}>{a.action}</Btn>}
                </div>
              ))
            )}
            {!expandedAlerts && alerts.length > 8 && (
              <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, textAlign:'center' }}>
                <Btn variant="ghost" onClick={()=>setExpandedAlerts(true)} sx={{ fontSize:'8px' }}>VER TODAS ({alerts.length})</Btn>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* SECCIÓN 3 — 4 KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2, 1fr)':'repeat(4, 1fr)', gap:isMobile?12:20, marginBottom:32, width:'100%' }}>
        {loading ? [1,2,3,4].map(i => <Skeleton key={i} height={120} />) : (
          <>
            <Card sx={{ padding:20, position:'relative', overflow:'hidden' }}>
              <SLabel label="SALUD INVENTARIO" color={C.orange} icon={Package}/>
              <div style={{ fontSize:'28px', color:C.text }}><CounterUp value={data.products.length} /></div>
              <div style={{ fontSize:'11px', color:C.textSec, marginTop:4 }}>
                {stablest} estables · <span style={{ color:criticals.length>0?C.red:C.textSec }}>{criticals.length} críticos</span>
              </div>
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, display:'flex' }}>
                <div style={{ height:'100%', background:C.teal, width:`${(stablest/data.products.length)*100}%`, transition:'width 0.6s' }} />
                <div style={{ height:'100%', background:C.red, width:`${(criticals.length/data.products.length)*100}%`, transition:'width 0.6s' }} />
              </div>
            </Card>

            <Card sx={{ padding:20 }}>
              <SLabel label="VALOR EN STOCK" color={C.teal} icon={TrendingUp}/>
              <div style={{ fontSize:'28px', color:valorStock>0?C.text:C.textSec }}>
                {valorStock > 0 ? <CounterUp value={valorStock} prefix="€" decimals={0} /> : "Sin valorar"}
              </div>
              <div style={{ fontSize:'11px', color:C.textSec, marginTop:4 }}>
                {valorStock > 0 ? `${data.products.length} productos valorados` : "Añade costes en Inventario"}
              </div>
            </Card>

            <Card sx={{ padding:20 }}>
              <SLabel label="CARTA ACTIVA" color={C.purple} icon={BookOpen}/>
              <div style={{ fontSize:'28px', color:C.text }}><CounterUp value={activeCocktails} /></div>
              <div style={{ fontSize:'11px', color:C.textSec, marginTop:4 }}>
                <span style={{ color:draftCocktails>0?C.amber:C.textSec }}>{draftCocktails} borradores</span> · {revisionCocktails} revisión
              </div>
            </Card>

            <Card sx={{ padding:20 }}>
              <SLabel label="MERMA ESTIMADA" color={C.red} icon={AlertTriangle}/>
              <div style={{ fontSize:'28px', color:mermaRiesgo>0?C.red:C.teal }}>
                {mermaRiesgo > 0 ? <CounterUp value={mermaRiesgo} prefix="€" /> : "€0"}
              </div>
              <div style={{ fontSize:'11px', color:C.textSec, marginTop:4 }}>
                {mermaRiesgo > 0 ? "Valor en riesgo de perderse" : "Sin merma detectada"}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* SECCIÓN 3.5 — RENDIMIENTO FINANCIERO */}
      <div style={{ marginBottom:32, width:'100%' }}>
        <h2 style={{ fontSize:'11px', letterSpacing:'3px', color:C.textSec, margin:'0 0 16px 0', fontWeight:700 }}>RENDIMIENTO FINANCIERO (7 DÍAS)</h2>
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

      {/* SECCIÓN 4 — INVENTARIO URGENTE */}
      <div style={{ marginBottom:32, width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:'11px', letterSpacing:'3px', color:C.textSec, margin:0, fontWeight:700 }}>REQUIEREN ATENCIÓN</h2>
          {!isMobile && <Btn variant="ghost" onClick={()=>onNavigate('inventario')} sx={{ fontSize:'9px' }}>VER TODO EL INVENTARIO →</Btn>}
        </div>
        {!isMobile ? (
        <Card sx={{ overflow:'hidden', maxHeight:'200px', overflowY:'auto', overflowX:'auto', width:'100%', boxSizing:'border-box' }}>
          <div style={{ overflowX:'auto', overflowY:'hidden', width:'100%' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
            <thead>
              <tr style={{ background:'#0D0D0D', borderBottom:`1px solid ${C.border}` }}>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'8px', color:'#555555', letterSpacing:'1px' }}>PRODUCTO</th>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'8px', color:'#555555', letterSpacing:'1px' }}>STOCK</th>
                <th style={{ textAlign:'left', padding:'10px 16px', fontSize:'8px', color:'#555555', letterSpacing:'1px' }}>ESTADO</th>
                <th style={{ textAlign:'right', padding:'10px 16px', fontSize:'8px', color:'#555555', letterSpacing:'1px' }}>ACCIÓN</th>
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
                          <div style={{ color:isZero?C.red:'#666666', fontSize:'11px', fontWeight:400 }}>{p.nombre}</div>
                          <div style={{ color:'#555555', fontSize:'9px', marginTop:2 }}>{p.categoria}</div>
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ fontSize:'11px', color:'#666666' }}>{s} {p.unit || p.unidad}</div>
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
                          <Btn variant="ghost" onClick={() => {
                            if (p.telefono_proveedor) {
                              const msg = encodeURIComponent(`Hola, necesito reponer ${p.nombre}...`);
                              window.open(`https://wa.me/${p.telefono_proveedor.replace(/\s+/g,'')}?text=${msg}`, '_blank');
                            } else {
                              onNavigate('inventario');
                            }
                          }} sx={{ fontSize:'8px', padding:'4px 10px' }}>
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
                      <div style={{ fontSize:'12px', color:isZero?C.red:'#999', fontWeight:600 }}>{p.nombre}</div>
                      <div style={{ fontSize:'10px', color:C.textSec, marginTop:4 }}>{p.categoria}</div>
                      <div style={{ fontSize:'10px', color:C.textSec, marginTop:2 }}>{s} {p.unit || p.unidad} · Stock min: {m}</div>
                      <Badge label={isZero?'SIN STOCK':isCrit?'CRÍTICO':'PREVENTIVO'} color={isCrit?C.red:C.amber} bg={isCrit?C.redBg:C.amberBg} style={{ marginTop:8 }} />
                    </div>
                    <Btn variant="ghost" onClick={() => {
                      if (p.telefono_proveedor) {
                        const msg = encodeURIComponent(`Hola, necesito reponer ${p.nombre}...`);
                        window.open(`https://wa.me/${p.telefono_proveedor.replace(/\s+/g,'')}?text=${msg}`, '_blank');
                      } else {
                        onNavigate('inventario');
                      }
                    }} sx={{ fontSize:'9px', padding:'6px 12px', whiteSpace:'nowrap' }}>
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
          <h2 style={{ fontSize:'11px', letterSpacing:'3px', color:C.textSec, marginBottom:16, fontWeight:700 }}>CARTA</h2>
          <Card sx={{ padding:24, height:'100%', width:'100%', boxSizing:'border-box' }}>
            {loading ? <Skeleton height={150}/> : data.cocktails.length === 0 ? (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ color:C.textSec, fontSize:'12px', marginBottom:16 }}>Sin cócteles en carta</div>
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
                    {revisionCocktails > 0 && <span onClick={()=>onNavigate('carta')} style={{ color:C.orange, fontSize:'11px', cursor:'pointer', fontWeight:700 }}>Revisar →</span>}
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#444' }} />
                    <span style={{ fontSize:'13px', color:C.textSec }}>Borradores</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{draftCocktails}</span>
                    {draftCocktails > 0 && <span onClick={()=>onNavigate('carta')} style={{ color:C.orange, fontSize:'11px', cursor:'pointer', fontWeight:700 }}>Ver borradores →</span>}
                  </div>
                </div>

                {criticals.length > 0 && (
                  <div style={{ marginTop:8, padding:'12px', background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:4, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:C.amber, fontSize:'11px', fontWeight:600 }}>⚠ {criticals.length} cócteles afectados por stock</span>
                    <Btn variant="ghost" onClick={()=>onNavigate('carta')} sx={{ fontSize:'9px', padding:'4px 8px', color:C.amber, borderColor:`${C.amber}44` }}>VER CARTA →</Btn>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* COLUMNA DERECHA — ACTIVIDAD RECIENTE */}
        <div>
          <h2 style={{ fontSize:'11px', letterSpacing:'3px', color:C.textSec, marginBottom:16, fontWeight:700 }}>ACTIVIDAD RECIENTE</h2>
          <Card sx={{ padding:0, height:'100%', overflow:'hidden' }}>
            {loading ? <div style={{ padding:20 }}><Skeleton height={150}/></div> : data.movements.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:C.textSec, fontSize:'12px' }}>Sin actividad registrada todavía</div>
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
                        <div style={{ fontSize:'11px', color:C.text, fontWeight:700, letterSpacing:'0.5px' }}>
                          {m.tipo?.toUpperCase()} — {m.productos?.nombre || 'Producto'}
                        </div>
                        {m.motivo && <div style={{ fontSize:'10px', color:C.textSec, marginTop:2 }}>{m.motivo}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize:'10px', color:C.textSec }}>{getRelTime(m.created_at)}</div>
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
            <span style={{ fontSize:'11px', fontWeight:700, letterSpacing:'2px', color:C.textSec }}>AGENTE BAROPS</span>
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
                padding:'6px 10px', fontSize:'9px', color:C.textSec, cursor:'pointer',
                transition:'all 0.2s', fontFamily:F, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden', minWidth:0, flex:0.9
              }} onMouseEnter={e=>{e.target.style.borderColor=C.orange; e.target.style.color=C.orange;}}
                 onMouseLeave={e=>{e.target.style.borderColor=C.border2; e.target.style.color=C.textSec;}}>
                "{c.substring(0,30)}..."
              </button>
            )) : CHIPS.map(c => (
              <button key={c} onClick={()=>handleAgentSubmit(c)} style={{
                background:'transparent', border:`1px solid ${C.border2}`, borderRadius:20,
                padding:'6px 16px', fontSize:'11px', color:C.textSec, cursor:'pointer',
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




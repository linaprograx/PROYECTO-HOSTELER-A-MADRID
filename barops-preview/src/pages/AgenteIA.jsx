import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Package, Users, Bot, BarChart2, Bell, Settings, CreditCard, Store, Search, Wine, ChevronUp, ChevronDown, CheckCircle, X, AlertTriangle, TrendingUp, TrendingDown, Send, HelpCircle, Plus, ShoppingCart, BookOpen, Trash2, Menu, LogOut } from 'lucide-react';
import { C, F } from '../constants/theme';
import { Badge, RiskBadge, ShiftBadge, AvailBadge, StockBar, Stars, Avatar, Toast, Btn, Card, SLabel, TypingDots, Skeleton } from '../components/ui';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AgenteIA() {
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
            <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, marginTop:2, display:isMobile?'none':'block' }}>Tu analista de negocio personal — activo 24/7</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:isMobile?8:12 }}>
          <span style={{ padding:'5px 12px', background:C.purpleBg, border:`1px solid ${C.purple}44`, borderRadius:2, fontFamily:F, fontSize:'8px', color:C.purple, letterSpacing:'1.5px', fontWeight:700 }}>
            CLAUDE POWERED
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:loading?C.amber:C.teal, boxShadow:`0 0 8px ${loading?C.amber:C.teal}` }}/>
            <span style={{ fontFamily:F, fontSize:'9px', color:loading?C.amber:C.teal, letterSpacing:'1.5px', whiteSpace:'nowrap' }}>
              {loading?'PROCESANDO':'EN LÍNEA'}
            </span>
          </div>
        </div>
      </div>

      {/* API key error */}
      {apiErr&&(
        <div style={{ margin:'16px 28px 0', padding:'14px 18px', background:'#EF444415', border:`1px solid #EF444444`, borderRadius:4, fontFamily:F, fontSize:'12px', color:'#EF4444', lineHeight:'1.8' }}>
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
            <div style={{ fontFamily:F, fontSize:'8px', color:C.textSec, letterSpacing:'1px', marginBottom:5, padding:'0 4px', textAlign:msg.role==='user'?'right':'left' }}>
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
            <div style={{ fontFamily:F, fontSize:'8px', color:C.textSec, letterSpacing:'1px', marginBottom:5 }}>⚡ AGENTE · {getNow()}</div>
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
              <button key={i} onClick={()=>send(chip)} style={{ padding:'5px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:2, fontFamily:F, fontSize:'12px', color:C.textSec, cursor:'pointer' }}>
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
          <Btn onClick={()=>send()} disabled={loading} sx={{ padding:isMobile?'12px 20px':'12px 24px', fontSize:'11px', width:isMobile?'100%':'auto', justifyContent:'center' }}>
            <Send size={isMobile?13:14}/> {isMobile?'ENVIAR':'ENVIAR'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
const TT_STYLE = { background:C.card, border:`1px solid #333`, fontFamily:F, fontSize:'11px', borderRadius:3, color:C.text };


// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────

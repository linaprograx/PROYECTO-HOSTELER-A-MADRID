import { useState } from "react";

const data = {
  vision: {
    name: "BAROPS",
    tagline: "El sistema operativo de la hostelería española",
    description: "Una sola plataforma que gestiona operaciones del bar y cubre su personal con IA. El Mews de los bares independientes.",
    raise: "Objetivo ronda Seed: €500k–1.5M en mes 12"
  },
  phases: [
    {
      id: 1,
      label: "FASE 1",
      title: "CIMIENTOS",
      weeks: "Semanas 1–4",
      color: "#FF6B35",
      budget: "€800",
      goal: "MVP mínimo funcional + 5 pilotos confirmados",
      smart: {
        S: "Construir el módulo de inventario inteligente y el perfil de bartender freelance",
        M: "5 locales piloto activos + 20 bartenders registrados",
        A: "Tienes la red. Solo necesitas 2h de conversaciones",
        R: "Sin MRR aún, pero con datos reales que valen más",
        T: "30 días exactos desde hoy"
      },
      steps: [
        {
          week: "Semana 1",
          icon: "⚙️",
          title: "Infraestructura base",
          tasks: [
            "Registra dominio barops.es (€12/año)",
            "Crea cuenta Supabase (base de datos gratuita)",
            "Crea cuenta Make.com (automatizaciones, plan gratis)",
            "Crea cuenta Claude API + OpenAI (€50 de crédito inicial)",
            "Setup repositorio en GitHub",
            "Diseña el flujo de datos: Bar → Inventario → IA → Alerta"
          ],
          output: "Stack técnico listo para construir"
        },
        {
          week: "Semana 2",
          icon: "🔨",
          title: "Construye el MVP de Inventario",
          tasks: [
            "Formulario simple (Google Forms o Typeform) donde el bar registra su stock semanal",
            "Conecta vía Make.com a Supabase (guarda los datos)",
            "Prompt de Claude que analiza el stock y devuelve: alertas de reposición, predicción de demanda del finde, coste por cóctel",
            "Email automático al bar cada lunes con su 'Informe BarOps'",
            "NO construyas un dashboard todavía — el email es suficiente para validar"
          ],
          output: "Sistema de inventario básico funcionando"
        },
        {
          week: "Semana 3",
          icon: "👤",
          title: "Construye el MVP de Staffing",
          tasks: [
            "Formulario de registro para bartenders/camareros freelance (nombre, especialidad, zonas, disponibilidad, foto, tarifa/hora)",
            "Base de datos en Supabase con todos los perfiles",
            "Formulario para que el bar publique una necesidad urgente",
            "Make.com: cuando un bar publica necesidad → Claude filtra los 3 mejores perfiles → envía WhatsApp automático a los candidatos y al bar",
            "El matching es manual-asistido por IA en esta fase"
          ],
          output: "Sistema de matching básico por WhatsApp"
        },
        {
          week: "Semana 4",
          icon: "📞",
          title: "Activa los 5 pilotos",
          tasks: [
            "Llama a tus 5 contactos más cercanos del sector",
            "Script de venta: 'Te doy gratis durante 30 días un sistema que te avisa cuando te va a faltar Hendrick's el viernes, y si se cae un camarero te mando un sustituto en 2 horas'",
            "Onboarding en persona (30 min por local)",
            "Registra 20 bartenders/camareros freelance de tu red",
            "Primeras alertas reales enviadas",
            "Recoge feedback escrito de cada piloto"
          ],
          output: "5 locales activos + 20 profesionales en base de datos"
        }
      ]
    },
    {
      id: 2,
      label: "FASE 2",
      title: "TRACCIÓN",
      weeks: "Semanas 5–10",
      color: "#00D4AA",
      budget: "€1.200",
      goal: "30 clientes de pago + €5.000 MRR + 100 freelancers",
      smart: {
        S: "Convertir pilotos en pagadores y escalar a 30 locales en Madrid",
        M: "€5.000 MRR (mix inventario + comisiones staffing)",
        A: "Con 5 pilotos satisfechos, el boca a boca hace el trabajo",
        R: "€5k MRR = breakeven personal + prueba de concepto para inversores",
        T: "45 días (semana 5 a semana 10)"
      },
      steps: [
        {
          week: "Semana 5–6",
          icon: "💰",
          title: "Lanza el precio y cobra",
          tasks: [
            "Crea página web mínima en Carrd.co (€19/año) con propuesta de valor + pricing",
            "Pricing: Plan Esencial €99/mes (inventario IA + 2 staffings/mes incluidos)",
            "Pricing: Plan Pro €199/mes (inventario + staffing ilimitado + agente IA WhatsApp)",
            "Comisión staffing: 15% sobre cada turno adicional fuera del plan",
            "Activa Stripe para cobro automático (10 min de setup)",
            "Convierte los 5 pilotos a clientes de pago (ofrece 50% descuento primer mes)"
          ],
          output: "Primeros €500–1.000 MRR"
        },
        {
          week: "Semana 6–7",
          icon: "📱",
          title: "Construye el dashboard real",
          tasks: [
            "Ahora sí construye la interfaz — con datos reales de los pilotos ya sabes qué mostrar",
            "Usa Bubble.io (no-code) o Next.js si sabes programar",
            "Pantalla 1: Estado del inventario con alertas de colores",
            "Pantalla 2: Mis turnos (bares ven necesidades, freelancers ven ofertas)",
            "Pantalla 3: Analytics básico (qué cóctel más vendido, franja más rentable)",
            "Login simple con email/contraseña vía Supabase Auth"
          ],
          output: "Producto real que retiene usuarios"
        },
        {
          week: "Semana 7–8",
          icon: "🔥",
          title: "Canal de adquisición: ventas directas",
          tasks: [
            "Objetivo: 5 nuevos locales por semana durante 4 semanas",
            "Lunes y martes: zona Malasaña (mayor densidad coctelerías Madrid)",
            "Miércoles y jueves: zona Chueca + Barrio de las Letras",
            "Viernes: seguimiento + cierre de los contactados esta semana",
            "Demo en vivo con el móvil: abres su Google Maps, ves sus reseñas, en 30 seg muestras el sistema",
            "Si dicen 'no tengo tiempo': 'Te tardo 20 minutos en conectarlo, tú no haces nada'"
          ],
          output: "Pipeline de 25+ locales en conversación"
        },
        {
          week: "Semana 8–10",
          icon: "🤝",
          title: "Canal de adquisición: alianzas estratégicas",
          tasks: [
            "Contacta con el gremio de Hostelería Madrid (12.000 socios) — ofrece descuento del 30% para sus asociados a cambio de mención en newsletter",
            "Contacta con 2 distribuidores de licores premium (Diageo, Pernod Ricard España) — propón co-marketing: ellos te presentan a sus clientes bares, tú les das datos de consumo agregados",
            "Crea grupo de WhatsApp 'BarOps Madrid' con primeros clientes — comunidad, no solo software",
            "Graba 3 vídeos cortos de TikTok mostrando el sistema en un bar real (con permiso del cliente)"
          ],
          output: "2 alianzas activas + comunidad de 50+ hosteleros"
        }
      ]
    },
    {
      id: 3,
      label: "FASE 3",
      title: "ESCALA",
      weeks: "Semanas 11–20",
      color: "#7C3AED",
      budget: "€1.500",
      goal: "100 clientes + €20.000 MRR + deck para inversores",
      smart: {
        S: "Llegar a 100 locales en Madrid con MRR recurrente y métricas de retención >85%",
        M: "€20.000 MRR, churn <5%, 300 freelancers activos, 500 turnos cubiertos/mes",
        A: "Con el canal de alianzas activo, cada distribuidor puede darte acceso a 200+ locales",
        R: "€20k MRR con esas métricas es un deck de inversión irrechazable",
        T: "10 semanas (mes 3 al mes 5)"
      },
      steps: [
        {
          week: "Semana 11–13",
          icon: "🤖",
          title: "Potencia la IA — diferenciación real",
          tasks: [
            "Integra datos históricos de los 100 locales para entrenar predicciones de demanda",
            "Modelo predictivo: 'El próximo viernes necesitarás X botellas de X producto basado en el histórico y el clima'",
            "Agente IA por WhatsApp Business: el bar pregunta cualquier cosa operativa y responde en <10 seg",
            "Sistema de valoraciones bidireccional: bares valoran freelancers, freelancers valoran bares",
            "Alertas de conflicto de horario para freelancers con múltiples locales"
          ],
          output: "Producto con moat tecnológico real"
        },
        {
          week: "Semana 13–16",
          icon: "📊",
          title: "Construye el deck de inversión",
          tasks: [
            "Slide 1 — Problema: el bar independiente español pierde €1.500/mes en merma y €800/mes en personal mal gestionado",
            "Slide 2 — Solución: BarOps, el OS del bar. Inventario + Staffing + IA en una plataforma",
            "Slide 3 — Mercado: 280.000 establecimientos en España, TAM €500M+",
            "Slide 4 — Tracción: X clientes, €XX MRR, XX% retención, XX turnos cubiertos",
            "Slide 5 — Modelo de negocio: SaaS €99–299/mes + comisión staffing 15%",
            "Slide 6 — Comparables: Toast ($20B), SevenRooms ($1B), Qwick ($100M)",
            "Slide 7 — Equipo: tú (hostelero + tech + ventas = el perfil imposible)",
            "Slide 8 — Uso de fondos: €500k → tech x2 + sales x1 + expansión Barcelona",
            "Slide 9 — Proyección: €1.5M ARR en mes 18 con la ronda"
          ],
          output: "Deck listo para pitch"
        },
        {
          week: "Semana 16–20",
          icon: "🎯",
          title: "Pitch a inversores",
          tasks: [
            "Target 1 — Fondos españoles con foco hostelería: Bonsai VC, Kibo Ventures, Seaya Ventures",
            "Target 2 — Fondos europeos hosp.tech: ROCH Ventures (invierten en Series A hosp tech Europa)",
            "Target 3 — Business Angels hostelería: red de ex-directivos de Pernod Ricard, NH Hoteles, etc.",
            "Aplica a: Lanzadera (Valencia), Wayra (Telefónica), Madrid Food Innovation Hub",
            "Estrategia: primero cierra 2-3 angels pequeños (€50k–100k cada uno) para tener 'momentum' antes de hablar con fondos",
            "Métrica clave para el pitch: coste de adquisición de cliente (CAC) vs lifetime value (LTV). Tu LTV mínimo es €3.600 (€200/mes × 18 meses). CAC objetivo <€200."
          ],
          output: "Primera ronda cerrada o en proceso"
        }
      ]
    },
    {
      id: 4,
      label: "FASE 4",
      title: "EXPANSIÓN",
      weeks: "Mes 6–12",
      color: "#F59E0B",
      budget: "Capital de ronda",
      goal: "250 clientes + €57.500 MRR + expansión Barcelona",
      smart: {
        S: "Replicar el modelo Madrid en Barcelona y preparar la infraestructura para toda España",
        M: "250 locales activos, €57.500 MRR, 1.000 freelancers en plataforma",
        A: "Con el capital de la ronda, contratas 1 persona de ventas en Barcelona",
        R: "Este MRR con CAGR del 20% mensual = valoración €5M–10M",
        T: "Mes 6 a mes 12 post-lanzamiento"
      },
      steps: [
        {
          week: "Mes 6–7",
          icon: "🏙️",
          title: "Expansión Barcelona",
          tasks: [
            "Contrata 1 City Manager Barcelona (sueldo €1.800/mes + comisión)",
            "Objetivo: 50 locales en Barcelona en 60 días",
            "Replica exactamente el playbook Madrid: alianzas gremios + visita directa",
            "Adapta la plataforma al catalán (UX local importa)"
          ],
          output: "Segunda ciudad activa"
        },
        {
          week: "Mes 8–10",
          icon: "🔗",
          title: "Integraciones que crean lock-in",
          tasks: [
            "Integración con los 3 principales TPV de hostelería en España (iZettle, SumUp, Lightspeed)",
            "API abierta para que distribuidores de licores consulten datos de sus productos",
            "Módulo de nóminas freelance: BarOps gestiona el pago a los freelancers automáticamente",
            "Esto convierte BarOps en infraestructura financiera del sector — imposible de desinstalar"
          ],
          output: "Lock-in técnico real + nuevo flujo de ingresos"
        },
        {
          week: "Mes 10–12",
          icon: "🚀",
          title: "Prepara Serie A",
          tasks: [
            "Con €57k MRR y dos ciudades activas, el perfil es Serie A europeo",
            "Target: €2M–5M para expansión a 5 ciudades españolas + Portugal",
            "Comparables directos: Qwick ($100M), Lightspeed (IPO), SevenRooms ($1B)",
            "El pitch cambia: ya no eres una startup española de bares — eres la infraestructura de la hostelería independiente europea"
          ],
          output: "Serie A en proceso"
        }
      ]
    }
  ],
  metrics: [
    { label: "Mes 3", mrr: 5000, clients: 25, freelancers: 100 },
    { label: "Mes 6", mrr: 20000, clients: 100, freelancers: 300 },
    { label: "Mes 9", mrr: 40000, clients: 180, freelancers: 600 },
    { label: "Mes 12", mrr: 57500, clients: 250, freelancers: 1000 }
  ],
  stack: [
    { tool: "Supabase", role: "Base de datos + autenticación", cost: "€0–25/mes", phase: "Desde día 1" },
    { tool: "Claude API", role: "Motor de IA para inventario + matching + agente", cost: "€80–150/mes", phase: "Desde día 1" },
    { tool: "Make.com", role: "Automatizaciones y flujos sin código", cost: "€20/mes", phase: "Desde día 1" },
    { tool: "Bubble.io", role: "Dashboard web sin código", cost: "€29/mes", phase: "Semana 6" },
    { tool: "Twilio/WhatsApp API", role: "Notificaciones + agente conversacional", cost: "€50/mes", phase: "Semana 3" },
    { tool: "Stripe", role: "Cobros y suscripciones", cost: "2.9% + €0.30/transacción", phase: "Semana 5" },
    { tool: "Carrd.co", role: "Landing page", cost: "€19/año", phase: "Semana 5" },
    { tool: "Notion", role: "CRM manual + documentación interna", cost: "€0", phase: "Desde día 1" }
  ]
};

const phaseColors = ["#FF6B35", "#00D4AA", "#7C3AED", "#F59E0B"];

export default function BarOpsRoadmap() {
  const [activePhase, setActivePhase] = useState(0);
  const [activeStep, setActiveStep] = useState(null);
  const [activeTab, setActiveTab] = useState("roadmap");

  const phase = data.phases[activePhase];

  return (
    <div style={{
      fontFamily: "'Courier New', Courier, monospace",
      background: "#0A0A0A",
      minHeight: "100vh",
      color: "#E8E8E8",
      padding: "0"
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222",
        padding: "24px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0D0D0D"
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <span style={{
            fontSize: "28px",
            fontWeight: "900",
            letterSpacing: "6px",
            color: "#FF6B35"
          }}>BAROPS</span>
          <span style={{ color: "#555", fontSize: "11px", letterSpacing: "3px" }}>
            STARTUP ROADMAP
          </span>
        </div>
        <div style={{
          background: "#FF6B351A",
          border: "1px solid #FF6B3533",
          borderRadius: "4px",
          padding: "6px 14px",
          fontSize: "11px",
          color: "#FF6B35",
          letterSpacing: "2px"
        }}>
          SEED TARGET: €500K–1.5M
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #222",
        background: "#0D0D0D"
      }}>
        {["roadmap", "metricas", "stack"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              padding: "14px 28px",
              cursor: "pointer",
              fontSize: "11px",
              letterSpacing: "3px",
              fontFamily: "inherit",
              color: activeTab === tab ? "#FF6B35" : "#444",
              borderBottom: activeTab === tab ? "2px solid #FF6B35" : "2px solid transparent",
              textTransform: "uppercase",
              transition: "all 0.2s"
            }}
          >
            {tab === "roadmap" ? "PLAN SMART" : tab === "metricas" ? "PROYECCIÓN" : "TECH STACK"}
          </button>
        ))}
      </div>

      {activeTab === "roadmap" && (
        <div style={{ display: "flex", height: "calc(100vh - 120px)" }}>
          {/* Phase Sidebar */}
          <div style={{
            width: "220px",
            borderRight: "1px solid #1A1A1A",
            background: "#0A0A0A",
            flexShrink: 0
          }}>
            {data.phases.map((p, i) => (
              <button
                key={i}
                onClick={() => { setActivePhase(i); setActiveStep(null); }}
                style={{
                  width: "100%",
                  background: activePhase === i ? "#111" : "transparent",
                  border: "none",
                  borderLeft: activePhase === i ? `3px solid ${p.color}` : "3px solid transparent",
                  padding: "20px 20px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "9px", color: p.color, letterSpacing: "3px", marginBottom: "4px" }}>
                  {p.label}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: activePhase === i ? "#FFF" : "#555", letterSpacing: "2px" }}>
                  {p.title}
                </div>
                <div style={{ fontSize: "9px", color: "#333", marginTop: "4px" }}>
                  {p.weeks}
                </div>
              </button>
            ))}

            {/* Budget summary */}
            <div style={{ margin: "24px 16px", borderTop: "1px solid #1A1A1A", paddingTop: "20px" }}>
              <div style={{ fontSize: "9px", color: "#333", letterSpacing: "2px", marginBottom: "12px" }}>INVERSIÓN TOTAL</div>
              {data.phases.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "9px", color: "#444" }}>F{i + 1}</span>
                  <span style={{ fontSize: "9px", color: p.color }}>{p.budget}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", color: "#666", letterSpacing: "2px" }}>BOOTSTRAP</span>
                <span style={{ fontSize: "11px", color: "#FF6B35", fontWeight: "700" }}>€3.500</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: "auto", padding: "32px" }}>
            {/* Phase header */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "32px"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: phase.color, letterSpacing: "3px" }}>{phase.label} — {phase.weeks}</span>
                </div>
                <h2 style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "4px", margin: "0 0 8px", color: "#FFF" }}>
                  {phase.title}
                </h2>
                <p style={{ fontSize: "13px", color: "#888", margin: 0, maxWidth: "500px" }}>
                  🎯 {phase.goal}
                </p>
              </div>
              <div style={{
                background: "#111",
                border: `1px solid ${phase.color}33`,
                borderRadius: "6px",
                padding: "16px 20px",
                textAlign: "right"
              }}>
                <div style={{ fontSize: "9px", color: "#444", letterSpacing: "2px" }}>PRESUPUESTO FASE</div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: phase.color }}>{phase.budget}</div>
              </div>
            </div>

            {/* SMART breakdown */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "8px",
              marginBottom: "32px"
            }}>
              {Object.entries(phase.smart).map(([key, val]) => (
                <div key={key} style={{
                  background: "#111",
                  border: "1px solid #1A1A1A",
                  borderRadius: "6px",
                  padding: "14px",
                }}>
                  <div style={{
                    width: "24px",
                    height: "24px",
                    background: phase.color,
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "900",
                    color: "#000",
                    marginBottom: "10px"
                  }}>{key}</div>
                  <div style={{ fontSize: "10px", color: "#666", lineHeight: "1.5" }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {phase.steps.map((step, i) => (
                <div
                  key={i}
                  onClick={() => setActiveStep(activeStep === i ? null : i)}
                  style={{
                    background: activeStep === i ? "#111" : "#0D0D0D",
                    border: `1px solid ${activeStep === i ? phase.color + "44" : "#1A1A1A"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    overflow: "hidden"
                  }}
                >
                  <div style={{
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px"
                  }}>
                    <span style={{ fontSize: "20px" }}>{step.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "9px", color: phase.color, letterSpacing: "2px", marginBottom: "2px" }}>
                        {step.week}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "1px" }}>
                        {step.title}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "9px",
                      color: "#444",
                      letterSpacing: "2px",
                      padding: "4px 10px",
                      border: "1px solid #1A1A1A",
                      borderRadius: "3px"
                    }}>
                      {step.tasks.length} TAREAS
                    </div>
                    <div style={{ color: "#333", fontSize: "14px" }}>{activeStep === i ? "▲" : "▼"}</div>
                  </div>

                  {activeStep === i && (
                    <div style={{ borderTop: "1px solid #1A1A1A", padding: "20px 24px" }}>
                      <div style={{ display: "flex", gap: "24px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "9px", color: "#444", letterSpacing: "2px", marginBottom: "12px" }}>
                            TAREAS EXACTAS
                          </div>
                          {step.tasks.map((task, j) => (
                            <div key={j} style={{
                              display: "flex",
                              gap: "12px",
                              marginBottom: "10px",
                              alignItems: "flex-start"
                            }}>
                              <div style={{
                                width: "18px",
                                height: "18px",
                                border: `1px solid ${phase.color}66`,
                                borderRadius: "3px",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "9px",
                                color: phase.color
                              }}>{j + 1}</div>
                              <span style={{ fontSize: "12px", color: "#AAA", lineHeight: "1.6" }}>{task}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          width: "200px",
                          background: "#0A0A0A",
                          border: "1px solid #1A1A1A",
                          borderRadius: "6px",
                          padding: "16px",
                          flexShrink: 0
                        }}>
                          <div style={{ fontSize: "9px", color: "#444", letterSpacing: "2px", marginBottom: "8px" }}>
                            OUTPUT
                          </div>
                          <div style={{ fontSize: "12px", color: phase.color, lineHeight: "1.5" }}>
                            ✓ {step.output}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "metricas" && (
        <div style={{ padding: "40px 32px" }}>
          <h2 style={{ fontSize: "24px", letterSpacing: "4px", marginBottom: "8px" }}>PROYECCIÓN 12 MESES</h2>
          <p style={{ color: "#555", fontSize: "12px", marginBottom: "40px" }}>
            Basado en bootstrap €3.500 + red de contactos existente + crecimiento 20% mensual
          </p>

          {/* Big numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "48px" }}>
            {data.metrics.map((m, i) => (
              <div key={i} style={{
                background: "#111",
                border: `1px solid ${phaseColors[i]}33`,
                borderRadius: "8px",
                padding: "28px 24px"
              }}>
                <div style={{ fontSize: "9px", color: phaseColors[i], letterSpacing: "3px", marginBottom: "16px" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: "28px", fontWeight: "900", color: "#FFF", marginBottom: "4px" }}>
                  €{m.mrr.toLocaleString()}
                </div>
                <div style={{ fontSize: "10px", color: "#444", marginBottom: "16px" }}>MRR MENSUAL</div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "16px", color: phaseColors[i], fontWeight: "700" }}>{m.clients}</div>
                    <div style={{ fontSize: "9px", color: "#333" }}>LOCALES</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", color: phaseColors[i], fontWeight: "700" }}>{m.freelancers}</div>
                    <div style={{ fontSize: "9px", color: "#333" }}>FREELANCERS</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "8px", padding: "28px" }}>
              <div style={{ fontSize: "11px", color: "#FF6B35", letterSpacing: "3px", marginBottom: "20px" }}>
                FUENTES DE INGRESOS
              </div>
              {[
                { label: "SaaS Plan Esencial (€99/mes)", pct: 45, color: "#FF6B35" },
                { label: "SaaS Plan Pro (€199/mes)", pct: 30, color: "#00D4AA" },
                { label: "Comisiones Staffing (15%)", pct: 20, color: "#7C3AED" },
                { label: "Plan Cadena (€799/mes)", pct: 5, color: "#F59E0B" }
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#888" }}>{item.label}</span>
                    <span style={{ fontSize: "11px", color: item.color }}>{item.pct}%</span>
                  </div>
                  <div style={{ height: "4px", background: "#1A1A1A", borderRadius: "2px" }}>
                    <div style={{
                      height: "100%",
                      width: `${item.pct}%`,
                      background: item.color,
                      borderRadius: "2px"
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "8px", padding: "28px" }}>
              <div style={{ fontSize: "11px", color: "#00D4AA", letterSpacing: "3px", marginBottom: "20px" }}>
                HITOS CLAVE PARA INVERSORES
              </div>
              {[
                { mes: "Mes 1", hito: "5 pilotos activos + sistema funcionando", tipo: "Producto" },
                { mes: "Mes 2", hito: "Primeros €1.000 MRR cobrados", tipo: "Revenue" },
                { mes: "Mes 3", hito: "€5.000 MRR + 100 freelancers", tipo: "Tracción" },
                { mes: "Mes 6", hito: "€20.000 MRR + deck listo", tipo: "Fundraising" },
                { mes: "Mes 9", hito: "Primera ronda cerrada (€500k+)", tipo: "Capital" },
                { mes: "Mes 12", hito: "€57.500 MRR + Barcelona activa", tipo: "Escala" }
              ].map((h, i) => (
                <div key={i} style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "12px",
                  alignItems: "flex-start"
                }}>
                  <div style={{
                    fontSize: "9px",
                    color: "#00D4AA",
                    width: "44px",
                    flexShrink: 0,
                    letterSpacing: "1px",
                    paddingTop: "2px"
                  }}>{h.mes}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "#CCC" }}>{h.hito}</div>
                  </div>
                  <div style={{
                    fontSize: "8px",
                    color: "#333",
                    border: "1px solid #222",
                    borderRadius: "3px",
                    padding: "2px 6px",
                    flexShrink: 0
                  }}>{h.tipo}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "stack" && (
        <div style={{ padding: "40px 32px" }}>
          <h2 style={{ fontSize: "24px", letterSpacing: "4px", marginBottom: "8px" }}>TECH STACK BOOTSTRAP</h2>
          <p style={{ color: "#555", fontSize: "12px", marginBottom: "40px" }}>
            Todo construible sin equipo. Sin inversión inicial de código. Total operativo: ~€225/mes
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {data.stack.map((tool, i) => (
              <div key={i} style={{
                background: "#111",
                border: "1px solid #1A1A1A",
                borderRadius: "8px",
                padding: "22px 24px",
                display: "flex",
                gap: "20px",
                alignItems: "flex-start"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  background: `${phaseColors[i % 4]}15`,
                  border: `1px solid ${phaseColors[i % 4]}33`,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  flexShrink: 0
                }}>
                  {["🗄️", "🤖", "⚡", "🖥️", "💬", "💳", "🌐", "📋"][i]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "4px", color: "#FFF" }}>
                    {tool.tool}
                  </div>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "10px", lineHeight: "1.5" }}>
                    {tool.role}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <span style={{
                      fontSize: "10px",
                      color: phaseColors[i % 4],
                      background: `${phaseColors[i % 4]}15`,
                      padding: "3px 8px",
                      borderRadius: "3px"
                    }}>{tool.cost}</span>
                    <span style={{
                      fontSize: "10px",
                      color: "#444",
                      border: "1px solid #222",
                      padding: "3px 8px",
                      borderRadius: "3px"
                    }}>{tool.phase}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "32px",
            background: "#FF6B351A",
            border: "1px solid #FF6B3533",
            borderRadius: "8px",
            padding: "24px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <div style={{ fontSize: "11px", color: "#FF6B35", letterSpacing: "3px", marginBottom: "6px" }}>
                COSTE OPERATIVO MENSUAL
              </div>
              <div style={{ fontSize: "13px", color: "#888" }}>
                Todo el stack hasta 100 clientes activos
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "36px", fontWeight: "900", color: "#FF6B35" }}>€225</div>
              <div style={{ fontSize: "10px", color: "#444" }}>/ mes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

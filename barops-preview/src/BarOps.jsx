import React, { useState, useRef, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  LayoutDashboard, Package, Users, Bot, BarChart2,
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Send, HelpCircle, Plus, Bell, X, Zap,
  ShoppingCart, ChevronDown, ChevronUp, UserCheck,
  BookOpen, Trash2, CreditCard, Store, Settings, Wine,
} from 'lucide-react';

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#0A0A0A', card:'#111111', cardAlt:'#0D0D0D',
  border:'#1A1A1A', border2:'#222222',
  orange:'#FF6B35', teal:'#00D4AA', purple:'#7C3AED',
  amber:'#F59E0B', red:'#EF4444',
  text:'#E8E8E8', textSec:'#888888',
  orangeBg:'#FF6B3515', tealBg:'#00D4AA15',
  purpleBg:'#7C3AED15', amberBg:'#F59E0B15', redBg:'#EF444415',
};
const F = "'Courier New', Courier, monospace";

// Fuzzy search para ingredientes
const fuzzyMatch = (query, text) => {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return true;
  let qIdx = 0, score = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) { qIdx++; score += 10; }
    else if (i > 0 && t[i-1] === ' ') score += 1;
  }
  return qIdx === q.length ? score : 0;
};

const filterIngredients = (query, ingredients) => {
  if (!query.trim()) return ingredients;
  return ingredients
    .map(ing => ({ ...ing, score: Math.max(fuzzyMatch(query, ing.name), fuzzyMatch(query, ing.cat)) }))
    .filter(ing => ing.score > 0)
    .sort((a,b) => b.score - a.score);
};

// CSV parser para cócteles
const parseCocktailsCSV = (raw) => {
  const lines = raw.trim().split('\n').filter(l=>l.trim());
  if (lines.length < 2) return { ok:false, items:[], errors:['CSV vacío'] };

  const headerLine = lines[0];
  const sep = headerLine.includes('\t') ? '\t' : headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(sep).map(h=>h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''));

  const mapping = {
    nombre: ['nombre','name','titulo','cocktail','coctel','product','producto'],
    tipo: ['tipo','type','categoria','category'],
    descripcion: ['descripcion','description','notas','notes','ingredientes','ingredients','receta'],
    precio: ['precio','price','venta','sale_price','pvp','cost','coste'],
  };

  const getCol = (k) => headers.findIndex(h => mapping[k].includes(h));
  const colNombre = getCol('nombre'), colTipo = getCol('tipo'), colDesc = getCol('descripcion'), colPrecio = getCol('precio');

  if (colNombre < 0 || colPrecio < 0) {
    return { ok:false, items:[], errors:['Faltan columnas: nombre y precio son obligatorias'] };
  }

  const items = [], errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c=>c.trim());
    const nombre = cells[colNombre]?.trim();
    const tipoRaw = colTipo >= 0 ? cells[colTipo]?.trim().toLowerCase() || '' : '';
    const tipo = ['clasico','clasicos','classic'].includes(tipoRaw) ? 'clasico' : 'autor';
    const descripcion = colDesc >= 0 ? cells[colDesc]?.trim() || '' : '';
    const precioStr = cells[colPrecio]?.trim().replace('€','').replace(',','.') || '';
    const precio = parseFloat(precioStr);

    if (!nombre) { errors.push(`Fila ${i+1}: falta nombre`); continue; }
    if (!precio || isNaN(precio)) { errors.push(`Fila ${i+1}: precio inválido`); continue; }

    items.push({
      id: `custom_cocktail_${Date.now()}_${i}`,
      name: nombre,
      tipo: tipo,
      description: descripcion,
      price: precio,
      cost: 0,
      margin: '0',
      ingredients: [],
    });
  }

  return { ok:true, items, errors };
};

// ─── AGENT SYSTEM PROMPT ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el Agente BarOps de Paradiso Cocktail Bar en Madrid. Eres un analista de negocio experto en hostelería.
Tienes acceso en tiempo real a los datos del local. Respondes siempre en español, de forma directa y con datos concretos.
Cuando calcules costes, usa los precios de proveedor exactos. Usa emojis con moderación solo cuando aporten claridad.
Termina siempre con una recomendación accionable en 1 línea.

== INVENTARIO ACTUAL ==
- Aperol: 0.8 L → 1 día restante 🔴 CRÍTICO
- Campari: 1.1 L → 2 días 🔴 CRÍTICO
- Gin Hendrick's: 2.3 L → 3 días 🔴 CRÍTICO
- Limones frescos: 28 ud → 4 días 🟡 MEDIO
- Vermut Martini Rosso: 3.2 L → 12 días
- Tequila Patrón Silver: 2.9 L → 14 días
- Cointreau: 1.5 L → 13 días
- Ron Diplomatico Reserva: 4.8 L → 16 días
- Whisky Jameson: 5.6 L → 20 días
- Champagne Moët: 18 bot → 15 días

== PRECIOS PROVEEDOR (Eurocash Madrid) ==
- Gin Hendrick's 70cl: €15.20 → 4cl = €0.87
- Campari 1L: €14.90 → 3cl = €0.45
- Vermut Martini Rosso 1L: €11.30 → 3cl = €0.34
- Aperol 1L: €11.80 → 6cl = €0.71
- Tequila Patrón Silver 70cl: €28.40 → 4.5cl = €1.83
- Ron Diplomatico 70cl: €22.10 → 4cl = €1.26
- Whisky Jameson 70cl: €17.90 → 4cl = €1.02
- Cointreau 70cl: €18.60 → 2cl = €0.53
- Prosecco Zardetto: €6.80/bot
- Limones: €0.12/ud
- Hielo operativo: €0.04/coctel
- Gaseosa/soda: €0.08
- Guarnición media: €0.09

== RECETAS ESTÁNDAR Y COSTES REALES ==
- Negroni: Hendricks 4cl + Campari 3cl + Martini 3cl + twist naranja + hielo = €1.78 → venta €12 → margen 85.2%
- Aperol Spritz: Aperol 6cl + Prosecco 9cl + soda + naranja = €1.42 → venta €10 → margen 85.8%
- Gin Tonic Hendricks: Hendricks 5cl + tónica premium + pepino = €1.34 → venta €11 → margen 87.8%
- Old Fashioned: Jameson 6cl + Angostura + azúcar + naranja = €1.67 → venta €13 → margen 87.2%
- Mojito: Ron Diplomatico 5cl + lime + menta + azúcar + soda = €1.54 → venta €9.50 → margen 83.8%
- Margarita: Patrón 4.5cl + Cointreau 2cl + lime = €2.36 → venta €12 → margen 80.3%
- Dry Martini: Hendricks 6cl + Martini 1cl + aceituna = €1.71 → venta €13 → margen 86.8%

== STAFFING SEMANA ACTUAL ==
Cubiertos: Carlos M. (hoy 18-02), Ana R. (hoy 20-04), Miguel F. (jue 19-01), Laura S. (vie 18-04), David K. (sáb 18-05), Carmen B. (dom 17-00)
PENDIENTES: Mar 29 Abr 18-02 Bartender Senior, Mar 29 Abr 21-03 Coctelero Clásico, Vie 1 May 20-04 Barback, Sáb 2 May 20-05 Coctelero Clásico

== RED DE TALENTO DISPONIBLE ==
HOY: Carlos Mendoza ⭐4.9 €16/h, Ana Ruiz ⭐4.7 €14/h, David Kovacs ⭐4.9 €18/h, Rafa Moreno ⭐4.5 €9/h
ESTE FINDE: Miguel Fernández ⭐4.8 €11/h, Laura Sánchez ⭐5.0 €19/h, Nora Iglesias ⭐4.8 €17/h

== DATOS FINANCIEROS ==
- Merma este mes: €710 (era €1.850/mes antes de BarOps en noviembre)
- Ahorro acumulado 6 meses: €7.240
- ROI BarOps este mes: 5.7x (€199 coste → €1.140 ahorro)
- Ticket medio Paradiso: €28
- Servicio medio finde: 85-110 personas`;

// ─── DATA ─────────────────────────────────────────────────────────────────────
const INVENTORY = [
  { id:1,  name:"Aperol",               cat:"Aperitivo",    stock:"0.8 L",  pct:8,  weekly:"3.4 L", days:1,  cost:"€0.54", risk:"critical" },
  { id:2,  name:"Campari",              cat:"Amaro",        stock:"1.1 L",  pct:11, weekly:"2.8 L", days:2,  cost:"€0.62", risk:"critical" },
  { id:3,  name:"Gin Hendrick's",       cat:"Ginebra",      stock:"2.3 L",  pct:23, weekly:"4.2 L", days:3,  cost:"€0.87", risk:"critical" },
  { id:4,  name:"Limones frescos",      cat:"Fruta fresca", stock:"28 ud",  pct:31, weekly:"45 ud", days:4,  cost:"€0.12", risk:"medium"   },
  { id:5,  name:"Vermut Martini Rosso", cat:"Vermut",       stock:"3.2 L",  pct:43, weekly:"1.8 L", days:12, cost:"€0.45", risk:"medium"   },
  { id:6,  name:"Tequila Patrón Silver",cat:"Tequila",      stock:"2.9 L",  pct:48, weekly:"1.4 L", days:14, cost:"€1.45", risk:"medium"   },
  { id:7,  name:"Cointreau",            cat:"Triple Seco",  stock:"1.5 L",  pct:50, weekly:"0.8 L", days:13, cost:"€0.78", risk:"medium"   },
  { id:8,  name:"Ron Diplomatico Rsva", cat:"Ron",          stock:"4.8 L",  pct:68, weekly:"2.1 L", days:16, cost:"€1.23", risk:"stable"   },
  { id:9,  name:"Whisky Jameson",       cat:"Whisky",       stock:"5.6 L",  pct:75, weekly:"1.9 L", days:20, cost:"€0.98", risk:"stable"   },
  { id:10, name:"Champagne Moët",       cat:"Espumoso",     stock:"18 bot", pct:90, weekly:"8 bot", days:15, cost:"€8.50", risk:"stable"   },
];

const OPEN_SHIFTS = [
  { id:3, date:"Mar 29 Abr", time:"18:00 – 02:00", profile:"Bartender Senior",    status:"searching", cost:"€145", match:["Carlos Mendoza","David Kovacs"]   },
  { id:4, date:"Mar 29 Abr", time:"21:00 – 03:00", profile:"Coctelero Clásico",   status:"urgent",    cost:"€136", match:["Carlos Mendoza","Laura Sánchez"]  },
  { id:7, date:"Vie 1 May",  time:"20:00 – 04:00", profile:"Barback / Ayudante",  status:"searching", cost:"€72",  match:["Rafa Moreno"]                     },
  { id:9, date:"Sáb 2 May",  time:"20:00 – 05:00", profile:"Coctelero Clásico",   status:"urgent",    cost:"€152", match:["Laura Sánchez","Carlos Mendoza"]  },
];

const COVERED_SHIFTS = [
  { id:1, date:"Hoy, 28 Abr", time:"18:00 – 02:00", profile:"Bartender Coctelería", pro:"Carlos M.", cost:"€128", rating:4.9 },
  { id:2, date:"Hoy, 28 Abr", time:"20:00 – 04:00", profile:"Camarero Sala",         pro:"Ana R.",    cost:"€96",  rating:4.7 },
  { id:5, date:"Jue 30 Abr",  time:"19:00 – 01:00", profile:"Camarero Barras",       pro:"Miguel F.", cost:"€88",  rating:4.8 },
  { id:6, date:"Vie 1 May",   time:"18:00 – 04:00", profile:"Bartender Coctelería",  pro:"Laura S.",  cost:"€152", rating:5.0 },
  { id:8, date:"Sáb 2 May",   time:"18:00 – 05:00", profile:"Bartender Senior",      pro:"David K.",  cost:"€168", rating:4.9 },
  { id:10,date:"Dom 3 May",   time:"17:00 – 00:00", profile:"Camarero Sala",          pro:"Carmen B.", cost:"€84",  rating:4.6 },
];

const TALENT = [
  { id:1, name:"Carlos Mendoza",   ini:"CM", spec:"Coctelería Clásica", rating:4.9, rate:"€16/h", avail:"today",       tags:["Negroni","Old Fashioned","Gin Tonics"] },
  { id:2, name:"Ana Ruiz",         ini:"AR", spec:"Mixología Creativa", rating:4.7, rate:"€14/h", avail:"today",       tags:["Mocktails","Bar Show","Premium"]       },
  { id:5, name:"David Kovacs",     ini:"DK", spec:"Bartender Flair",    rating:4.9, rate:"€18/h", avail:"today",       tags:["Flair","Tropical","Espectáculo"]       },
  { id:7, name:"Rafa Moreno",      ini:"RM", spec:"Barback Senior",     rating:4.5, rate:"€9/h",  avail:"today",       tags:["Mise en place","Soporte","Limpieza"]   },
  { id:3, name:"Miguel Fernández", ini:"MF", spec:"Camarero de Sala",   rating:4.8, rate:"€11/h", avail:"weekend",     tags:["Vinos","Servicio mesa","TPV"]          },
  { id:4, name:"Laura Sánchez",    ini:"LS", spec:"Head Bartender",     rating:5.0, rate:"€19/h", avail:"weekend",     tags:["Cartas","Formación","Cost control"]    },
  { id:8, name:"Nora Iglesias",    ini:"NI", spec:"Sumiller",           rating:4.8, rate:"€17/h", avail:"weekend",     tags:["Vinos","Champagne","Maridaje"]         },
  { id:6, name:"Carmen Blanco",    ini:"CB", spec:"Camarera de Sala",   rating:4.6, rate:"€10/h", avail:"unavailable", tags:["Idiomas","Eventos","Protocolo"]        },
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
  { n:"Ginebras",v:4850 },{ n:"Espumosos",v:3400 },{ n:"Rones",v:3200 },
  { n:"Whisky",v:2800 }, { n:"Tequila",v:2100 }, { n:"Vermuts",v:1900 },
  { n:"Aperitivos",v:1650 },{ n:"Misc",v:1200 },
];
const TOP_PRODUCTS = [
  { name:"Gin Tonic Hendrick's", cat:"Combinado", cost:"€1.34",price:"€11.00",margin:"87.8%",units:521 },
  { name:"Dry Martini",          cat:"Cóctel",    cost:"€1.71",price:"€13.00",margin:"86.8%",units:198 },
  { name:"Old Fashioned",        cat:"Cóctel",    cost:"€1.67",price:"€13.00",margin:"87.2%",units:156 },
  { name:"Negroni",              cat:"Cóctel",    cost:"€1.78",price:"€12.00",margin:"85.2%",units:312 },
  { name:"Aperol Spritz",        cat:"Aperitivo", cost:"€1.42",price:"€10.00",margin:"85.8%",units:428 },
  { name:"Mojito",               cat:"Cóctel",    cost:"€1.54",price:"€9.50", margin:"83.8%",units:384 },
  { name:"Whisky Jameson Solo",  cat:"Destilado", cost:"€1.02",price:"€8.00", margin:"87.3%",units:267 },
  { name:"Margarita",            cat:"Cóctel",    cost:"€2.36",price:"€12.00",margin:"80.3%",units:187 },
  { name:"Cosmopolitan",         cat:"Cóctel",    cost:"€2.42",price:"€12.50",margin:"80.6%",units:143 },
  { name:"Champagne Moët Copa",  cat:"Espumoso",  cost:"€8.50",price:"€18.00",margin:"52.8%",units:89  },
];

// ─── CARTA DATA ───────────────────────────────────────────────────────────────
const INGREDIENTS_DB = [
  // Ginebras
  { id:'hendricks',    name:"Gin Hendrick's",         unit:'ml',  cpu:0.217, cat:'Ginebra'     },
  { id:'tanqueray',    name:"Gin Tanqueray",           unit:'ml',  cpu:0.186, cat:'Ginebra'     },
  { id:'bombay',       name:"Gin Bombay Sapphire",    unit:'ml',  cpu:0.162, cat:'Ginebra'     },
  { id:'nordes',       name:"Gin Nordés",              unit:'ml',  cpu:0.228, cat:'Ginebra'     },
  // Rones
  { id:'ron_dip',      name:"Ron Diplomatico Rsva",   unit:'ml',  cpu:0.316, cat:'Ron'         },
  { id:'ron_brugal',   name:"Ron Brugal Añejo",       unit:'ml',  cpu:0.198, cat:'Ron'         },
  { id:'ron_zacapa',   name:"Ron Zacapa 23",          unit:'ml',  cpu:0.412, cat:'Ron'         },
  // Tequila & Mezcal
  { id:'patron',       name:"Tequila Patrón Silver",  unit:'ml',  cpu:0.406, cat:'Tequila'     },
  { id:'jimador',      name:"Tequila El Jimador",     unit:'ml',  cpu:0.198, cat:'Tequila'     },
  { id:'mezcal_del',   name:"Mezcal Del Maguey",      unit:'ml',  cpu:0.486, cat:'Mezcal'      },
  // Whisky
  { id:'jameson',      name:"Whisky Jameson",         unit:'ml',  cpu:0.256, cat:'Whisky'      },
  { id:'monkey',       name:"Monkey Shoulder",        unit:'ml',  cpu:0.282, cat:'Whisky'      },
  { id:'bulleit_rye',  name:"Bulleit Rye",            unit:'ml',  cpu:0.312, cat:'Whisky'      },
  // Aperitivos & Amari
  { id:'campari',      name:"Campari",                 unit:'ml',  cpu:0.149, cat:'Amaro'       },
  { id:'aperol',       name:"Aperol",                  unit:'ml',  cpu:0.118, cat:'Aperitivo'   },
  { id:'cynar',        name:"Cynar",                   unit:'ml',  cpu:0.168, cat:'Amaro'       },
  { id:'fernet',       name:"Fernet Branca",           unit:'ml',  cpu:0.182, cat:'Amaro'       },
  // Vermuts
  { id:'martini_r',    name:"Vermut Martini Rosso",   unit:'ml',  cpu:0.113, cat:'Vermut'      },
  { id:'martini_b',    name:"Vermut Martini Bianco",  unit:'ml',  cpu:0.108, cat:'Vermut'      },
  { id:'noilly',       name:"Noilly Prat Dry",        unit:'ml',  cpu:0.138, cat:'Vermut'      },
  // Licores
  { id:'cointreau',    name:"Cointreau",                unit:'ml',  cpu:0.266, cat:'Triple Seco' },
  { id:'licor43',      name:"Licor 43",                 unit:'ml',  cpu:0.192, cat:'Licor'       },
  { id:'kahlua',       name:"Kahlúa",                   unit:'ml',  cpu:0.195, cat:'Licor'       },
  { id:'baileys',      name:"Baileys",                  unit:'ml',  cpu:0.178, cat:'Crema'       },
  { id:'amaretto',     name:"Amaretto Disaronno",      unit:'ml',  cpu:0.213, cat:'Licor'       },
  { id:'st_germain',   name:"St-Germain Elderflower",  unit:'ml',  cpu:0.312, cat:'Licor'       },
  { id:'chartreuse_v', name:"Chartreuse Verde",        unit:'ml',  cpu:0.428, cat:'Licor'       },
  // Espumosos
  { id:'prosecco',     name:"Prosecco Zardetto",      unit:'ml',  cpu:0.091, cat:'Espumoso'    },
  { id:'cava',         name:"Cava Brut",               unit:'ml',  cpu:0.062, cat:'Espumoso'    },
  // Mixers
  { id:'tonica_prem',  name:"Tónica Premium (25cl)",  unit:'ml',  cpu:0.025, cat:'Mixer'       },
  { id:'ginger_beer',  name:"Ginger Beer",             unit:'ml',  cpu:0.028, cat:'Mixer'       },
  { id:'soda',         name:"Soda",                    unit:'ml',  cpu:0.008, cat:'Mixer'       },
  { id:'cola',         name:"Coca-Cola",                unit:'ml',  cpu:0.012, cat:'Mixer'       },
  { id:'agua_coco',    name:"Agua de coco",            unit:'ml',  cpu:0.034, cat:'Mixer'       },
  // Zumos frescos
  { id:'zumo_limon',   name:"Zumo limón fresco",      unit:'ml',  cpu:0.018, cat:'Fresco'      },
  { id:'zumo_lima',    name:"Zumo lima fresco",        unit:'ml',  cpu:0.021, cat:'Fresco'      },
  { id:'zumo_naranja', name:"Zumo naranja fresco",     unit:'ml',  cpu:0.015, cat:'Fresco'      },
  { id:'zumo_pina',    name:"Zumo piña natural",       unit:'ml',  cpu:0.022, cat:'Fresco'      },
  { id:'zumo_cranb',   name:"Zumo cranberry",          unit:'ml',  cpu:0.019, cat:'Zumo'        },
  { id:'zumo_frutos',  name:"Zumo frutos rojos",      unit:'ml',  cpu:0.026, cat:'Zumo'        },
  // Siropes
  { id:'sirope_az',    name:"Sirope de azúcar",        unit:'ml',  cpu:0.012, cat:'Sirope'      },
  { id:'grenadine',    name:"Granadina",                unit:'ml',  cpu:0.016, cat:'Sirope'      },
  { id:'orgeat',       name:"Orgeat / Almendra",       unit:'ml',  cpu:0.028, cat:'Sirope'      },
  { id:'sirope_mango', name:"Sirope de mango",         unit:'ml',  cpu:0.024, cat:'Sirope'      },
  { id:'sirope_vainilla',name:"Sirope de vainilla",    unit:'ml',  cpu:0.022, cat:'Sirope'      },
  { id:'miel',         name:"Sirope de miel",          unit:'ml',  cpu:0.032, cat:'Sirope'      },
  // Guarniciones
  { id:'garn_limon',   name:"Limón (twist/rodaja)",    unit:'ud',  cpu:0.12,  cat:'Guarnición'  },
  { id:'garn_naranja', name:"Naranja (twist/media)",   unit:'ud',  cpu:0.09,  cat:'Guarnición'  },
  { id:'garn_lima',    name:"Lima (twist/rodaja)",     unit:'ud',  cpu:0.14,  cat:'Guarnición'  },
  { id:'menta',        name:"Menta fresca (rama)",     unit:'ud',  cpu:0.08,  cat:'Guarnición'  },
  { id:'oliva',        name:"Aceituna cocktail",       unit:'ud',  cpu:0.05,  cat:'Guarnición'  },
  { id:'cereza',       name:"Cereza marrasquino",      unit:'ud',  cpu:0.12,  cat:'Guarnición'  },
  { id:'pepino',       name:"Pepino (rodaja)",         unit:'ud',  cpu:0.06,  cat:'Guarnición'  },
  // Operativos
  { id:'hielo',        name:"Hielo (coste operativo)", unit:'uso', cpu:0.04,  cat:'Operativo'   },
  { id:'sal_borde',    name:"Sal / azúcar borde",      unit:'uso', cpu:0.03,  cat:'Operativo'   },
  { id:'clara_huevo',  name:"Clara de huevo",          unit:'uso', cpu:0.08,  cat:'Operativo'   },
];

const CLASSIC_COCKTAILS_DATA = [
  { id:'negroni',      name:"Negroni",              cost:1.78, price:12.00, margin:"85.2", description:"Hendrick's · Campari · Martini Rosso",        ings:[{n:"Gin Hendrick's 4 cl"},{n:"Campari 3 cl"},{n:"Vermut Martini Rosso 3 cl"},{n:"Twist naranja"},{n:"Hielo"}] },
  { id:'spritz',       name:"Aperol Spritz",         cost:1.42, price:10.00, margin:"85.8", description:"Aperol · Prosecco · Soda · Naranja",          ings:[{n:"Aperol 6 cl"},{n:"Prosecco 9 cl"},{n:"Soda 2 cl"},{n:"Rodaja naranja"}] },
  { id:'gintonic',     name:"Gin Tonic Hendrick's",  cost:1.34, price:11.00, margin:"87.8", description:"Hendrick's · Tónica Premium · Pepino",        ings:[{n:"Gin Hendrick's 5 cl"},{n:"Tónica Premium 15 cl"},{n:"Pepino (rodaja)"}] },
  { id:'old_fashioned',name:"Old Fashioned",         cost:1.67, price:13.00, margin:"87.2", description:"Jameson · Angostura · Azúcar · Naranja",      ings:[{n:"Whisky Jameson 6 cl"},{n:"Angostura 2 dashes"},{n:"Azúcar (terrón)"},{n:"Twist naranja"},{n:"Hielo"}] },
  { id:'mojito',       name:"Mojito",                cost:1.54, price:9.50,  margin:"83.8", description:"Ron Diplomatico · Lima · Menta · Soda",       ings:[{n:"Ron Diplomatico 5 cl"},{n:"Zumo lima 2 cl"},{n:"Menta fresca"},{n:"Sirope azúcar 1 cl"},{n:"Soda 8 cl"}] },
  { id:'margarita',    name:"Margarita",              cost:2.36, price:12.00, margin:"80.3", description:"Patrón Silver · Cointreau · Lima · Sal",      ings:[{n:"Patrón Silver 4.5 cl"},{n:"Cointreau 2 cl"},{n:"Zumo lima 2 cl"},{n:"Sal borde"}] },
  { id:'dry_martini',  name:"Dry Martini",           cost:1.71, price:13.00, margin:"86.8", description:"Hendrick's · Vermut Bianco · Aceituna",       ings:[{n:"Gin Hendrick's 6 cl"},{n:"Vermut Martini Bianco 1 cl"},{n:"Aceituna"},{n:"Hielo"}] },
  { id:'cosmo',        name:"Cosmopolitan",           cost:2.42, price:12.50, margin:"80.6", description:"Patrón Silver · Cointreau · Cranberry · Lima",ings:[{n:"Patrón Silver 4 cl"},{n:"Cointreau 1.5 cl"},{n:"Zumo cranberry 3 cl"},{n:"Zumo lima 1.5 cl"}] },
];

const marginColor = (m) => {
  const n = parseFloat(m);
  return n >= 80 ? C.teal : n >= 65 ? C.amber : '#EF4444';
};

const INITIAL_CHAT = [
  { id:1, role:"user",  time:"14:23", text:"¿Qué me va a faltar este fin de semana?" },
  {
    id:2, role:"agent", time:"14:23",
    text:`Analizado tu historial de 8 semanas + reservas del finde. 3 críticos y 2 preventivos:

🔴 CRÍTICO — Aperol (0.8 L): consumo estimado 6.2 L. Sin stock el viernes a las 22h
🔴 CRÍTICO — Campari (1.1 L): estimado 4.8 L. Sin stock sábado al mediodía
🔴 CRÍTICO — Gin Hendrick's (2.3 L): tres grupos con cumpleaños el sábado, estimado 7.4 L
🟡 PREVENTIVO — Limones frescos (28 ud): necesitas mínimo 85 ud viernes + sábado
🟡 PREVENTIVO — Vermut Martini Rosso: ajustado si el Negroni sale como el sábado pasado

→ Haz el pedido antes del jueves en Eurocash Madrid (Vallecas). ¿Genero la lista completa?`,
  },
  { id:3, role:"user",  time:"14:25", text:"¿Cuánto me cuesta de verdad un Negroni?" },
  {
    id:4, role:"agent", time:"14:25",
    text:`Calculado con tus precios de proveedor actuales:

NEGRONI — Desglose coste real:
  • Gin Hendrick's 4 cl  →  €0.87
  • Campari 3 cl          →  €0.45
  • Martini Rosso 3 cl    →  €0.34
  • Naranja / twist       →  €0.08
  • Hielo rotatorio       →  €0.04

COSTE TOTAL → €1.78 | PRECIO CARTA → €12.00 | MARGEN → 85.2%

⚡ Tu teórico era €1.61. La diferencia (+€0.17) es merma en cítricos y derrame en Campari. ~€53/mes de pérdida silenciosa solo en Negronis.`,
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getNow() {
  return new Date().toLocaleTimeString('es-ES',{ hour:'2-digit', minute:'2-digit' });
}

async function callClaude(history) {
  const res = await fetch('/api/anthropic/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({
      model:'claude-sonnet-4-6',
      max_tokens:1024,
      system: SYSTEM_PROMPT,
      messages: history.map(m=>({ role:m.role==='agent'?'assistant':'user', content:m.text })),
    }),
  });
  if (!res.ok) {
    if (res.status===401||res.status===403) throw new Error('API_KEY_MISSING');
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error?.message||`HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// ─── APP CONTEXT ──────────────────────────────────────────────────────────────
const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

// ─── CSV IMPORT ───────────────────────────────────────────────────────────────
const TEMPLATE_CSV = `nombre,categoria,stock,unidad,precio,volumen_cl
Gin Hendrick's,Ginebra,3,bot,15.20,70
Campari,Amaro,2,bot,14.90,100
Ron Diplomatico Reserva,Ron,5,bot,22.10,70
Limones frescos,Fruta fresca,80,ud,0.12,
Tónica Premium 25cl,Mixer,24,ud,0.65,
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
      stock:stockStr, pct, days, risk,
      weekly:'', cost:`€${cpu.toFixed(3)}`,
    });
  }
  return { ok:true, items:results, errors };
}


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
function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'3px 8px',
      borderRadius:'2px', fontSize:'10px', fontFamily:F,
      letterSpacing:'1.5px', fontWeight:700,
      color, background:bg, border:`1px solid ${color}44`, whiteSpace:'nowrap',
    }}>
      {label}
    </span>
  );
}
function RiskBadge({ risk }) {
  const M = { critical:{label:'CRÍTICO',color:'#EF4444',bg:'#EF444415'}, medium:{label:'MEDIO',color:C.amber,bg:C.amberBg}, stable:{label:'ESTABLE',color:C.teal,bg:C.tealBg} };
  const m = M[risk]||M.stable;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
function ShiftBadge({ status }) {
  const M = { covered:{label:'CUBIERTO',color:C.teal,bg:C.tealBg}, searching:{label:'BUSCANDO',color:C.amber,bg:C.amberBg}, urgent:{label:'URGENTE',color:'#EF4444',bg:'#EF444415'} };
  const m = M[status]||M.searching;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
function AvailBadge({ avail }) {
  const M = { today:{label:'DISPONIBLE HOY',color:C.teal,bg:C.tealBg}, weekend:{label:'ESTE FINDE',color:C.amber,bg:C.amberBg}, unavailable:{label:'NO DISPONIBLE',color:C.textSec,bg:'#88888815'} };
  const m = M[avail]||M.unavailable;
  return <Badge label={m.label} color={m.color} bg={m.bg}/>;
}
function StockBar({ pct }) {
  const color = pct<20?'#EF4444':pct<45?C.amber:C.teal;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <div style={{ width:72, height:5, background:'#2a2a2a', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3 }}/>
      </div>
      <span style={{ fontFamily:F, fontSize:'11px', color:C.textSec, minWidth:28 }}>{pct}%</span>
    </div>
  );
}
function Stars({ rating }) {
  return (
    <span style={{ fontFamily:F, fontSize:'12px' }}>
      <span style={{ color:C.amber }}>{'★'.repeat(Math.floor(rating))}</span>
      <span style={{ color:'#2a2a2a' }}>{'★'.repeat(5-Math.floor(rating))}</span>
      <span style={{ color:C.textSec, marginLeft:5, fontSize:'11px' }}>{rating}</span>
    </span>
  );
}
function Avatar({ ini, size=44 }) {
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
function Toast({ msg, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3200); return ()=>clearTimeout(t); },[onClose]);
  return (
    <div style={{
      position:'fixed', bottom:28, right:28, zIndex:9999,
      background:C.teal, color:'#000', padding:'12px 20px',
      borderRadius:4, fontFamily:F, fontSize:'12px', letterSpacing:'1.5px', fontWeight:700,
      boxShadow:`0 4px 28px ${C.teal}55`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <CheckCircle size={15}/>{msg}
      <X size={13} style={{ cursor:'pointer', opacity:.7 }} onClick={onClose}/>
    </div>
  );
}
function Btn({ children, onClick, variant='primary', disabled=false, sx={} }) {
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
      cursor:disabled?'default':'pointer', fontSize:'10px', padding:'7px 14px',
      display:'inline-flex', alignItems:'center', gap:6,
      opacity:disabled?.4:1, transition:'filter 0.15s',
      ...V[variant], ...sx,
    }}>
      {children}
    </button>
  );
}
function Card({ children, accent, sx={}, ...props }) {
  return (
    <div style={{
      background:C.card, border:`1px solid ${accent?accent+'33':C.border2}`,
      borderRadius:4, fontFamily:F, ...sx,
    }} {...props}>
      {children}
    </div>
  );
}
function SLabel({ label, color=C.orange, icon:Icon }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      {Icon&&<Icon size={13} color={color}/>}
      <span style={{ fontFamily:F, fontSize:'11px', color, letterSpacing:'3px', fontWeight:700 }}>{label}</span>
    </div>
  );
}
function TypingDots() {
  const [d,setD] = useState(0);
  useEffect(()=>{ const t=setInterval(()=>setD(p=>(p+1)%4),380); return ()=>clearInterval(t); },[]);
  return <span style={{ fontFamily:F, fontSize:'20px', color:C.teal, letterSpacing:6 }}>{'●'.repeat(d+1)}{'○'.repeat(3-d)}</span>;
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, localName, onOpenLocalSettings }) {
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
        <div style={{ fontFamily:F, fontSize:'24px', fontWeight:700, color:C.orange, letterSpacing:'7px', lineHeight:1 }}>BAROPS</div>
        <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'3px', marginTop:5 }}>SISTEMA OPERATIVO</div>
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
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        <div style={{ position:'fixed', top:0, left:0, right:0, height:60, background:C.cardAlt, borderBottom:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:1000 }}>
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
function Dashboard() {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState([
    { label:'REFERENCIAS EN INVENTARIO', value:0, sub:'productos activos', color:C.teal, Icon:Package, bg:C.tealBg },
    { label:'STOCK EN RIESGO', value:0, sub:'productos críticos', color:'#EF4444', Icon:AlertTriangle, bg:'#EF444415' },
    { label:'VALOR TOTAL INVENTARIO', value:'€0', sub:'stock valorizado', color:C.orange, Icon:TrendingUp, bg:C.orangeBg },
    { label:'PRODUCTOS SIN STOCK', value:0, sub:'necesitan reposición', color:C.amber, Icon:Package, bg:C.amberBg },
  ]);
  const [criticalProducts, setCriticalProducts] = useState([]);
  const LOCAL_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!supabase) throw new Error('Supabase no conectado');
      const { data:products, error } = await supabase.from('productos').select('*').eq('local_id', LOCAL_ID);
      if (error) throw error;

      if (!products || products.length === 0) {
        setLoading(false);
        return;
      }

      const totalRefs = products.length;
      const criticalCount = products.filter(p => parseFloat(p.stock_actual || 0) <= parseFloat(p.stock_minimo || 0)).length;
      const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.stock_actual || 0) * parseFloat(p.coste_unitario || 0)), 0);
      const zeroStockCount = products.filter(p => parseFloat(p.stock_actual || 0) === 0).length;

      setKpis([
        { label:'REFERENCIAS EN INVENTARIO', value:totalRefs, sub:'productos activos', color:C.teal, Icon:Package, bg:C.tealBg },
        { label:'STOCK EN RIESGO', value:`${criticalCount} REF.`, sub:'Nivel: ' + (criticalCount > 0 ? 'CRÍTICO' : 'OK'), color:criticalCount > 0 ? '#EF4444' : C.teal, Icon:AlertTriangle, bg:criticalCount > 0 ? '#EF444415' : C.tealBg },
        { label:'VALOR TOTAL INVENTARIO', value:`€${totalValue.toFixed(2)}`, sub:'stock valorizado', color:C.orange, Icon:TrendingUp, bg:C.orangeBg },
        { label:'PRODUCTOS SIN STOCK', value:zeroStockCount, sub:'necesitan reposición', color:C.amber, Icon:Package, bg:C.amberBg },
      ]);

      const criticals = products
        .map(p => ({...p, diff: parseFloat(p.stock_actual || 0) - parseFloat(p.stock_minimo || 0)}))
        .filter(p => p.diff < 0)
        .sort((a,b) => a.diff - b.diff)
        .slice(0,5);
      setCriticalProducts(criticals);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setToast('Error al cargar datos del dashboard');
      setLoading(false);
    }
  };

  const CHIPS = ['¿Qué me va a faltar este finde?','¿Cuánto me cuesta un Negroni real?','Necesito un bartender mañana'];

  if (loading) {
    return (
      <div style={{ flex:1, padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO...</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>DASHBOARD</h1>
          <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>Paradiso Cocktail Bar — {new Date().toLocaleDateString('es-ES', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Bell size={15} color={C.textSec} style={{ cursor:'pointer' }}/>
          <div style={{ padding:'6px 14px', background:C.tealBg, border:`1px solid ${C.teal}44`, borderRadius:2, fontFamily:F, fontSize:'9px', color:C.teal, letterSpacing:'2px', fontWeight:700 }}>
            ● SISTEMA ACTIVO
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {kpis.map(({ label,value,sub,color,Icon,bg },i)=>(
          <Card key={i} accent={color} sx={{ padding:20, background:bg }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'2px', marginBottom:10 }}>{label}</div>
                <div style={{ fontSize:'30px', color, fontWeight:700, letterSpacing:'1px', lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:'11px', color:C.textSec, marginTop:8 }}>{sub}</div>
              </div>
              <Icon size={22} color={color} style={{ opacity:.55 }}/>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:14, marginBottom:16 }}>
        <Card sx={{ padding:20 }}>
          <SLabel label="ALERTAS DE INVENTARIO" color={C.orange} icon={AlertTriangle}/>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {criticalProducts.length > 0 ? (
              criticalProducts.map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border2}` }}>
                  <div>
                    <div style={{ fontFamily:F, fontSize:'12px', color:C.text, fontWeight:700 }}>{item.nombre}</div>
                    <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, marginTop:2 }}>Stock: {item.stock_actual} {item.unidad} (mín: {item.stock_minimo})</div>
                  </div>
                  <div style={{ padding:'4px 10px', background:'#EF444420', border:`1px solid #EF4444`, borderRadius:3, fontFamily:F, fontSize:'9px', color:'#EF4444', fontWeight:700 }}>CRÍTICO</div>
                </div>
              ))
            ) : (
              <div style={{ padding:'16px 0', textAlign:'center', color:C.teal, fontFamily:F, fontSize:'12px' }}>Todo el inventario en niveles correctos ✓</div>
            )}
          </div>
        </Card>
      </div>

      <Card sx={{ padding:20 }}>
        <SLabel label="ASISTENTE IA" color={C.purple} icon={Bot}/>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
          {CHIPS.map((c,i) => (
            <button key={i} onClick={() => setToast('Abriendo chat IA...')} style={{ padding:'8px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'10px', color:C.textSec, transition:'all 0.2s' }}>
              {c}
            </button>
          ))}
        </div>
      </Card>
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
          <span style={{ fontFamily:F, fontSize:'12px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>IMPORTAR CÓCTELES</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={18}/>
          </button>
        </div>

        {step === 1 && (
          <div>
            <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:12 }}>PASO 1: CARGAR CSV</div>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder="Pega tu CSV aquí (nombre,tipo,precio,descripcion)..."
              style={{ width:'100%', height:150, padding:'12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none', boxSizing:'border-box', marginBottom:12, resize:'vertical' }}
            />
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <Btn onClick={() => fileRef.current?.click()} sx={{ flex:1, padding:'10px', fontSize:'11px' }}>
                📎 CARGAR ARCHIVO
              </Btn>
              <Btn onClick={downloadTemplate} variant="outline" sx={{ flex:1, padding:'10px', fontSize:'11px' }}>
                📥 DESCARGAR TEMPLATE
              </Btn>
            </div>
            {parseErr && <div style={{ padding:'10px', background:'#EF444422', border:`1px solid #EF444433`, borderRadius:3, fontSize:'11px', color:'#EF4444', marginBottom:12 }}>{parseErr}</div>}
            <Btn onClick={handlePaste} sx={{ width:'100%', padding:'11px', fontSize:'11px' }}>
              → VERIFICAR CSV
            </Btn>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:12 }}>PASO 2: REVISAR ({parsed.length} cócteles — importarán como BORRADORES)</div>

            {parseErrors.length > 0 && (
              <div style={{ padding:'10px', background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:3, fontSize:'10px', color:C.amber, marginBottom:12 }}>
                ⚠ {parseErrors.length} filas con errores (serán ignoradas)
              </div>
            )}
            <div style={{ maxHeight:350, overflowY:'auto', marginBottom:14 }}>
              {parsed.map((c, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, marginBottom:8, gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'12px', color:C.text, fontWeight:700 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize:'10px', color:C.textSec, marginTop:2 }}>{c.description.substring(0,50)}</div>}
                    <div style={{ fontSize:'11px', color:C.orange, fontWeight:700, marginTop:3 }}>€{c.price.toFixed(2)}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select
                      value={c.tipo}
                      onChange={(e) => changeTipo(i, e.target.value)}
                      style={{
                        padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3,
                        fontFamily:F, fontSize:'11px', color:C.textSec, cursor:'pointer', minWidth:120,
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
              <Btn variant="outline" onClick={() => setStep(1)} sx={{ flex:1, padding:'11px', fontSize:'11px' }}>← ATRÁS</Btn>
              <Btn onClick={() => { onSave(parsed); onClose(); }} sx={{ flex:1, padding:'11px', fontSize:'11px' }}>✓ IMPORTAR {parsed.length}</Btn>
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
          <span style={{ fontFamily:F, fontSize:'12px', color:C.teal, letterSpacing:'3px', fontWeight:700 }}>CONFIGURAR CONSUMO</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:'13px', color:C.text, fontWeight:700, marginBottom:4 }}>{item.name}</div>
          <div style={{ fontSize:'11px', color:C.textSec, marginBottom:12 }}>Stock actual: {item.stock}</div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'1px', marginBottom:8 }}>USO SEMANAL ESTIMADO</div>
          <input
            value={weekly}
            onChange={e=>setWeekly(e.target.value)}
            placeholder="Ej: 3.5 L, 5 bot, 50 ud"
            style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box', marginBottom:12 }}
          />
          <div style={{ fontSize:'10px', color:C.textSec, lineHeight:'1.5', padding:'8px 10px', background:C.tealBg, borderRadius:3, border:`1px solid ${C.teal}33` }}>
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
            <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'1px', marginTop:3 }}>
              {step===1?'Pega tu CSV o sube el archivo de inventario':'Revisa los productos antes de confirmar'}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:'10px', color:step===1?C.orange:C.textSec, letterSpacing:'2px' }}>01 CARGAR</span>
            <span style={{ fontSize:'10px', color:C.border2 }}>──</span>
            <span style={{ fontSize:'10px', color:step===2?C.orange:C.textSec, letterSpacing:'2px' }}>02 CONFIRMAR</span>
            <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:C.textSec,display:'flex',marginLeft:8 }}><X size={16}/></button>
          </div>
        </div>

        {step===1 && (
          <div style={{ padding:'24px', overflowY:'auto' }}>
            {/* Template download */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:C.tealBg, border:`1px solid ${C.teal}33`, borderRadius:3, marginBottom:18 }}>
              <div>
                <div style={{ fontSize:'11px', color:C.teal, fontWeight:700, letterSpacing:'2px' }}>PLANTILLA CSV</div>
                <div style={{ fontSize:'11px', color:C.textSec, marginTop:2 }}>Columnas: nombre · categoria · stock · unidad · precio · volumen_cl</div>
              </div>
              <Btn variant="outline" onClick={downloadTemplate} sx={{ padding:'7px 14px', fontSize:'10px', borderColor:C.teal, color:C.teal }}>
                DESCARGAR
              </Btn>
            </div>

            {/* Format hint */}
            <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'1px', marginBottom:8 }}>
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
                fontSize:'12px', color:C.text, outline:'none', resize:'vertical',
                lineHeight:'1.6', boxSizing:'border-box',
              }}
            />

            {/* Or file input */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12 }}>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:'none' }}/>
              <Btn variant="ghost" onClick={()=>fileRef.current?.click()} sx={{ padding:'8px 16px', fontSize:'10px' }}>
                CARGAR ARCHIVO .CSV
              </Btn>
              <span style={{ fontSize:'11px', color:C.textSec }}>— o pega directamente en el área de texto</span>
            </div>

            {parseErr && (
              <div style={{ marginTop:12, padding:'10px 14px', background:C.redBg, border:`1px solid #EF444433`, borderRadius:3, fontSize:'12px', color:'#EF4444' }}>
                ⚠ {parseErr}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
              <Btn onClick={handleAnalyze} sx={{ padding:'10px 28px', fontSize:'11px', letterSpacing:'2px' }}>
                ANALIZAR →
              </Btn>
            </div>
          </div>
        )}

        {step===2 && (
          <div style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
            {parseErrors.length>0 && (
              <div style={{ padding:'10px 24px', background:C.amberBg, borderBottom:`1px solid ${C.amber}33`, fontSize:'11px', color:C.amber }}>
                ⚠ {parseErrors.length} fila(s) ignorada(s) por precio inválido
              </div>
            )}
            <div style={{ overflowY:'auto', flex:1, padding:'0 0 8px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:C.cardAlt, borderBottom:`1px solid ${C.border2}` }}>
                    {['NOMBRE','CATEGORÍA','STOCK','UNIDAD','€/UNIDAD','ACCIÓN'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'9px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item,i)=>(
                    <tr key={item.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'transparent':C.cardAlt }}>
                      <td style={{ padding:'10px 16px', fontSize:'12px', color:C.text, fontWeight:600 }}>{item.name}</td>
                      <td style={{ padding:'10px 16px', fontSize:'11px', color:C.textSec }}>{item.cat}</td>
                      <td style={{ padding:'10px 16px', fontSize:'12px', color:C.text }}>{item.stock}</td>
                      <td style={{ padding:'10px 16px', fontSize:'11px', color:C.textSec }}>{item.unit}</td>
                      <td style={{ padding:'10px 16px', fontSize:'12px', color:C.teal, fontWeight:700 }}>€{item.cpu.toFixed(4)}</td>
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
                <div style={{ textAlign:'center', padding:'40px', fontSize:'12px', color:C.textSec }}>
                  Has eliminado todos los productos. Vuelve atrás para revisar.
                </div>
              )}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderTop:`1px solid ${C.border2}` }}>
              <Btn variant="ghost" onClick={()=>setStep(1)} sx={{ padding:'9px 18px', fontSize:'10px' }}>← VOLVER</Btn>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize:'11px', color:C.textSec }}>{parsed.length} producto{parsed.length!==1?'s':''} listos para importar</span>
                <Btn disabled={parsed.length===0} onClick={handleConfirm} sx={{ padding:'10px 28px', fontSize:'11px', letterSpacing:'2px' }}>
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

// ─── SCREEN 2: INVENTARIO ─────────────────────────────────────────────────────
function Inventario() {
  const { customInv = [], inventoryLoading = false } = useApp() || {};
  const [riskFilter, setRiskFilter]       = useState('all');
  const [categoryTab, setCategoryTab]     = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [toast, setToast]         = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [consumptionModal, setConsumptionModal] = useState(null);
  const [customConsumption, setCustomConsumption] = useState({});
  const allItems = [...customInv];

  const RISK_FILTERS = [{ id:'all',label:'TODOS' },{ id:'critical',label:'EN RIESGO' },{ id:'medium',label:'PREVENTIVO' },{ id:'stable',label:'ESTABLE' }];

  const CATEGORY_KEYWORDS = {
    destilados: ['ginebra', 'vodka', 'ron', 'whisky', 'tequila', 'mezcal', 'brandy', 'cognac', 'destilado', 'licor', 'vermut', 'amaro', 'bitter', 'aperitivo', 'espumoso', 'vino', 'cava', 'champagne', 'cerveza'],
    frutas: ['fruta', 'fresco', 'fresca', 'zumo', 'jugo', 'cítrico', 'hierba', 'flor', 'vegetal', 'verdura'],
    secos: ['seco', 'fruto seco', 'deshidratado', 'especia', 'semilla', 'hoja seca', 'polvo natural'],
    texturizantes: ['texturizante', 'químico', 'gelificante', 'emulsionante', 'esferificación', 'agar', 'lecitina', 'xantana', 'metil'],
    mixers: ['mixer', 'tónica', 'soda', 'ginger', 'agua', 'refresco', 'sirope', 'jarabe', 'azúcar']
  };

  const getCategory = (cat) => {
    if (!cat) return 'otros';
    const lower = cat.toLowerCase();
    for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
      if (words.some(w => lower.includes(w))) return key;
    }
    return 'otros';
  };

  const CATEGORY_TABS = [
    { id:'all', label:'TODOS' },
    { id:'destilados', label:'DESTILADOS' },
    { id:'frutas', label:'FRUTAS Y FRESCOS' },
    { id:'secos', label:'SECOS' },
    { id:'texturizantes', label:'TEXTURIZANTES' },
    { id:'mixers', label:'MIXERS' },
    { id:'otros', label:'OTROS' }
  ];

  let visible = allItems;

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    visible = visible.filter(i =>
      i.name.toLowerCase().includes(query) ||
      (i.cat && i.cat.toLowerCase().includes(query))
    );
  } else {
    if (categoryTab !== 'all') {
      visible = visible.filter(i => getCategory(i.cat) === categoryTab);
    }
  }

  if (riskFilter !== 'all') {
    visible = visible.filter(i => i.risk === riskFilter);
  }

  const saveConsumption = (itemId, weekly) => {
    setCustomConsumption(p=>({...p,[itemId]:weekly}));
    setToast(`Consumo de ${allItems.find(x=>x.id===itemId)?.name} actualizado a ${weekly}/semana`);
  };
  if (inventoryLoading) {
    return (
      <div style={{ flex:1, padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO INVENTARIO...</div>
      </div>
    );
  }

  if (customInv.length === 0) {
    return (
      <div style={{ flex:1, padding:'28px 32px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        {showImport&&<ImportModal onClose={()=>setShowImport(false)}/>}
        <Package size={48} color={C.textSec} style={{ marginBottom: 16 }} />
        <h2 style={{ color:C.text, fontSize:'20px', letterSpacing:'2px', marginBottom:8 }}>INVENTARIO VACÍO</h2>
        <p style={{ color:C.textSec, fontSize:'13px', marginBottom:24 }}>No hay productos registrados en la base de datos.</p>
        <Btn variant="primary" onClick={()=>setShowImport(true)} sx={{ padding:'12px 24px', fontSize:'11px', letterSpacing:'2px' }}>
          IMPORTAR INVENTARIO INICIAL
        </Btn>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      {showImport&&<ImportModal onClose={()=>setShowImport(false)}/>}
      {consumptionModal&&<ConsumptionModal item={consumptionModal} onClose={()=>setConsumptionModal(null)} onSave={(weekly)=>saveConsumption(consumptionModal.id,weekly)}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>INVENTARIO INTELIGENTE</h1>
          <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            Predicción de stock con IA — {allItems.length} referencias monitorizadas
          </p>
        </div>
        <Btn variant="outline" onClick={()=>setShowImport(true)} sx={{ padding:'9px 18px', fontSize:'10px', letterSpacing:'2px' }}>
          IMPORTAR ALMACÉN
        </Btn>
      </div>
      <input
        type="text"
        placeholder="Buscar producto..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width:'100%', padding:'10px 14px', marginBottom:18, borderRadius:4, fontFamily:F, fontSize:'13px',
          background:C.cardAlt, border:`1px solid ${C.border2}`, color:C.text, outline:'none',
          transition:'all 0.2s'
        }}
        onFocus={(e) => e.target.style.borderColor = C.orange}
        onBlur={(e) => e.target.style.borderColor = C.border2}
      />

      <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:4 }}>
        {CATEGORY_TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setCategoryTab(tab.id)} style={{
            padding:'6px 16px', borderRadius:2, fontFamily:F, fontSize:'10px', letterSpacing:'2px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            background:categoryTab===tab.id?C.orange:C.cardAlt, color:categoryTab===tab.id?'#000':C.textSec,
            border:categoryTab===tab.id?`1px solid ${C.orange}`:`1px solid ${C.border2}`, transition:'all 0.12s',
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {RISK_FILTERS.map(f=>(
          <button key={f.id} onClick={()=>setRiskFilter(f.id)} style={{
            padding:'6px 16px', borderRadius:2, fontFamily:F, fontSize:'10px', letterSpacing:'2px', fontWeight:700, cursor:'pointer',
            background:riskFilter===f.id?C.orange:C.cardAlt, color:riskFilter===f.id?'#000':C.textSec,
            border:riskFilter===f.id?`1px solid ${C.orange}`:`1px solid ${C.border2}`, transition:'all 0.12s',
          }}>{f.label}</button>
        ))}
      </div>
      {visible.length === 0 && searchQuery.trim() ? (
        <Card sx={{ marginBottom:22, padding:32, textAlign:'center' }}>
          <p style={{ color:C.textSec, fontSize:'13px', letterSpacing:'1px' }}>
            Sin resultados para "<strong style={{ color:C.text }}>{searchQuery}</strong>"
          </p>
        </Card>
      ) : (
        <Card sx={{ marginBottom:22, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border2}`, background:C.cardAlt }}>
                {['PRODUCTO','CATEGORÍA','STOCK ACTUAL','USO SEMANAL','DÍAS RESTANTES','COSTE/USO','ACCIÓN'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:'9px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item,i)=>{
                const displayWeekly = customConsumption[item.id] || item.weekly;
                return (
                <tr key={item.id} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'transparent':C.cardAlt }}>
                  <td style={{ padding:'13px 16px', fontSize:'13px', color:C.text, fontWeight:700 }}>{item.name}</td>
                  <td style={{ padding:'13px 16px', fontSize:'11px', color:C.textSec }}>{item.cat}</td>
                  <td style={{ padding:'13px 16px', fontSize:'13px', color:C.text }}>{item.stock}</td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ fontSize:'12px', color:customConsumption[item.id]?C.teal:C.textSec, fontWeight:customConsumption[item.id]?700:400 }}>
                      {displayWeekly}
                    </div>
                    <button onClick={()=>setConsumptionModal(item)} style={{ marginTop:4, fontSize:'9px', color:C.amber, background:'none', border:'none', cursor:'pointer', letterSpacing:'1px', textDecoration:'underline' }}>
                      Editar
                    </button>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <StockBar pct={item.pct}/>
                      <span style={{ fontFamily:F, fontSize:'12px', fontWeight:700, color:item.days<=3?'#EF4444':item.days<=7?C.amber:C.teal }}>{item.days}d</span>
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px', fontSize:'12px', color:C.teal }}>{item.cost}</td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <RiskBadge risk={item.risk}/>
                      {item.risk!=='stable'&&<Btn variant="outline" sx={{ padding:'4px 10px', fontSize:'9px' }} onClick={()=>setToast(`Pedido de ${item.name} añadido a la lista`)}>PEDIR</Btn>}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <Card accent={C.purple} sx={{ padding:20 }}>
          <SLabel label="PREDICCIÓN ESTE FIN DE SEMANA" color={C.purple} icon={Zap}/>
          {[["Gin Tonic Hendrick's","~52 uds"],["Aperol Spritz","~48 uds"],["Negroni","~38 uds"],["Mojito","~35 uds"],["Old Fashioned","~22 uds"]].map(([n,u],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:'12px' }}>
              <span style={{ color:C.textSec }}>#{i+1} {n}</span>
              <span style={{ color:C.purple, fontWeight:700 }}>{u}</span>
            </div>
          ))}
        </Card>
        <Card accent={C.amber} sx={{ padding:20 }}>
          <SLabel label="COSTE TEÓRICO VS REAL" color={C.amber} icon={TrendingUp}/>
          {[['Coste teórico ventas','€4.280',C.textSec],['Coste real registrado','€4.990',C.amber],['Diferencia (merma)','+€710','#EF4444'],['Porcentaje de merma','14.2%','#EF4444'],['Objetivo BarOps','< 8%',C.teal]].map(([l,v,co],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:'12px' }}>
              <span style={{ color:C.textSec }}>{l}</span>
              <span style={{ color:co, fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card accent={C.teal} sx={{ padding:20 }}>
          <SLabel label="PEDIDO RECOMENDADO IA" color={C.teal} icon={ShoppingCart}/>
          {[["Aperol","6 botellas","HOY",'#EF4444'],["Campari","4 botellas","HOY",'#EF4444'],["Gin Hendrick's","3 botellas","MAÑANA",C.amber],["Limones frescos","3 kg","MAÑANA",C.amber],["Vermut Martini","2 botellas","ESTA SEM.",C.teal]].map(([n,q,u,co],i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${C.border}`, fontSize:'12px' }}>
              <span style={{ color:C.text }}>{n}</span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ color:C.textSec, fontSize:'11px' }}>{q}</span>
                <span style={{ color:co, fontWeight:700, fontSize:'9px', letterSpacing:'1px' }}>{u}</span>
              </div>
            </div>
          ))}
          <Btn variant="teal" sx={{ width:'100%', marginTop:14, justifyContent:'center', padding:'9px', letterSpacing:'2px', fontSize:'10px' }}>
            GENERAR PEDIDO COMPLETO
          </Btn>
        </Card>
      </div>
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
          <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            Semana 28 Abr – 3 May · {openPending.length} turno{openPending.length!==1?'s':''} sin cubrir
          </p>
        </div>
        <Btn onClick={()=>setToast('Formulario de turno urgente abierto')} sx={{ padding:'10px 20px', fontSize:'11px' }}>
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
            <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>{label}</div>
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
            <span style={{ fontFamily:F, fontSize:'11px', color:'#EF4444', letterSpacing:'3px', fontWeight:700 }}>NECESITAN COBERTURA</span>
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
                      <span style={{ fontSize:'12px', color:C.textSec }}>{shift.date}</span>
                      <span style={{ fontSize:'12px', color:C.text, fontWeight:700 }}>{shift.time}</span>
                      <span style={{ fontSize:'12px', color:C.orange, fontWeight:700 }}>{shift.cost}</span>
                    </div>
                  </div>
                  {isAssigned&&(
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'12px', color:C.teal }}>→ {assigned[shift.id]}</div>
                      <button onClick={()=>setAssigned(p=>{const n={...p};delete n[shift.id];return n;})}
                        style={{ background:'none',border:'none',color:C.textSec,fontFamily:F,fontSize:'10px',cursor:'pointer',marginTop:2,letterSpacing:'0.5px' }}>
                        desasignar
                      </button>
                    </div>
                  )}
                </div>
                {/* suggestions */}
                {!isAssigned&&(
                  <div style={{ padding:'12px 16px' }}>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>SUGERENCIAS DE COBERTURA</div>
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
                                <span style={{ fontSize:'10px', color:C.textSec }}>{p.spec}</span>
                                <Stars rating={p.rating}/>
                              </div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <AvailBadge avail={p.avail}/>
                            <span style={{ fontSize:'14px', color:C.orange, fontWeight:700 }}>{p.rate}</span>
                            <Btn variant="teal" sx={{ padding:'6px 12px', fontSize:'9px' }} onClick={()=>doAssign(shift.id,p.name)}>
                              <UserCheck size={11}/> ASIGNAR
                            </Btn>
                          </div>
                        </div>
                      ))}
                      {matchedTalent.length===0&&(
                        <div style={{ fontSize:'12px', color:C.textSec, padding:'8px 0' }}>Sin coincidencias — amplía la búsqueda</div>
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
            cursor:'pointer', width:'100%', fontFamily:F, color:C.textSec, fontSize:'11px', letterSpacing:'2px',
          }}>
            {covOpen?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
            TURNOS CUBIERTOS ESTA SEMANA ({COVERED_SHIFTS.length})
            <span style={{ marginLeft:'auto', color:C.teal, fontSize:'12px', fontWeight:700 }}>
              €{COVERED_SHIFTS.reduce((a,s)=>a+parseInt(s.cost.replace('€','')),0)}
            </span>
          </button>
          {covOpen&&(
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {COVERED_SHIFTS.map(s=>(
                <Card key={s.id} sx={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:'11px', color:C.textSec, marginBottom:2 }}>{s.date} · {s.time}</div>
                    <div style={{ fontSize:'13px', color:C.text, fontWeight:700 }}>{s.profile}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'12px', color:C.teal, fontWeight:700 }}>→ {s.pro}</div>
                      <Stars rating={s.rating}/>
                    </div>
                    <span style={{ fontSize:'12px', color:C.textSec }}>{s.cost}</span>
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
            <span style={{ fontFamily:F, fontSize:'11px', color:C.teal, letterSpacing:'3px', fontWeight:700 }}>RED DE TALENTO</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['all','TODOS'],['today','HOY'],['weekend','FINDE']].map(([id,label])=>(
              <button key={id} onClick={()=>setAF(id)} style={{
                flex:1, padding:'6px 4px', fontFamily:F, fontSize:'9px', letterSpacing:'1.5px', fontWeight:700,
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
                    <div style={{ fontSize:'10px', color:C.textSec, margin:'2px 0 4px' }}>{p.spec}</div>
                    <Stars rating={p.rating}/>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'15px', color:C.orange, fontWeight:700 }}>{p.rate}</div>
                    <AvailBadge avail={p.avail}/>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {p.tags.map(t=>(
                      <span key={t} style={{ padding:'2px 6px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:2, fontFamily:F, fontSize:'9px', color:C.textSec }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <Btn disabled={p.avail==='unavailable'} onClick={()=>setToast(`Solicitud enviada a ${p.name}`)} sx={{ marginLeft:8, flexShrink:0, padding:'5px 10px', fontSize:'9px' }}>
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
  const [messages, setMessages] = useState(INITIAL_CHAT);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [apiErr, setApiErr]     = useState(null);
  const bottomRef               = useRef(null);

  const CHIPS = [
    '¿Cómo mejorar mi margen en Gin Tonics?',
    'Genera la lista de pedido para este finde',
    '¿Cuál es mi cóctel más rentable?',
    '¿Qué bartender me recomiendas para el sábado?',
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:'smooth' }); },[messages, loading]);

  const send = async (overrideText) => {
    const text = overrideText !== undefined ? overrideText : input;
    if (!text.trim() || loading) return;
    setInput('');
    setApiErr(null);
    const userMsg = { id:Date.now(), role:'user', time:getNow(), text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await callClaude(next);
      setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:reply }]);
    } catch(e) {
      if (e.message==='API_KEY_MISSING') { setApiErr(true); }
      else { setMessages(prev=>[...prev,{ id:Date.now()+1, role:'agent', time:getNow(), text:`Error de conexión: ${e.message}` }]); }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', fontFamily:F, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'20px 28px', borderBottom:`1px solid ${C.border2}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:4, background:`${C.orange}18`, border:`1px solid ${C.orange}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bot size={18} color={C.orange}/>
          </div>
          <div>
            <div style={{ fontFamily:F, fontSize:'15px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>AGENTE BAROPS</div>
            <div style={{ fontFamily:F, fontSize:'11px', color:C.textSec, marginTop:2 }}>Tu analista de negocio personal — activo 24/7</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ padding:'5px 12px', background:C.purpleBg, border:`1px solid ${C.purple}44`, borderRadius:2, fontFamily:F, fontSize:'9px', color:C.purple, letterSpacing:'1.5px', fontWeight:700 }}>
            CLAUDE AI POWERED
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:loading?C.amber:C.teal, boxShadow:`0 0 8px ${loading?C.amber:C.teal}` }}/>
            <span style={{ fontFamily:F, fontSize:'10px', color:loading?C.amber:C.teal, letterSpacing:'1.5px' }}>
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
      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px', display:'flex', flexDirection:'column', gap:18 }}>
        {messages.map(msg=>(
          <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignSelf:msg.role==='user'?'flex-end':'flex-start', maxWidth:'72%' }}>
            <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1px', marginBottom:5, padding:'0 4px', textAlign:msg.role==='user'?'right':'left' }}>
              {msg.role==='user'?'TÚ':'⚡ AGENTE BAROPS'} · {msg.time}
            </div>
            <div style={{
              padding:'14px 18px',
              background:msg.role==='user'?C.orangeBg:C.card,
              border:`1px solid ${msg.role==='user'?C.orange+'44':C.border2}`,
              borderRadius:msg.role==='user'?'8px 2px 8px 8px':'2px 8px 8px 8px',
            }}>
              <pre style={{ margin:0, fontFamily:F, fontSize:'13px', color:C.text, lineHeight:'1.7', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                {msg.text}
              </pre>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{ display:'flex', flexDirection:'column', alignSelf:'flex-start', maxWidth:'72%' }}>
            <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1px', marginBottom:5 }}>⚡ AGENTE BAROPS · {getNow()}</div>
            <div style={{ padding:'14px 18px', background:C.card, border:`1px solid ${C.border2}`, borderRadius:'2px 8px 8px 8px' }}>
              <TypingDots/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:'16px 32px 24px', borderTop:`1px solid ${C.border2}`, flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          {CHIPS.map((chip,i)=>(
            <button key={i} onClick={()=>send(chip)} style={{ padding:'5px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:2, fontFamily:F, fontSize:'12px', color:C.textSec, cursor:'pointer' }}>
              {chip}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            disabled={loading}
            placeholder="Pregunta lo que necesites sobre tu negocio..."
            style={{ flex:1, padding:'12px 16px', background:C.card, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', opacity:loading?.6:1 }}
          />
          <Btn onClick={()=>send()} disabled={loading} sx={{ padding:'12px 24px', fontSize:'11px' }}>
            <Send size={14}/> ENVIAR
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
const TT_STYLE = { background:C.card, border:`1px solid #333`, fontFamily:F, fontSize:'11px', borderRadius:3, color:C.text };


// ─── SCREEN 5: ANALYTICS ──────────────────────────────────────────────────────
function Analytics() {
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

  const TT_STYLE = { background:C.card, border:`1px solid #333`, fontFamily:F, fontSize:'11px', borderRadius:3, color:C.text };

  if (loading) {
    return (
      <div style={{ flex:1, padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO...</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>INTELIGENCIA DE NEGOCIO</h1>
        <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>Análisis de rendimiento — Paradiso Cocktail Bar</p>
      </div>
      
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:22 }}>
        <Card sx={{ padding:20 }}>
          <div style={{ fontSize:'10px', color:C.orange, letterSpacing:'2.5px', fontWeight:700, marginBottom:18 }}>DISTRIBUCIÓN POR CATEGORÍA</div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
                <XAxis dataKey="n" stroke={C.border2} tick={{ fontFamily:F, fontSize:9, fill:C.textSec }}/>
                <YAxis stroke={C.border2} tick={{ fontFamily:F, fontSize:10, fill:C.textSec }}/>
                <Tooltip contentStyle={TT_STYLE} labelStyle={{ color:C.text }}/>
                <Bar dataKey="v" fill={C.purple} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:210, display:'flex', alignItems:'center', justifyContent:'center', color:C.textSec }}>Sin datos</div>
          )}
        </Card>

        <Card sx={{ padding:20 }}>
          <div style={{ fontSize:'10px', color:C.teal, letterSpacing:'2.5px', fontWeight:700, marginBottom:12 }}>TOP 10 PRODUCTOS POR VALOR</div>
          {topProducts.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:210, overflowY:'auto' }}>
              {topProducts.map((p,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border2}`, fontSize:'11px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.text, fontWeight:700 }}>#{i+1} {p.nombre}</div>
                    <div style={{ color:C.textSec, fontSize:'9px' }}>{p.categoria || '-'}</div>
                  </div>
                  <div style={{ color:C.teal, fontWeight:700, textAlign:'right' }}>€{p.value.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height:210, display:'flex', alignItems:'center', justifyContent:'center', color:C.textSec }}>Sin productos con valor</div>
          )}
        </Card>
      </div>

      <Card sx={{ padding:20 }}>
        <div style={{ fontSize:'10px', color:C.red, letterSpacing:'2.5px', fontWeight:700, marginBottom:16 }}>⚠ PRODUCTOS EN RIESGO</div>
        {riskProducts.length > 0 ? (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:C.cardAlt, borderBottom:`1px solid ${C.border2}` }}>
                {['PRODUCTO','CATEGORÍA','STOCK ACTUAL','STOCK MÍNIMO','DIFERENCIA'].map(h=>(
                  <th key={h} style={{ padding:'11px 12px', textAlign:'left', fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riskProducts.map((p,i) => {
                const diff = parseFloat(p.stock_actual || 0) - parseFloat(p.stock_minimo || 0);
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:i%2===0?'transparent':C.cardAlt }}>
                    <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'12px', color:C.text, fontWeight:700 }}>{p.nombre}</td>
                    <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'11px', color:C.textSec }}>{p.categoria || '-'}</td>
                    <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'12px', color:C.text }}>{p.stock_actual} {p.unidad}</td>
                    <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'12px', color:C.text }}>{p.stock_minimo} {p.unidad}</td>
                    <td style={{ padding:'12px 12px', fontFamily:F, fontSize:'12px', fontWeight:700, color:diff < -5 ? '#EF4444' : C.orange }}>{diff} {p.unidad}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              {cocktail.descripcion && <div style={{ fontSize:'10px', color:C.textSec, lineHeight:'1.3' }}>{cocktail.descripcion}</div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:'8px', color:'#000', background:ESTADO_COLOR[cocktail.estado], padding:'2px 8px', borderRadius:2, fontWeight:700, letterSpacing:'1px' }}>
                {ESTADO_LABEL[cocktail.estado]}
              </span>
              <span style={{
                fontSize:'8px', padding:'2px 8px', borderRadius:2, fontWeight:700, letterSpacing:'1px',
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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', padding:'10px 16px', gap:4, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, fontSize:'9px' }}>
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

      <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.border}`, fontSize:'10px', color:stockStatus.sinStock>0?C.red:stockStatus.enRiesgo>0?C.amber:C.teal, fontWeight:700 }}>
        {stockStatus.sinStock > 0 ? `✕ ${stockStatus.sinStock} sin stock` : stockStatus.enRiesgo > 0 ? `⚠ ${stockStatus.enRiesgo} en riesgo` : '● Todo en stock'}
      </div>

      <button onClick={()=>setOpen(p=>!p)} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 16px', background:C.cardAlt, border:'none', cursor:'pointer',
        fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1px',
      }}>
        VER RECETA {open?<ChevronUp size={11}/>:<ChevronDown size={11}/>}
      </button>

      {open && (
        <div style={{ padding:'10px 16px' }}>
          {ings.map(ing=>(
            <div key={ing.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'10px', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.textSec }}>{ing.nombre} — {ing.cantidad} {ing.unidad}</span>
              <span style={{ color:C.teal, fontWeight:700 }}>€{(ing.cantidad*ing.coste_unitario).toFixed(3)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0 0', fontSize:'11px', fontWeight:700, borderTop:`1px solid ${C.border}`, marginTop:4, paddingTop:6 }}>
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
                  <button key={i} onClick={opt.action} style={{ display:'block', width:'100%', padding:'10px 14px', textAlign:'left', background:'none', border:'none', borderBottom:i<menuOptions.length-1?`1px solid ${C.border}`:'none', cursor:'pointer', fontFamily:F, fontSize:'11px', color:opt.color||C.text, transition:'background 0.1s' }} onMouseEnter={e=>e.target.style.background=C.cardAlt} onMouseLeave={e=>e.target.style.background='none'}>
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
          <span style={{ fontFamily:F, fontSize:'12px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>EDITAR CÓCTEL</span>
          <button onClick={handleClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec }}>
            <X size={20}/>
          </button>
        </div>

        <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border2}`, padding:'0 24px' }}>
          {['identidad', 'receta', 'carta', 'alergenos'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'14px 0', fontFamily:F, fontSize:'10px', letterSpacing:'2px', fontWeight:700,
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
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:C.textSec, fontSize:'28px' }}>🍹</div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }}/>
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  <label style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', fontWeight:700 }}>FOTO</label>
                  <Btn variant="outline" onClick={() => fileInputRef.current?.click()} sx={{ fontSize:'11px', padding:'8px 12px' }}>
                    {photoFile ? 'Cambiar' : 'Subir'} Foto
                  </Btn>
                  {uploading && <span style={{ fontSize:'10px', color:C.teal }}>Subiendo...</span>}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>NOMBRE *</div>
                  <input value={form.nombre} onChange={e => handleFormChange('nombre', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>PRECIO (€) *</div>
                  <input type="number" step="0.5" min="0" value={form.precio} onChange={e => handleFormChange('precio', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>TIPO</div>
                  <select value={form.tipo} onChange={e => handleFormChange('tipo', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    <option value="clasico">CLÁSICO</option>
                    <option value="autor">DE AUTOR</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>ESTADO</div>
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
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>DESDE</div>
                    <input type="date" value={form.fecha_inicio_temporada} onChange={e => handleFormChange('fecha_inicio_temporada', e.target.value)}
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>HASTA</div>
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
                <div style={{ fontSize:'10px', color:C.orange, letterSpacing:'2px', marginBottom:12, fontWeight:700 }}>INGREDIENTES</div>
                {formIngs.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {formIngs.map((fi, idx) => (
                      <div key={idx} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px', background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:3 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'11px', color:C.text, fontWeight:700 }}>{fi.nombre}</div>
                          <div style={{ fontSize:'9px', color:C.textSec }}>{fi.cantidad} {fi.unidad} • €{(fi.cantidad * fi.coste_unitario).toFixed(3)}</div>
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
                    placeholder="🔍 Buscar..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                  {ingSearch.trim() && filtered.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.card, border:`1px solid ${C.border2}`, borderTop:'none', borderRadius:'0 0 3px 3px', maxHeight:150, overflowY:'auto', zIndex:20 }}>
                      {filtered.slice(0, 6).map(ing => (
                        <div key={ing.id} onClick={() => selectIngredient(ing)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:newIng.id===ing.id?`${C.orange}22`:'transparent', fontSize:'11px', color:C.text }}>
                          {ing.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <input type="number" step="0.5" min="0" value={newIng.qty} onChange={e => setNewIng(p => ({...p, qty: e.target.value}))}
                    placeholder="Cant." onKeyDown={e => e.key==='Enter' && addIng()}
                    style={{ width:60, padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                  <select value={newIng.unit} onChange={e => setNewIng(p => ({...p, unit: e.target.value}))}
                    style={{ width:60, padding:'8px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    <option>cl</option>
                    <option>ml</option>
                    <option>ud</option>
                    <option>g</option>
                  </select>
                  <Btn onClick={addIng} sx={{ flex:1, padding:'8px', fontSize:'10px' }}>ADD</Btn>
                </div>
              </div>

              <div>
                <div style={{ fontSize:'10px', color:C.amber, letterSpacing:'2px', marginBottom:12, fontWeight:700 }}>SUGERENCIAS IA</div>
                <Card sx={{ padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:'10px', color:C.teal, marginBottom:8, fontWeight:700 }}>Coste Total: €{liveCost.toFixed(2)}</div>
                  <div style={{ fontSize:'10px', color:C.textSec, marginBottom:12 }}>Precio: €{livePrice.toFixed(2)} | Margen: <span style={{ color:mc, fontWeight:700 }}>{liveMargin.toFixed(1)}%</span></div>
                  {detectClassicBase() && <div style={{ fontSize:'10px', color:C.orange, marginBottom:8 }}>✓ Base clásica detectada (Gin + Campari + Vermouth)</div>}
                  {suggestedPairings().map((s, i) => (
                    <div key={i} style={{ fontSize:'10px', color:C.teal, marginBottom:6 }}>→ {s}</div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {tab === 'carta' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>DESCRIPCIÓN</div>
                <input value={form.descripcion} onChange={e => handleFormChange('descripcion', e.target.value)}
                  placeholder="Breve descripción para la carta..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:60 }}
                />
              </div>
              <div>
                <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>HISTORIA</div>
                <textarea value={form.historia_coctel} onChange={e => handleFormChange('historia_coctel', e.target.value)}
                  placeholder="Origen y tradición del cóctel..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:80, resize:'vertical' }}
                />
              </div>
              <div>
                <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>INSTRUCCIONES</div>
                <textarea value={form.instrucciones_preparacion} onChange={e => handleFormChange('instrucciones_preparacion', e.target.value)}
                  placeholder="Modo de preparación paso a paso..." style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box', minHeight:80, resize:'vertical' }}
                />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>CRISTALERÍA</div>
                  <select value={form.cristaleria} onChange={e => handleFormChange('cristaleria', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  >
                    {CRISTALERIA_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>TIEMPO (min)</div>
                  <input type="number" min="0" value={form.tiempo_preparacion} onChange={e => handleFormChange('tiempo_preparacion', e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6, fontWeight:700 }}>GUARNICIÓN</div>
                <input value={form.guarnicion} onChange={e => handleFormChange('guarnicion', e.target.value)}
                  placeholder="p.ej: Twist de naranja, aceituna..." style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'11px', color:C.text, outline:'none', boxSizing:'border-box' }}
                />
              </div>
            </div>
          )}

          {tab === 'alergenos' && (
            <div>
              <div style={{ fontSize:'10px', color:C.textSec, letterSpacing:'2px', marginBottom:16, fontWeight:700 }}>MARCAR LOS QUE APLIQUEN</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {ALLERGENS.map(allg => (
                  <button key={allg} onClick={() => {
                    handleFormChange('alergenos', form.alergenos.includes(allg) ? form.alergenos.filter(a => a!==allg) : [...form.alergenos, allg]);
                  }} style={{
                    padding:'12px', borderRadius:3, fontFamily:F, fontSize:'10px', border:`1px solid ${form.alergenos.includes(allg)?C.orange:C.border2}`,
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
              <span style={{ fontFamily:F, fontSize:'12px', color:C.orange, letterSpacing:'2px', fontWeight:700 }}>¿DESCARTAR CAMBIOS?</span>
            </div>
            <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, marginBottom:24 }}>Los cambios sin guardar se perderán.</p>
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
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0 }}>CARTA & COSTES</h1>
          <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:'5px 0 0' }}>
            {counts.clasicos + counts.autor} activos · Gestión completa de cócteles en Supabase
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="outline" onClick={() => setShowImportCocteles(true)} sx={{ padding:'10px 16px', fontSize:'10px' }}>
            📥 IMPORTAR CSV
          </Btn>
          <Btn onClick={openForm} sx={{ padding:'10px 20px', fontSize:'11px' }}>
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
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border2}`, marginBottom:22, overflowX:'auto' }}>
        {[
          ['clasicos', `CLÁSICOS (${counts.clasicos})`],
          ['autor', `DE AUTOR (${counts.autor})`],
          ['temporada', `TEMPORADA (${counts.temporada})`],
          ['borradores', `BORRADORES (${counts.borradores})`],
          ['revision', `REVISIÓN (${counts.revision})`],
          ['retirados', `RETIRADOS (${counts.retirados})`],
        ].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:'10px 20px', background:'transparent', cursor:'pointer',
            fontFamily:F, fontSize:'10px', letterSpacing:'2px', fontWeight:700, whiteSpace:'nowrap',
            color:tab===id?C.orange:C.textSec, border:'none',
            borderBottom:tab===id?`2px solid ${C.orange}`:'2px solid transparent', marginBottom:'-1px',
          }}>{label}</button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:300 }}>
          <div style={{ fontSize:'12px', color:C.textSec }}>⏳ Cargando cócteles...</div>
        </div>
      )}

      {/* Grid */}
      {!loading && (
        visibles.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
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
          <div style={{ textAlign:'center', padding:'64px 20px' }}>
            <div style={{ fontFamily:F, fontSize:'40px', color:C.border2, marginBottom:20 }}>◇</div>
            <div style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'2px', marginBottom:10 }}>
              {tab==='borradores'?'TODAVÍA NO HAY BORRADORES':'NO HAY CÓCTELES EN ESTA CATEGORÍA'}
            </div>
            {(tab==='borradores'||tab==='clasicos'||tab==='autor')&&(
              <Btn onClick={openForm} sx={{ marginTop:20, padding:'11px 28px', fontSize:'11px' }}>
                <Plus size={14}/> CREAR CÓCTEL
              </Btn>
            )}
          </div>
        )
      )}

      {/* New/Edit Form Modal */}
      {showForm && (
            <Card accent={C.orange} sx={{ padding:24, marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <span style={{ fontFamily:F, fontSize:'11px', color:C.orange, letterSpacing:'3px', fontWeight:700 }}>NUEVO CÓCTEL</span>
                <button onClick={resetForm} style={{ background:'none',border:'none',cursor:'pointer',color:C.textSec,display:'flex' }}><X size={16}/></button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:24 }}>

                {/* Left: fields */}
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>TIPO *</div>
                      <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none' }}
                      >
                        <option value="clasico">CLÁSICO</option>
                        <option value="autor">DE AUTOR</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>ESTADO</div>
                      <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none' }}
                      >
                        <option value="borrador">BORRADOR</option>
                        <option value="activo">ACTIVO</option>
                        <option value="revision">REVISIÓN</option>
                        <option value="temporada">TEMPORADA</option>
                        <option value="retirado">RETIRADO</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>PRECIO DE VENTA (€) *</div>
                      <input value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}
                        placeholder="12.00" type="number" step="0.5" min="0"
                        style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>NOMBRE *</div>
                    <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                      placeholder="Ej: Paradiso Sour"
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'13px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>DESCRIPCIÓN / NOTAS</div>
                    <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                      placeholder="Ej: Versión de la casa con Patrón, zumo de lima y sirope de mango"
                      style={{ width:'100%', padding:'9px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none', boxSizing:'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:6 }}>FOTO DEL CÓCTEL</div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }}/>
                    <Btn variant="outline" onClick={()=>fileInputRef.current?.click()} sx={{ width:'100%', padding:'9px 12px', fontSize:'11px', justifyContent:'center' }}>
                      📷 SUBIR FOTO
                    </Btn>
                  </div>

                  <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:10 }}>INGREDIENTES *</div>

                  {/* Ingredient rows */}
                  {formIngs.length>0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
                      {formIngs.map(fi=>{
                        const db = allIngs.find(d=>d.id===fi.id);
                        const cost = db ? db.cpu * parseFloat(fi.qty) : 0;
                        return (
                          <div key={fi.uid} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:C.cardAlt, border:`1px solid ${C.border}`, borderRadius:3 }}>
                            <span style={{ flex:1, fontSize:'12px', color:C.text }}>{db?.name}</span>
                            <span style={{ fontSize:'12px', color:C.textSec, minWidth:55 }}>{fi.qty} {db?.unit}</span>
                            <span style={{ fontSize:'12px', color:C.teal, minWidth:52, textAlign:'right', fontWeight:700 }}>€{cost.toFixed(3)}</span>
                            <button onClick={()=>setFormIngs(p=>p.filter(i=>i.uid!==fi.uid))} style={{ background:'none',border:'none',cursor:'pointer',color:'#EF4444',padding:'0 2px',display:'flex' }}>
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        );
                      })}
                      <div style={{ textAlign:'right', fontSize:'11px', color:C.textSec, padding:'4px 0' }}>
                        Subtotal: <span style={{ color:C.orange, fontWeight:700 }}>€{liveCost.toFixed(3)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add ingredient row */}
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end', position:'relative' }}>
                    <div style={{ flex:1, position:'relative' }}>
                      <input
                        value={ingSearch}
                        onChange={e=>{ setIngSearch(e.target.value); setNewIng(p=>({...p,id:''})); }}
                        placeholder="🔍 Busca (escribe: lim, gin, etc)..."
                        style={{ width:'100%', padding:'10px 12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none', boxSizing:'border-box' }}
                      />
                      {ingSearch.trim()&&filtered.length>0&&(
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.card, border:`1px solid ${C.border2}`, borderTop:'none', borderRadius:'0 0 3px 3px', maxHeight:200, overflowY:'auto', zIndex:10 }}>
                          {filtered.slice(0,8).map(ing=>(
                            <div key={ing.id} onClick={()=>selectIngredient(ing)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:newIng.id===ing.id?`${C.orange}22`:'transparent', transition:'all 0.1s' }}>
                              <div style={{ fontSize:'12px', color:C.text, fontWeight:700 }}>{ing.name}</div>
                              <div style={{ fontSize:'10px', color:C.textSec }}>@{ing.cat} • {ing.unit}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ width:76, flexShrink:0 }}>
                      <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>CANTIDAD</div>
                      <input value={newIng.qty} onChange={e=>setNewIng(p=>({...p,qty:e.target.value}))}
                        onKeyDown={e=>e.key==='Enter'&&addIng()}
                        placeholder="cl / ud" type="number" step="0.5" min="0"
                        style={{ width:'100%', padding:'9px 10px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:3, fontFamily:F, fontSize:'12px', color:C.text, outline:'none' }}
                      />
                    </div>
                    <Btn variant="outline" onClick={addIng} sx={{ padding:'9px 14px', flexShrink:0, alignSelf:'flex-end' }}>
                      <Plus size={13}/> ADD
                    </Btn>
                  </div>
                </div>

                {/* Right: live preview */}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {photoPreview && (
                    <Card sx={{ padding:0, overflow:'hidden' }}>
                      <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'200px', objectFit:'cover' }}/>
                    </Card>
                  )}
                  <Card accent={mc} sx={{ padding:20, flex:1 }}>
                    <div style={{ fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:16 }}>PREVIEW EN TIEMPO REAL</div>

                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:'10px', color:C.textSec, marginBottom:4 }}>COSTE TOTAL</div>
                      <div style={{ fontSize:'30px', color:C.orange, fontWeight:700, lineHeight:1 }}>€{liveCost.toFixed(2)}</div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:'10px', color:C.textSec, marginBottom:4 }}>PRECIO VENTA</div>
                      <div style={{ fontSize:'30px', color:C.text, fontWeight:700, lineHeight:1 }}>
                        {livePrice>0?`€${livePrice.toFixed(2)}`:'—'}
                      </div>
                    </div>
                    <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:14 }}>
                      <div style={{ fontSize:'10px', color:C.textSec, marginBottom:6 }}>MARGEN REAL</div>
                      <div style={{ fontSize:'38px', fontWeight:700, color:mc, lineHeight:1 }}>
                        {livePrice>0?`${liveMargin.toFixed(1)}%`:'—'}
                      </div>
                      {livePrice>0&&liveCost>0&&(
                        <div style={{ fontSize:'11px', color:C.textSec, marginTop:8 }}>
                          Beneficio por copa: <span style={{ color:mc, fontWeight:700 }}>€{(livePrice-liveCost).toFixed(2)}</span>
                        </div>
                      )}
                      {liveMargin>0&&liveMargin<75&&livePrice>0&&(
                        <div style={{ fontSize:'10px', color:C.amber, marginTop:10, lineHeight:'1.5', padding:'8px 10px', background:C.amberBg, borderRadius:3, border:`1px solid ${C.amber}33` }}>
                          ⚠ Margen por debajo del estándar (75%). Considera subir el precio o simplificar la receta.
                        </div>
                      )}
                      {liveMargin>=80&&livePrice>0&&(
                        <div style={{ fontSize:'10px', color:C.teal, marginTop:10, padding:'8px 10px', background:C.tealBg, borderRadius:3, border:`1px solid ${C.teal}33` }}>
                          ✓ Margen saludable para coctelería de autor
                        </div>
                      )}
                    </div>
                  </Card>

                  <div style={{ display:'flex', gap:8 }}>
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

// ─── PRICING ──────────────────────────────────────────────────────────────────
function Pricing() {
  const [loading, setLoading] = useState(null); // 'monthly' | 'annual' | null
  const handleCheckout = async (priceId, plan) => {
    setLoading(plan);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        // Abrir Stripe en NUEVA PESTAÑA para no perder la app
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error al iniciar checkout. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  const monthlyPrice = import.meta.env.VITE_STRIPE_PRICE_MONTHLY || 'price_1TRO20BJLboiQ0lfe7vjpMaq';
  const annualPrice = import.meta.env.VITE_STRIPE_PRICE_ANNUAL || 'price_1TRNylBJLboiQ0lfk73lPLeu';

  return (
    <div style={{ flex:1, overflow:'auto', padding:'40px 60px' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:60 }}>
          <div style={{ fontFamily:F, fontSize:'36px', fontWeight:700, color:C.text, marginBottom:12 }}>PLANES BAROPS PRO</div>
          <div style={{ fontFamily:F, fontSize:'14px', color:C.textSec, lineHeight:'1.6' }}>
            Gestiona tu bar con datos en tiempo real. 14 días de prueba gratis, sin compromiso.
          </div>
          {/* Promo banner */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:18, padding:'8px 20px', background:`linear-gradient(90deg, ${C.orange}22, ${C.purple}22)`, border:`1px solid ${C.orange}44`, borderRadius:20 }}>
            <span style={{ fontSize:'14px' }}>🎉</span>
            <span style={{ fontFamily:F, fontSize:'11px', color:C.orange, fontWeight:700, letterSpacing:'1px' }}>
              20% DE DESCUENTO EN TU PRIMER MES · SOLO POR TIEMPO LIMITADO
            </span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, marginBottom:80 }}>
          {/* Monthly Plan */}
          <Card accent={C.orange} sx={{ padding:40, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, background:C.orange, filter:'blur(60px)', opacity:0.08, pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:20, right:20 }}>
              <Badge label='🎉 20% PRIMER MES' color={C.orange} bg={C.orangeBg}/>
            </div>
            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>PLAN</div>
            <div style={{ fontFamily:F, fontSize:'28px', fontWeight:700, color:C.text, marginBottom:4 }}>Mensual</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
              <span style={{ fontFamily:F, fontSize:'18px', color:C.textSec, textDecoration:'line-through' }}>€249</span>
              <span style={{ fontFamily:F, fontSize:'42px', fontWeight:700, color:C.orange }}>€199</span>
              <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>/mes</span>
            </div>
            <div style={{ fontFamily:F, fontSize:'11px', color:C.orange, fontWeight:700, marginBottom:28 }}>
              ✦ Primer mes con 20% off · después €249/mes
            </div>
            <div style={{ fontSize:'12px', color:C.textSec, lineHeight:'1.8', marginBottom:32, paddingBottom:32, borderBottom:`1px solid ${C.border2}` }}>
              <div style={{ marginBottom:8 }}>✓ Acceso completo a todas las funciones</div>
              <div style={{ marginBottom:8 }}>✓ Reportes en tiempo real</div>
              <div style={{ marginBottom:8 }}>✓ Gestión de staff ilimitada</div>
              <div style={{ marginBottom:8 }}>✓ Base de datos de cócteles</div>
              <div style={{ marginBottom:8 }}>✓ Agente IA BarOps</div>
              <div>✓ Soporte prioritario 24/7</div>
            </div>
            <Btn
              onClick={() => handleCheckout(monthlyPrice, 'monthly')}
              disabled={!monthlyPrice || !!loading}
              sx={{ width:'100%', justifyContent:'center', padding:'13px 28px', marginBottom:12, fontSize:'11px' }}
            >
              {loading === 'monthly' ? '⏳ Abriendo Stripe...' : '🚀 PROBAR 14 DÍAS GRATIS'}
            </Btn>
            <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, textAlign:'center', letterSpacing:'0.5px' }}>
              Se requiere tarjeta · Cancela cuando quieras · Se abre en nueva pestaña
            </div>
          </Card>

          {/* Annual Plan */}
          <Card accent={C.teal} sx={{ padding:40, position:'relative', overflow:'hidden', background:`linear-gradient(145deg, #0f1a18 0%, ${C.card} 100%)` }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:120, height:120, background:C.teal, filter:'blur(60px)', opacity:0.12, pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:20, right:20, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
              <Badge label='🔥 MÁS POPULAR' color={C.teal} bg={C.tealBg}/>
              <Badge label='AHORRA €788/AÑO' color={C.teal} bg={C.tealBg}/>
            </div>
            <div style={{ fontFamily:F, fontSize:'13px', color:C.textSec, letterSpacing:'2px', marginBottom:8 }}>PLAN</div>
            <div style={{ fontFamily:F, fontSize:'28px', fontWeight:700, color:C.text, marginBottom:4 }}>Anual</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
              <span style={{ fontFamily:F, fontSize:'42px', fontWeight:700, color:C.teal }}>€1.600</span>
              <span style={{ fontFamily:F, fontSize:'13px', color:C.textSec }}>/año</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:28 }}>
              <div style={{ fontFamily:F, fontSize:'12px', color:C.teal, fontWeight:700 }}>
                ≈ €133/mes · equivale a casi <span style={{ color:'#fff' }}>4 meses gratis</span>
              </div>
              <span style={{ fontFamily:F, fontSize:'10px', background:`${C.teal}22`, color:C.teal, border:`1px solid ${C.teal}55`, padding:'2px 10px', borderRadius:10, fontWeight:700, letterSpacing:'1px', display:'inline-block', width:'fit-content' }}>
                MEJOR PRECIO GARANTIZADO
              </span>
            </div>
            <div style={{ fontSize:'12px', color:C.textSec, lineHeight:'1.8', marginBottom:32, paddingBottom:32, borderBottom:`1px solid ${C.border2}` }}>
              <div style={{ marginBottom:8 }}>✓ Todo lo del plan mensual</div>
              <div style={{ marginBottom:8 }}>✓ Acceso anticipado a nuevas funciones</div>
              <div style={{ marginBottom:8 }}>✓ Manager de onboarding dedicado</div>
              <div style={{ marginBottom:8 }}>✓ Exportación ilimitada de datos</div>
              <div style={{ marginBottom:8 }}>✓ Formación inicial incluida (1h)</div>
              <div>✓ SLA 99.9% uptime garantizado</div>
            </div>
            <Btn
              variant="teal"
              onClick={() => handleCheckout(annualPrice, 'annual')}
              disabled={!annualPrice || !!loading}
              sx={{ width:'100%', justifyContent:'center', padding:'13px 28px', marginBottom:12, fontSize:'11px', boxShadow:`0 4px 20px ${C.teal}44` }}
            >
              {loading === 'annual' ? '⏳ Abriendo Stripe...' : '⚡ PROBAR 14 DÍAS GRATIS'}
            </Btn>
            <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, textAlign:'center', letterSpacing:'0.5px' }}>
              Se requiere tarjeta · Cancela cuando quieras · Se abre en nueva pestaña
            </div>
          </Card>
        </div>

        {/* Trust footer */}
        <div style={{ textAlign:'center', borderTop:`1px solid ${C.border2}`, paddingTop:40 }}>
          <div style={{ display:'flex', justifyContent:'center', gap:32, marginBottom:24, flexWrap:'wrap' }}>
            {[
              { icon:'🔒', label:'Pago 100% seguro', sub:'Encriptación SSL' },
              { icon:'↩️', label:'Sin permanencia', sub:'Cancela en 1 clic' },
              { icon:'📊', label:'Sin sorpresas', sub:'Facturación clara' },
              { icon:'⚡', label:'Activo al instante', sub:'Acceso inmediato' },
            ].map((t,i) => (
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', marginBottom:4 }}>{t.icon}</div>
                <div style={{ fontFamily:F, fontSize:'11px', color:C.text, fontWeight:700 }}>{t.label}</div>
                <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec }}>{t.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:F, fontSize:'11px', color:C.textSec, lineHeight:'1.8' }}>
            Pagos gestionados por <span style={{ fontWeight:700, color:C.text }}>Stripe</span> · Apple Pay · Google Pay · Tarjeta
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

        <div style={{ fontFamily:F, fontSize:'11px', color:C.orange, letterSpacing:'4px', marginBottom:12, fontWeight:700 }}>VERIFICACIÓN COMPLETADA</div>
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
                <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>MEMBERSHIP STATUS</div>
                <div style={{ fontFamily:F, fontSize:'18px', fontWeight:700, color:C.orange, letterSpacing:'1px' }}>BAROPS PRO ACCESSED</div>
              </div>
              <Badge label="ACTIVO" color={C.teal} bg={C.tealBg} />
            </div>
            
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, borderTop:`1px solid ${C.border2}`, paddingTop:20 }}>
              <div>
                <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>FASE ACTUAL</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text, fontWeight:700 }}>14 DÍAS DE PRUEBA VIP</div>
              </div>
              <div>
                <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'2px', marginBottom:4 }}>NIVEL DE ACCESO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text, fontWeight:700 }}>ILIMITADO (TIER 1)</div>
              </div>
            </div>
            
            {sessionId && (
              <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec, marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border2}88`, letterSpacing:'1px', opacity:0.6 }}>
                AUTH KEY: {sessionId.slice(0,24).toUpperCase()}...
              </div>
            )}
          </div>
        </Card>

        <Btn
          variant="primary"
          sx={{ padding:'16px 40px', fontSize:'12px', letterSpacing:'3px', boxShadow:`0 4px 15px ${C.orange}44`, borderRadius:3 }}
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
      <div style={{ flex:1, padding:'28px 32px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
        <div style={{ color:C.teal, fontSize:'14px', letterSpacing:'2px' }}>CARGANDO...</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, padding:'28px 32px', overflowY:'auto', fontFamily:F }}>
      {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}

      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontFamily:F, fontSize:'20px', fontWeight:700, letterSpacing:'5px', color:C.text, margin:0, marginBottom:8 }}>CONFIGURACIÓN LOCAL</h1>
        <p style={{ fontFamily:F, fontSize:'11px', color:C.textSec, letterSpacing:'1.5px', margin:0 }}>
          Gestiona la información de tu establecimientos y preferencias del sistema
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:32 }}>
        <Card sx={{ padding:24 }}>
          <h2 style={{ fontFamily:F, fontSize:'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px', marginBottom:18 }}>PERFIL DEL LOCAL</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ width:80, height:80, borderRadius:8, background:C.cardAlt, border:`2px dashed ${C.border2}`, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {localPhoto ? (
                  <img src={localPhoto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                ) : (
                  <Store size={32} color={C.textSec}/>
                )}
              </div>
              <label style={{ display:'inline-block', padding:'8px 16px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'10px', color:C.text, letterSpacing:'1px', fontWeight:700 }}>
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
              <label style={{ display:'block', fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>NOMBRE</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData(p=>({...p, nombre:e.target.value}))}
                style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>DIRECCIÓN</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData(p=>({...p, direccion:e.target.value}))}
                style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>CIUDAD</label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData(p=>({...p, ciudad:e.target.value}))}
                style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6 }}>AFORO</label>
              <input
                type="number"
                value={formData.aforo}
                onChange={(e) => setFormData(p=>({...p, aforo:parseInt(e.target.value) || 0}))}
                style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}
              />
            </div>
            <Btn
              onClick={handleSave}
              disabled={saving}
              sx={{ width:'100%', marginTop:8, justifyContent:'center', padding:'10px', fontSize:'11px' }}
            >
              {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
            </Btn>
          </div>
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          <Card sx={{ padding:24 }}>
            <h2 style={{ fontFamily:F, fontSize:'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px' }}>PLAN ACTUAL</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>PLAN</div>
                <div style={{ fontFamily:F, fontSize:'16px', color:C.orange, fontWeight:700, letterSpacing:'2px' }}>PRO</div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:12 }}>
                <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>ESTADO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.teal, fontWeight:700 }}>ACTIVO</div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:12 }}>
                <div style={{ fontFamily:F, fontSize:'10px', color:C.textSec, letterSpacing:'1.5px', marginBottom:4 }}>INICIO</div>
                <div style={{ fontFamily:F, fontSize:'13px', color:C.text }}>29 de abril, 2026</div>
              </div>
            </div>
          </Card>

          <Card sx={{ padding:24 }}>
            <h2 style={{ fontFamily:F, fontSize:'13px', color:C.text, letterSpacing:'2.5px', fontWeight:700, margin:'0 0 18px' }}>PREFERENCIAS</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'stockAlerts', label:'Alertas de stock crítico' },
                { key:'shiftNotifs', label:'Notificaciones de turnos' },
                { key:'compactMode', label:'Modo compacto de inventario' }
              ].map(({ key, label }) => (
                <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, borderBottom:`1px solid ${C.border2}` }}>
                  <span style={{ fontFamily:F, fontSize:'12px', color:C.text }}>{label}</span>
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
              fontFamily:F, fontSize:'10px', color:tab === t ? C.orange : C.textSec, letterSpacing:'2px', fontWeight:tab === t ? 700 : 400,
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
                <label style={{ display:'inline-block', padding:'8px 14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'10px', color:C.text, letterSpacing:'1px', fontWeight:700 }}>
                  SUBIR LOGO
                  <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} style={{ display:'none' }}/>
                </label>
              </div>
              {['nombre', 'tipo', 'direccion', 'ciudad', 'telefono', 'email', 'aforo'].map(field => (
                <div key={field}>
                  <label style={{ display:'block', fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>{field}</label>
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
                <h3 style={{ fontFamily:F, fontSize:'10px', color:C.orange, letterSpacing:'2px', fontWeight:700, marginBottom:12 }}>CONFIGURACIÓN OPERATIVA</h3>
                {['umbral_dias', 'proveedor', 'telefono_proveedor'].map(field => (
                  <div key={field} style={{ marginBottom:10 }}>
                    <label style={{ display:'block', fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>{field === 'umbral_dias' ? 'Umbral Stock Crítico (días)' : field === 'proveedor' ? 'Proveedor Principal' : 'Teléfono Proveedor'}</label>
                    <input type={field === 'umbral_dias' ? 'number' : 'text'} value={operativo[field]} onChange={(e) => setOperativo(p => ({...p, [field]:e.target.value}))} style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}/>
                  </div>
                ))}
              </div>
              <button onClick={handleSavePerfil} disabled={saving} style={{ width:'100%', padding:'12px', background:C.orange, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:'#000', fontWeight:700, letterSpacing:'2px', transition:'opacity 0.2s', opacity:saving ? 0.6 : 1 }}>GUARDAR CAMBIOS</button>
            </div>
          ) : tab === 'equipo' ? (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <h3 style={{ fontFamily:F, fontSize:'10px', color:C.teal, letterSpacing:'2px', fontWeight:700, marginBottom:12 }}>EQUIPO DE ACCESO</h3>
                {users.map(u => (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', background:C.cardAlt, borderRadius:4, marginBottom:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:C.orange, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F, fontSize:'11px', fontWeight:700, color:'#000', flexShrink:0 }}>{u.avatar}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:F, fontSize:'11px', color:C.text }}>{u.email}</div>
                      <div style={{ fontFamily:F, fontSize:'9px', color:C.textSec }}>{u.rol}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ fontFamily:F, fontSize:'10px', color:C.purple, letterSpacing:'2px', fontWeight:700, marginBottom:10 }}>INVITAR USUARIO</h3>
                <div style={{ display:'flex', gap:8 }}>
                  <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex:1, padding:'10px 12px', fontFamily:F, fontSize:'12px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text, outline:'none' }}/>
                  <button onClick={handleInviteUser} style={{ padding:'10px 14px', background:C.purple, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:'#fff', fontWeight:700 }}>ENVIAR</button>
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border2}`, paddingTop:14 }}>
                <h3 style={{ fontFamily:F, fontSize:'10px', color:C.amber, letterSpacing:'2px', fontWeight:700, marginBottom:14 }}>PREFERENCIAS</h3>
                {[{key:'stock_alerts', label:'Alertas de stock crítico'}, {key:'shift_alerts', label:'Alertas de turnos'}, {key:'weekly_report', label:'Informe semanal'}, {key:'compact_mode', label:'Modo compacto'}].map(item => (
                  <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border2}` }}>
                    <span style={{ fontFamily:F, fontSize:'11px', color:C.text }}>{item.label}</span>
                    <button onClick={() => setPrefs(p => ({...p, [item.key]:!p[item.key]}))} style={{ width:44, height:24, borderRadius:12, background:prefs[item.key] ? C.orange : '#333', border:'none', cursor:'pointer', transition:'all 0.2s', position:'relative' }}>
                      <div style={{ position:'absolute', width:20, height:20, borderRadius:'50%', background:'#fff', top:2, left:prefs[item.key] ? 22 : 2, transition:'left 0.2s' }}/>
                    </button>
                  </div>
                ))}
                <div style={{ marginTop:14 }}>
                  <label style={{ display:'block', fontFamily:F, fontSize:'9px', color:C.textSec, letterSpacing:'1.5px', marginBottom:6, textTransform:'uppercase' }}>Día del Informe Semanal</label>
                  <select value={prefs.weekly_day} onChange={(e) => setPrefs(p => ({...p, weekly_day:e.target.value}))} style={{ width:'100%', padding:'10px 12px', fontFamily:F, fontSize:'13px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, color:C.text }}>
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleSavePrefs} disabled={saving} style={{ width:'100%', padding:'12px', background:C.orange, border:'none', borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:'#000', fontWeight:700, letterSpacing:'2px', transition:'opacity 0.2s', opacity:saving ? 0.6 : 1, marginTop:12 }}>GUARDAR PREFERENCIAS</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button onClick={handleExportInventario} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s', hover:{background:C.orange} }}>📊 EXPORTAR INVENTARIO CSV</button>
              <button onClick={handleExportMovimientos} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s' }}>📈 EXPORTAR MOVIMIENTOS CSV</button>
              <button onClick={handleExportMerma} style={{ width:'100%', padding:'14px', background:C.cardAlt, border:`1px solid ${C.border2}`, borderRadius:4, cursor:'pointer', fontFamily:F, fontSize:'11px', color:C.text, fontWeight:700, letterSpacing:'2px', transition:'all 0.2s' }}>📉 EXPORTAR INFORME MERMA CSV</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


export default function BarOps() {
  const params = new URLSearchParams(window.location.search);
  const initialScreen = (params.get('payment') === 'success' || params.get('session_id')) ? 'success' : 'dashboard';
  const [screen, setScreen]       = useState(initialScreen);
  const [customIngs, setCustomIngs] = useState([]);
  const [customInv,  setCustomInv]  = useState([]);
  const [localName, setLocalName] = useState(
    localStorage.getItem('barops_local_nombre') ||
    localStorage.getItem('barops_local_name') ||
    'Mi Local'
  );
  const [showLocalDrawer, setShowLocalDrawer] = useState(false);

  const [inventoryLoading, setInventoryLoading] = useState(true);

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
      stock_actual: item.pct || 0,
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

  const ctx = { customIngs, customInv, addFromImport, inventoryLoading, localName, setLocalName };

  const SCREENS = {
    dashboard:  <Dashboard/>,
    inventario: <Inventario/>,
    staffing:   <Staffing/>,
    agente:     <AgenteIA/>,
    analytics:  <Analytics/>,
    carta:      <Carta/>,
    pricing:    <Pricing/>,
    success:    <PaymentSuccess/>,
  };
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AppCtx.Provider value={ctx}>
      <div style={{ display:'flex', flexDirection:isMobile?'column':'row', width:'100vw', height:'100vh', background:C.bg, overflow:'hidden', fontFamily:F }}>
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
        <Sidebar active={screen} setActive={setScreen} localName={localName} onOpenLocalSettings={()=>setShowLocalDrawer(true)}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', marginTop:isMobile?60:0 }}>
          {SCREENS[screen]}
        </div>
      </div>
      <LocalDrawer isOpen={showLocalDrawer} onClose={()=>setShowLocalDrawer(false)} localName={localName} onLocalNameChange={setLocalName}/>
    </AppCtx.Provider>
  );
}

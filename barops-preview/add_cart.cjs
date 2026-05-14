const fs = require('fs');
const file = '/Users/lianalviz/Desktop/PROYECTO-HOSTELERÍA MADRID/barops-preview/src/BarOps.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add states to BarOps
content = content.replace(
  "const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('barops_auth'));",
  "const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('barops_auth'));\n  const [cartItems, setCartItems] = useState([]);\n  const [showCartDrawer, setShowCartDrawer] = useState(false);"
);

// 2. Add to ctx
content = content.replace(
  "const ctx = { customIngs, customInv, addFromImport, fetchInventory, localName, setLocalName, userRole, setScreen };",
  "const ctx = { customIngs, customInv, addFromImport, fetchInventory, localName, setLocalName, userRole, setScreen, cartItems, setCartItems, setShowCartDrawer };"
);

// 3. Add CartDrawer component before LocalDrawer
const cartDrawerCode = `
function CartDrawer({ isOpen, onClose }) {
  const { cartItems, setCartItems, localName } = useApp() || {};
  
  if (!isOpen) return null;

  const grouped = (cartItems || []).reduce((acc, item) => {
    const prov = item.proveedor || 'Sin Proveedor';
    if (!acc[prov]) acc[prov] = [];
    acc[prov].push(item);
    return acc;
  }, {});

  const handleRemove = (id) => setCartItems(prev => prev.filter(i => i.id !== id));
  
  const handlePrint = (prov) => {
    const w = window.open('', '_blank');
    w.document.write(\`
      <html>
        <head>
          <title>Pedido - \${prov}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #000; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 18px; color: #555; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #ccc; padding: 12px 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>HOJA DE PEDIDO - \${localName}</h1>
          <h2>Proveedor: \${prov}</h2>
          <table>
            <tr><th>Producto</th><th>Categoría</th><th>Cantidad</th></tr>
            \${grouped[prov].map(item => \`
              <tr>
                <td>\${item.nombre}</td>
                <td>\${item.categoria || '-'}</td>
                <td><strong>\${item.qty}</strong> \${item.unidad}</td>
              </tr>
            \`).join('')}
          </table>
          <p style="margin-top: 40px; font-size: 12px; color: #888;">Generado por BarOps Sistema Operativo</p>
        </body>
      </html>
    \`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleWhatsapp = (prov) => {
    const items = grouped[prov];
    const tel = items[0]?.telefono_proveedor;
    let msg = \`Hola, necesitamos el siguiente pedido para \${localName}:\\n\\n\`;
    items.forEach(i => msg += \`- \${i.nombre}: \${i.qty} \${i.unidad}\\n\`);
    msg = encodeURIComponent(msg);
    if (tel) window.open(\`https://wa.me/\${tel.replace(/\\s+/g,'')}?text=\${msg}\`, '_blank');
    else { navigator.clipboard?.writeText(decodeURIComponent(msg)); alert('Copiado al portapapeles'); }
  };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', zIndex:9999, display:'flex', justifyContent:'flex-end' }}>
      <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)' }} onClick={onClose} />
      <div style={{ position:'relative', width:'100%', maxWidth:400, height:'100%', background:C.bg, borderLeft:\`1px solid \${C.border}\`, display:'flex', flexDirection:'column', animation:'slideInRight 0.3s forwards' }}>
        <div style={{ padding:20, borderBottom:\`1px solid \${C.border2}\`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:16, letterSpacing:2, color:C.text }}>🛒 CARRITO DE PEDIDOS</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:C.textSec, cursor:'pointer' }}><X size={20}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ color:C.textSec, fontSize:14, textAlign:'center', marginTop:40 }}>El carrito está vacío</div>
          ) : (
            Object.entries(grouped).map(([prov, items]) => (
              <div key={prov} style={{ marginBottom: 30, background: C.cardAlt, padding: 16, borderRadius: 8, border: \`1px solid \${C.border2}\` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.orange, marginBottom: 12 }}>{prov}</div>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
                    <div style={{ color: C.text }}>{item.nombre}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: C.teal, fontWeight: 700 }}>{item.qty} {item.unidad}</span>
                      <button onClick={() => handleRemove(item.id)} style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', padding: 4 }}><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={() => handleWhatsapp(prov)} style={{ flex: 1, padding: '8px', background: C.teal, color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>WHATSAPP</button>
                  <button onClick={() => handlePrint(prov)} style={{ flex: 1, padding: '8px', background: C.card, border: \`1px solid \${C.border2}\`, color: C.text, borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>PDF / IMPRIMIR</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

`;
content = content.replace("function LocalDrawer", cartDrawerCode + "function LocalDrawer");

// 4. Render CartDrawer in BarOps
content = content.replace(
  "<LocalDrawer isOpen={showLocalDrawer}",
  "<CartDrawer isOpen={showCartDrawer} onClose={()=>setShowCartDrawer(false)} />\n        <LocalDrawer isOpen={showLocalDrawer}"
);

// 5. Sidebar modification for Cart button
content = content.replace(
  "const { userRole } = useApp() || {};",
  "const { userRole, cartItems, setShowCartDrawer } = useApp() || {};"
);
content = content.replace(
  "const sidebarContent = (",
  "const sidebarContent = (\n    <>\n      {(cartItems && cartItems.length > 0) && (\n        <div onClick={() => setShowCartDrawer(true)} style={{ position:'absolute', top:24, right:24, cursor:'pointer', display:'flex', alignItems:'center', gap:8, background:C.orange, padding:'8px 16px', borderRadius:20, color:'#000', zIndex:100 }}>\n          <ShoppingCart size={16}/>\n          <span style={{ fontSize:12, fontWeight:700 }}>{cartItems.length}</span>\n        </div>\n      )}"
);

// 6. MobileTopBar Cart button
content = content.replace(
  "function MobileTopBar({ screen, localName }) {",
  "function MobileTopBar({ screen, localName }) {\n  const { cartItems, setShowCartDrawer } = useApp() || {};"
);
content = content.replace(
  "<div style={{ fontFamily:F, fontSize:'16px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>BAROPS</div>",
  "<div style={{ fontFamily:F, fontSize:'16px', fontWeight:700, color:C.orange, letterSpacing:'4px' }}>BAROPS</div>\n        {(cartItems && cartItems.length > 0) && (\n          <div onClick={() => setShowCartDrawer(true)} style={{ cursor:'pointer', background:C.orange, borderRadius:20, padding:'4px 10px', display:'flex', alignItems:'center', gap:6, color:'#000' }}>\n            <ShoppingCart size={14} />\n            <span style={{ fontSize:12, fontWeight:700 }}>{cartItems.length}</span>\n          </div>\n        )}"
);

// 7. Update handlePedir inside Inventario
content = content.replace(
  /const handlePedir = \(p\) => {[\s\S]*?};/,
  "const handlePedir = (p) => {\n    const { setCartItems } = useApp() || {};\n    if (setCartItems) {\n      setCartItems(prev => {\n        const ex = prev.find(i => i.id === p.id);\n        if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);\n        return [...prev, { ...p, qty: 1 }];\n      });\n      setToast('Añadido al carrito');\n    }\n  };"
);

// 8. Update handlePedir inline code in Dashboard (Requieren Atencion)
content = content.replace(
  /<Btn variant="ghost" onClick=\{\(\) => \{\s*if \(p.telefono_proveedor\) {[\s\S]*?\} else {[\s\S]*?onNavigate\('inventario'\);[\s\S]*?\}\s*\}\} sx=\{\{ fontSize:'12px', padding:'8px 16px' \}\}>/g,
  "<Btn variant=\"ghost\" onClick={() => { const { setCartItems } = useApp() || {}; if (setCartItems) { setCartItems(prev => { const ex = prev.find(i => i.id === p.id); if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i); return [...prev, { ...p, qty: 1 }]; }); alert('Añadido al carrito'); } }} sx={{ fontSize:'12px', padding:'8px 16px' }}>"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated BarOps.jsx for Cart!');

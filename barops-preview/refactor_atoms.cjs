const fs = require('fs');
const content = fs.readFileSync('src/BarOps.jsx', 'utf8');

const startStr = '// ─── ATOMS ────────────────────────────────────────────────────────────────────';
const endStr = '// ─── SIDEBAR ──────────────────────────────────────────────────────────────────';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const atomsCode = content.substring(startIdx + startStr.length, endIdx).trim();
  
  const uiIndex = `import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { C, F } from '../../constants/theme';

${atomsCode.replace(/function /g, 'export function ')}
`;

  fs.writeFileSync('src/components/ui/index.jsx', uiIndex);
  
  const newContent = content.substring(0, startIdx) + 
    startStr + '\n' +
    '// (Atoms extracted to src/components/ui/index.jsx)\n' +
    endStr +
    content.substring(endIdx + endStr.length);
    
  // Inject imports at the top
  const finalContent = newContent.replace(
    "import { supabase } from './supabaseClient';",
    "import { supabase } from './supabaseClient';\nimport { Badge, RiskBadge, ShiftBadge, AvailBadge, StockBar, Stars, Avatar, Toast, Btn, Card, SLabel, TypingDots } from './components/ui';\nimport { C, F } from './constants/theme';"
  );
  
  // Also remove C and F from BarOps.jsx since they are now in theme.js
  const tokensStart = finalContent.indexOf('// ─── TOKENS ──');
  const tokensEnd = finalContent.indexOf('// ─── APP CONTEXT ──');
  const strippedContent = finalContent.substring(0, tokensStart) + finalContent.substring(tokensEnd);

  fs.writeFileSync('src/BarOps.jsx', strippedContent);
  console.log('Atoms and Tokens extracted successfully.');
} else {
  console.log('Could not find boundaries.');
}

const fs = require('fs');
const content = fs.readFileSync('src/BarOps.jsx', 'utf8');
const lines = content.split('\n');

const getChunk = (startRegex, endRegex) => {
  const start = lines.findIndex(l => startRegex.test(l));
  const end = lines.findIndex((l, i) => i > start && endRegex.test(l));
  if (start === -1 || end === -1) return '';
  return lines.slice(start, end).join('\n');
};

const agenteContent = getChunk(/^function AgenteIA\(\) \{/, /^function Analytics\(\) \{/);

const newFileContent = `import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Search } from 'lucide-react';
import { C, F } from '../constants/theme';
import { callClaude } from '../services/anthropic';
// import { Btn, Card, Avatar, TypingDots } from '../components/ui';

${agenteContent}

export default AgenteIA;
`;

fs.writeFileSync('src/pages/AgenteIA.jsx', newFileContent);
console.log('Extracted AgenteIA');

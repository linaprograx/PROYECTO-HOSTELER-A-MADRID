const fs = require('fs');

const content = fs.readFileSync('src/BarOps.jsx', 'utf8');
const lines = content.split('\n');

function getBlock(startStr, endStr) {
  const start = lines.findIndex(l => l.startsWith(startStr));
  if (start === -1) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith(endStr));
  if (end === -1) return '';
  return lines.slice(start, end).join('\n');
}

// Extract UI Components
const uiStart = lines.findIndex(l => l.includes('// ─── ATOMS ──'));
const uiEnd = lines.findIndex(l => l.includes('// ─── SIDEBAR ──'));
const uiContent = lines.slice(uiStart + 1, uiEnd).join('\n');

const uiIndexContent = `import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { C, F } from '../../constants/theme';

${uiContent.replace(/function/g, 'export function').replace(/const /g, 'export const ')}
`;
fs.writeFileSync('src/components/ui/index.jsx', uiIndexContent);


// Extract Layout Components
const sidebarContent = getBlock('function Sidebar(', 'function Dashboard(');
const mobileLayoutContent = getBlock('function MobileTopBar(', 'function LoginPage(');
const layoutIndexContent = `import React from 'react';
import { Menu, LogOut, LayoutDashboard, Package, Users, Bot, BarChart2, Bell, Settings, CreditCard, Store, Search, Wine, ChevronUp, ChevronDown } from 'lucide-react';
import { C, F } from '../../constants/theme';
import { Btn, Card, Avatar, Badge } from '../ui';

${sidebarContent.replace(/function/g, 'export function')}
${mobileLayoutContent.replace(/function/g, 'export function')}
`;
fs.writeFileSync('src/components/layout/index.jsx', layoutIndexContent);


// We will stop here and execute this script to test.
console.log('UI and Layout extracted');

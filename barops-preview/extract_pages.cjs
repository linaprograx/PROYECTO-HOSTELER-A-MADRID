const fs = require('fs');

const content = fs.readFileSync('src/BarOps.jsx', 'utf8');

function extractPage(startMarker, endMarker, newFileName, componentName) {
    const lines = content.split('\n');
    const startIdx = lines.findIndex(l => l.startsWith(startMarker));
    let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith(endMarker));
    
    if (endIdx === -1) {
        // If endMarker is not found, search for the next function declaration
        endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('function '));
    }
    
    if (startIdx === -1 || endIdx === -1) {
        console.log(`Could not find ${componentName}`);
        return;
    }

    const pageContent = lines.slice(startIdx, endIdx).join('\n');
    
    // We need to provide the imports that the page needs.
    const fileData = `import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Package, Users, Bot, BarChart2, Bell, Settings, CreditCard, Store, Search, Wine, ChevronUp, ChevronDown, CheckCircle, X, AlertTriangle, TrendingUp, TrendingDown, Send, HelpCircle, Plus, ShoppingCart, BookOpen, Trash2, Menu, LogOut } from 'lucide-react';
import { C, F } from '../constants/theme';
import { Badge, RiskBadge, ShiftBadge, AvailBadge, StockBar, Stars, Avatar, Toast, Btn, Card, SLabel, TypingDots, Skeleton } from '../components/ui';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

${pageContent.replace(/^function/m, 'export default function')}
`;

    fs.writeFileSync(`src/pages/${newFileName}`, fileData);
    console.log(`Extracted ${componentName} to ${newFileName}`);
    
    return { startIdx, endIdx };
}

// Just extract the content but don't delete from BarOps.jsx yet to avoid breaking everything
extractPage('function Dashboard(', '// ─── DASHBOARD HELPERS ───', 'Dashboard.jsx', 'Dashboard');
extractPage('function AgenteIA() {', 'function Analytics() {', 'AgenteIA.jsx', 'AgenteIA');


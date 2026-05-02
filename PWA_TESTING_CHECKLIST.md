# BarOps PWA Testing Checklist — PART 11

## A. Touch Interactions & Input Handling
- [ ] All buttons have minimum 44x44px touch targets
- [ ] No 300ms tap delay (touch-action: manipulation applied)
- [ ] Input fields show 16px+ font (prevents iOS zoom)
- [ ] Momentum scrolling works on iOS (-webkit-overflow-scrolling)
- [ ] Form inputs remain accessible within safe areas (notch/home indicator)

## B. Responsive Layout Verification

### Dashboard
- [ ] Desktop (>768px): 3-column grid + charts visible
- [ ] Tablet (768px): 2-column layout, charts responsive
- [ ] Mobile (<768px): 1-column stack, readable content
- [ ] Font sizes scale appropriately
- [ ] Padding adjusts for mobile

### Inventario
- [ ] Desktop: Multi-column product grid
- [ ] Mobile: Single-column card layout
- [ ] Category filter responsive
- [ ] Search bar full-width on mobile
- [ ] Product cards stack vertically

### Carta
- [ ] Desktop: 4-column cocktail grid
- [ ] Mobile: 1-column card layout
- [ ] Tabs wrap on mobile
- [ ] Form fields stack on mobile
- [ ] Ingredient inputs reorganize for mobile

### AgenteIA
- [ ] Desktop: Chat sidebar visible, messages 72% width
- [ ] Mobile: Chat full-width, sidebar hidden or bottom sheet
- [ ] Chips hidden on mobile
- [ ] Input section stacks vertically
- [ ] Message font sizes readable on mobile

### Analytics
- [ ] Desktop: 2-column chart layout
- [ ] Mobile: 1-column charts with reduced height (160px vs 210px)
- [ ] Risk products table → card grid on mobile
- [ ] Card styling with border indicators
- [ ] Text sizes legible on small screens

### Local Settings
- [ ] Desktop: 2-column layout (perfil + plan/prefs)
- [ ] Mobile: 1-column stack
- [ ] Form labels and inputs responsive
- [ ] Cards have appropriate spacing
- [ ] All toggle switches accessible

### Pricing
- [ ] Desktop: 2-column card layout
- [ ] Mobile: 1-column cards full-width
- [ ] Plan names and prices visible
- [ ] CTA buttons full-width on mobile
- [ ] Feature list readable

## C. Mobile-Specific Features
- [ ] Safe area inset padding applied (notch/home indicator)
- [ ] iOS status bar color correct (black-translucent)
- [ ] Web app title displays correctly
- [ ] Apple touch icon displays in home screen
- [ ] Manifest.json properly configured

## D. PWA Offline Functionality
- [ ] Service Worker installs successfully
- [ ] Static assets cached (HTML, CSS, JS)
- [ ] Offline page displays when network unavailable
- [ ] API calls retry on reconnection
- [ ] Cache version increments on updates

## E. Performance & Accessibility
- [ ] No console errors related to responsive breakpoints
- [ ] Images load correctly at all viewport sizes
- [ ] Font sizes meet minimum 12px on mobile (except labels)
- [ ] Color contrast ratios meet WCAG standards
- [ ] Touch targets have sufficient spacing

## F. Device Testing Checklist
- [ ] iPhone 12 (390×844 portrait)
- [ ] iPhone 12 (844×390 landscape)
- [ ] iPad (768×1024)
- [ ] iPad landscape (1024×768)
- [ ] Android phone (375×667)
- [ ] Desktop (1920×1080)
- [ ] Desktop tablet view (iPad dimensions)

## G. Browser DevTools Testing
- [ ] Chrome DevTools device emulation ✓
- [ ] Firefox Responsive Design Mode ✓
- [ ] Safari responsive mode ✓
- [ ] iOS Safari (if available)
- [ ] Android Chrome (if available)

## H. Cross-Section Consistency
- [ ] All sections follow responsive pattern (isMobile state)
- [ ] Padding consistent across sections
- [ ] Font size hierarchy maintained
- [ ] Color scheme readable on all breakpoints
- [ ] Interactive elements properly spaced

## I. Edge Cases
- [ ] Viewport width exactly 768px
- [ ] Extremely narrow screens (320px)
- [ ] Extremely wide screens (2560px+)
- [ ] Landscape orientation changes
- [ ] Content overflow handling
- [ ] Long text truncation/wrapping

## J. Final QA Steps
- [ ] All 11 PARTS implemented and responsive
- [ ] No ReferenceErrors or build warnings
- [ ] Dev server compiles without errors
- [ ] Git diff shows only intended changes
- [ ] Memory updated with completion status

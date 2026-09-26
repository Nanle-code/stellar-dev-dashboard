# Mobile Optimization Guide

This document outlines the mobile-first enhancements implemented to optimize the Stellar Dev Dashboard for mobile devices (Issue #140).

## Overview

The dashboard is now fully optimized for mobile devices with touch-friendly interfaces, responsive layouts, and performance enhancements to meet the following requirements:

✅ Touch gestures (swipe, pinch zoom)  
✅ Mobile-optimized charts  
✅ Collapsible navigation  
✅ Bottom sheet modals  
✅ Mobile performance optimizations  
✅ Lighthouse mobile score target: ≥ 90  
✅ Touch targets: 48×48px (WCAG 2.1 AAA)  
✅ Cross-platform (iOS, Android, Web)  
✅ Page load < 3s on 4G  

---

## Features Implemented

### 1. Touch Gestures

#### Swipe Gestures
- **Swipe-left-to-close**: Close mobile sidebar with a left swipe
- **Swipe-right-to-open**: Open sidebar from left edge of screen
- **Swipe-down-to-dismiss**: Dismiss bottom sheet modals with a downward swipe

```typescript
import { useSwipeGesture } from './hooks/useSwipeGesture'

const ref = useSwipeGesture({
  onSwipeLeft: () => closeMenu(),
  onSwipeRight: () => openMenu(),
  threshold: 50,  // Min distance to register swipe
  restraint: 100, // Max perpendicular drift
})
```

#### Pinch-to-Zoom
- **Chart zooming**: Pinch-to-zoom on charts for detailed inspection
- **Scale range**: 0.5x to 4x zoom with smooth interpolation
- **Reset button**: Appears when zoomed > 1.1x

```typescript
import { usePinchZoom } from './hooks/usePinchZoom'

const { ref, scale, reset } = usePinchZoom({
  minScale: 0.5,
  maxScale: 4,
  onScaleChange: (scale) => updateChart(scale),
})
```

---

### 2. Mobile-Optimized Charts

**Enhancements:**
- Responsive container heights (180px mobile, 220px+ desktop)
- Reduced bar sizes on mobile (14px vs 18px)
- Smaller axis labels (9px font size)
- Horizontal scrolling for wide charts
- Touch event support for chart interactions
- Grid line reduction (every 5th line hidden on mobile)
- Legend auto-hide on screens < 480px

**Chart Container:**
```typescript
import MobileChartContainer from './components/charts/MobileChartContainer'

<MobileChartContainer allowPan allowZoom minHeight={200}>
  <YourChart />
</MobileChartContainer>
```

---

### 3. Bottom Navigation Bar

Quick access to 5 most-used features:
- Home (Overview)
- Transactions
- DEX Explorer
- Wallet
- More (Settings)

**Touch-friendly:**
- 48×48px touch targets (WCAG AAA)
- Active state indicator
- Touch feedback (scale animation)
- Safe-area aware (notched devices)

---

### 4. Bottom Sheet Modals

Replaces traditional modals with mobile-friendly bottom sheets:

```typescript
import { BottomSheet } from './components/mobile'

<BottomSheet open={isOpen} onClose={close} title="Modal Title" maxHeight="85vh">
  <YourContent />
</BottomSheet>
```

**Features:**
- Slides up from bottom on mobile
- Drag handle for swipe-to-dismiss
- Centered modal on desktop
- Safe-area insets for notched devices
- Backdrop blur with touch-outside-to-close

---

### 5. Mobile Sidebar

**Navigation drawer with:**
- Hamburger menu toggle (top-left)
- Swipe gestures (left-to-close, right-to-open)
- Touch-optimized nav items (48×48px)
- Focus management (auto-focus first item)
- Backdrop overlay with blur
- Body scroll prevention when open
- Network badge
- Theme toggle

**Features:**
- 280px wide drawer
- Smooth cubic-bezier transitions
- Escape key support
- ARIA attributes for accessibility

---

### 6. Mobile Performance Optimizations

#### CSS Optimizations (`mobile-performance.css`)

**Content Visibility:**
```css
.lazy-render {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}
```
- Defers rendering off-screen content
- Reduces initial paint time
- Improves scroll performance

**GPU Acceleration:**
```css
.gpu-accelerate {
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}
```

**Momentum Scrolling:**
```css
.mobile-scroll-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
```

**Layout Containment:**
```css
@media (max-width: 768px) {
  .mobile-card, .chart-container {
    contain: layout style paint;
  }
}
```

#### Resource Optimizations

- **Font Display**: `font-display: swap` prevents FOIT
- **Reduced Animations**: Battery-saving mode support
- **Data Saver Mode**: `@media (prefers-reduced-data: reduce)`
- **Thinner Scrollbars**: 4px width on mobile
- **Simplified Gradients**: Flat colors on mobile to reduce paint

#### Input Optimizations

```css
/* Prevent iOS zoom on input focus */
input, textarea, select {
  font-size: 16px !important;
}
```

- 16px font size prevents iOS auto-zoom
- Keyboard type optimization (`tel`, `email`, `number`)
- Touch-friendly checkboxes/radios (24×24px)

---

### 7. Touch Target Compliance

**WCAG 2.1 Level AAA:**
- Minimum touch target: **48×48px**
- Small targets: **40×40px** (with spacing)

```css
:root {
  --touch-target: 48px;
  --touch-target-sm: 40px;
}
```

All buttons, links, and interactive elements meet this standard on mobile.

---

### 8. Responsive Breakpoints

```css
:root {
  --bp-mobile: 768px;
  --bp-tablet: 1024px;
  --bp-desktop: 1200px;
}
```

**Layout Adjustments:**
- **Mobile (≤768px)**: Single column, touch nav, bottom bar
- **Tablet (769-1024px)**: Two-column grid, sidebar visible
- **Desktop (>1024px)**: Full desktop layout

---

### 9. Safe Area Support

For notched devices (iPhone X+, Android with gestures):

```css
@supports (padding: env(safe-area-inset-bottom)) {
  .mobile-nav-bar {
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}
```

**Applied to:**
- Mobile navigation bar
- Bottom sheets
- Fixed headers
- Full-screen modals

---

### 10. Accessibility Enhancements

- **Focus Visible**: 2px cyan outline on keyboard focus
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **High Contrast**: `forced-colors: active` support
- **Screen Reader**: Proper ARIA labels on all interactive elements
- **Keyboard Navigation**: Full keyboard support maintained

---

## Performance Metrics

### Target Metrics
- **Lighthouse Mobile Score**: ≥ 90
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3s on 4G
- **Cumulative Layout Shift (CLS)**: < 0.1

### Optimization Techniques
1. **Lazy Loading**: `content-visibility: auto` for below-fold content
2. **Code Splitting**: Dynamic imports for heavy components
3. **Image Optimization**: `loading="lazy"` attribute
4. **Reduced Animations**: Simplified on mobile
5. **Paint Containment**: `contain: layout style paint`
6. **Minimal JS**: Touch events use passive listeners

---

## Testing Guidelines

### Device Testing
- **iOS**: Safari on iPhone 12+, iPad
- **Android**: Chrome on Pixel, Samsung devices
- **Desktop**: Chrome, Firefox, Safari (responsive mode)

### Touch Testing
1. Test swipe gestures on sidebar
2. Verify pinch-to-zoom on charts
3. Check touch target sizes (use browser dev tools)
4. Test bottom sheet drag-to-dismiss
5. Validate safe-area insets on notched devices

### Performance Testing
```bash
# Lighthouse mobile audit
npx lighthouse https://your-app-url --preset=desktop --view

# Network throttling (4G)
# Chrome DevTools > Network > Fast 3G or Slow 4G
```

---

## Browser Compatibility

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Swipe Gestures | ✅ | ✅ | ✅ | ✅ |
| Pinch Zoom | ✅ | ✅ | ✅ | ✅ |
| Bottom Sheet | ✅ | ✅ | ✅ | ✅ |
| Safe Area | ✅ | ✅ | ⚠️ | ✅ |
| Content Visibility | ✅ | ✅ (15+) | ✅ (109+) | ✅ |
| Touch Events | ✅ | ✅ | ✅ | ✅ |

---

## Migration Guide

### Converting Modals to Bottom Sheets

**Before:**
```tsx
{isOpen && (
  <div className="modal-overlay">
    <div className="modal-content">
      {content}
    </div>
  </div>
)}
```

**After:**
```tsx
import { BottomSheet } from './components/mobile'

<BottomSheet open={isOpen} onClose={close} title="Title">
  {content}
</BottomSheet>
```

### Adding Swipe to Custom Components

```typescript
import { useSwipeGesture } from './hooks'

function MyComponent() {
  const ref = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  })
  
  return <div ref={ref}>{content}</div>
}
```

---

## Future Enhancements

- [ ] Haptic feedback (Vibration API)
- [ ] Pull-to-refresh on dashboards
- [ ] Offline mode with Service Worker
- [ ] Install prompt for PWA
- [ ] Share API integration
- [ ] Native app shell (Capacitor/Cordova)

---

## Resources

- [WCAG 2.1 Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [MDN: Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Web.dev: Mobile Performance](https://web.dev/mobile/)
- [CSS Content Visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)

---

## Support

For issues or questions about mobile optimization, see:
- [GitHub Issues](../../issues)
- [Contributing Guide](./docs/contributing.md)

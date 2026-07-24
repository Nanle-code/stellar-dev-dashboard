# Mobile Optimization Quick Reference

## Touch Targets (WCAG 2.1 AAA)
```css
--touch-target: 48px;      /* Standard touch target */
--touch-target-sm: 40px;   /* Small touch target (with spacing) */
```

## Breakpoints
```css
--bp-mobile: 768px;   /* ≤768px = mobile */
--bp-tablet: 1024px;  /* 769-1024px = tablet */
--bp-desktop: 1200px; /* >1024px = desktop */
```

## Gestures

### Swipe
```tsx
import { useSwipeGesture } from './hooks'

const ref = useSwipeGesture({
  onSwipeLeft: () => {},
  onSwipeRight: () => {},
  threshold: 50,
})
```

### Pinch Zoom
```tsx
import { usePinchZoom } from './hooks'

const { ref, scale, reset } = usePinchZoom({
  minScale: 0.5,
  maxScale: 4,
})
```

## Components

### Bottom Sheet
```tsx
import { BottomSheet } from './components/mobile'

<BottomSheet open={isOpen} onClose={close} title="Title">
  {content}
</BottomSheet>
```

### Mobile Chart
```tsx
import MobileChartContainer from './components/charts/MobileChartContainer'

<MobileChartContainer allowPan allowZoom>
  <YourChart />
</MobileChartContainer>
```

## Performance Classes

```css
.lazy-render         /* Content-visibility: auto */
.gpu-accelerate      /* GPU-accelerated animations */
.skeleton            /* Loading state animation */
.hide-scrollbar      /* Hide scrollbar on mobile */
```

## Safe Area Insets

```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useSwipeGesture.ts` | Swipe detection |
| `src/hooks/usePinchZoom.ts` | Pinch zoom tracking |
| `src/components/mobile/BottomSheet.tsx` | Mobile modal |
| `src/styles/mobile-performance.css` | Performance CSS |
| `MOBILE_OPTIMIZATION_GUIDE.md` | Full documentation |

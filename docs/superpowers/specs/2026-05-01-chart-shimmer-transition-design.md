# Chart Shimmer Transition Design

**Date:** 2026-05-01
**Scope:** Dashboard chart re-rendering on time-range change

## Problem

When the user taps a different time-range period (1M, 3M, 6M, YTD, 1Y, All), both the Fuel Efficiency `LineChart` and the Spending Over Time `BarChart` use a React `key` prop tied to the period. Changing the key forces a full unmount/remount cycle: the old chart vanishes instantly, a blank gap appears for one or more frames, and then the new chart mounts and plays its entrance animation. This creates a visible "blink" that feels broken.

## Solution: Shimmer Bridge via `ChartTransition` Wrapper

A reusable wrapper component that intercepts the chart remount and hides the blank gap behind a skeleton shimmer placeholder, then fades in the new chart.

### New file

`src/components/ChartTransition.tsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `transitionKey` | `string` | Value that triggers the transition (tied to `period`) |
| `isDark` | `boolean` | Theme flag for shimmer colors |
| `children` | `ReactNode` | The chart element(s) to wrap |

**No hardcoded height.** The wrapper captures the children's rendered height via `onLayout` on the first (idle) render, then uses that measurement for subsequent shimmer placeholders. Since the initial render is always idle (no transition on mount), the height is always available before the first shimmer fires.

### Internal state machine

```
idle → shimmer → reveal → idle
```

- **idle**: Children rendered at full opacity.
- **shimmer**: On `transitionKey` change, children are unmounted. A `SkeletonBone` (reused from `src/components/Skeleton.tsx`) matching `shimmerHeight` with `borderRadius: 20` is displayed. Holds for ~250ms minimum.
- **reveal**: New children mount (with their React `key`). An `Animated.Value` drives opacity from 0 to 1 over ~200ms. The chart's own `isAnimated` entrance animation plays simultaneously.
- **idle**: Fade complete, back to normal.

Total perceived transition: ~450ms.

### Transition sequence

| Step | Time | What the user sees |
|------|------|--------------------|
| Period tap | 0ms | Old chart hidden immediately |
| Shimmer | 0–250ms | Card-shaped skeleton pulse in the chart area |
| Fade-in | 250–450ms | New chart fades in while drawing its entrance animation |

### Affected charts

**1. Fuel Efficiency LineChart** (`dashboard.tsx`)

- Current key: `` key={`efficiency-${period}`} ``
- Wrap the `<LineChart>` and its accessibility container `<View>` with `ChartTransition`.
- The card header ("Fuel Efficiency", efficiency label) and partial-fills footnote stay outside the wrapper — they remain stable during the transition.
- Shimmer height: measured automatically from the chart's rendered size.

**2. Spending Over Time BarChart** (`SpendingBarChart.tsx`)

- Current key: `` key={`${period}-${displayData.length}`} ``
- Wrap the `<BarChart>` and its accessibility container `<View>` inside `SpendingBarChart` with `ChartTransition`.
- Card chrome (header with "Spending Over Time" / "Weekly"/"Monthly" label, legend, detail row) stays outside the wrapper.
- The header label ("Weekly" vs "Monthly") snaps on period change — acceptable, not jarring.
- Shimmer height: measured automatically from the chart's rendered size.

**Not affected:**

- **PieChart** (Spending Breakdown donut) — no `key` change on period switch, no remount, no wrapper needed.
- **Text metrics** (hero total, cost/mile, efficiency) — numbers snap, user confirmed this is acceptable.

### Shimmer styling

Reuses the existing `SkeletonBone` from `src/components/Skeleton.tsx`:
- Same pulse animation (opacity 0.4 to 1.0, 800ms loop)
- Same colors (`#2A2926` dark / `#E8E6E1` light)
- `borderRadius: 20` to match `cardShadow()` used on chart cards
- `width: '100%'`, `height` set by prop

No new animation primitives or dependencies.

### Edit sites

| File | Change |
|------|--------|
| `src/components/Skeleton.tsx` | Export `SkeletonBone` (currently a private function) |
| `src/components/ChartTransition.tsx` | New file — the wrapper component, imports `SkeletonBone` |
| `app/(tabs)/dashboard.tsx` | Import `ChartTransition`, wrap the LineChart block |
| `src/components/SpendingBarChart.tsx` | Import `ChartTransition`, wrap the BarChart block |

### What does NOT change

- Data flow, hooks, stores, or business logic — `useDashboardMetrics` is untouched.
- The charts keep their existing `key` props — the wrapper just hides the remount.
- The `DashboardSkeleton` used for initial load is unaffected.
- No new dependencies.

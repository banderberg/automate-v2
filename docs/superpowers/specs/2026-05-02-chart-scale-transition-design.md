# Chart Scale Transition Design

**Date:** 2026-05-02
**Scope:** Animated chart transition on time-range period change
**Replaces:** 2026-05-01-chart-shimmer-transition-design.md (reverted)

## Problem

When the user taps a different time-range period (1M, 3M, 6M, YTD, 1Y, All), the BarChart uses a React `key` tied to the period which forces a full unmount/remount. This causes a visible blink — the old chart vanishes for one or more frames before the new one mounts. The previous shimmer bridge approach (skeleton placeholder between card chrome) looked hacky and was reverted.

## Solution: Reanimated scaleY Wrapper

A reusable wrapper component that plays a shrink → pause → grow animation using `react-native-reanimated` shared values. The chart remounts while invisible (at scaleY 0), so the user never sees a blank gap.

### New file

`src/components/ChartTransition.tsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `transitionKey` | `string` | Value that triggers the transition (tied to `period`) |
| `children` | `ReactNode` | The chart element(s) to wrap |

### Internal behavior

The component maintains a `displayedKey` state that lags behind `transitionKey`. When `transitionKey` changes:

1. **Shrink phase** (200ms): Animate `scaleY` from 1 to 0 using `withTiming`. The `transformOrigin` is set to `'bottom'` so bars collapse downward toward the x-axis.
2. **Pause phase** (500ms): At scaleY 0, update `displayedKey` to match `transitionKey`. This causes the children to remount (via their React `key` which depends on the period). The remount is invisible since the container is scaled to zero.
3. **Grow phase** (300ms): Animate `scaleY` from 0 to 1 using `withTiming`. The new chart reveals upward from the x-axis.

Total perceived transition: ~1000ms from period tap to fully revealed new chart.

### Animation implementation

Uses `react-native-reanimated` (already installed at ~4.1.1):
- `useSharedValue` for the scaleY value
- `useAnimatedStyle` for the transform
- `withTiming` for easing (default easing — smooth deceleration)
- `withDelay` for the 500ms pause
- `withSequence` to chain shrink → pause → grow
- `runOnJS` callback at the midpoint to update `displayedKey` in React state

The wrapper renders an `Animated.View` with `overflow: 'hidden'` and the animated scaleY transform applied.

### Affected charts

**1. Spending Over Time BarChart** (`SpendingBarChart.tsx`)

- Current key: `` key={`${period}-${displayData.length}`} ``
- Wrap the `<BarChart>` and its accessibility `<View>` with `<ChartTransition transitionKey={period}>`.
- Card header ("Spending Over Time" / "Weekly"/"Monthly"), legend, and detail row stay OUTSIDE the wrapper — they remain stable during the transition.
- Remove `isAnimated` prop from the BarChart — the scaleY grow handles the visual entrance. This avoids a double-animation effect.

**2. Fuel Efficiency LineChart** (`app/(tabs)/dashboard.tsx`)

- Wrap the `<LineChart>` and its accessibility `<View>` with `<ChartTransition transitionKey={period}>`.
- Card header ("Fuel Efficiency", efficiency label) and partial-fills footnote stay outside the wrapper.
- Remove `isAnimated` prop from the LineChart.

**Not affected:**

- PieChart (Spending Breakdown donut) — no key change on period switch
- Text metrics (hero total, cost/mile, efficiency) — numbers snap instantly, acceptable
- DashboardSkeleton — initial load skeleton is unrelated

### Bar spacing adjustment

In `SpendingBarChart.tsx`, tighten the bar spacing formula:

**Current:**
```ts
const barSpacing = needsScroll ? 28 : Math.max(20, Math.min(44, (chartWidth - 40) / displayData.length - 24));
```

**New:**
```ts
const barSpacing = needsScroll ? 20 : Math.max(12, Math.min(32, (chartWidth - 40) / displayData.length - 24));
```

This brings bars closer together across all period ranges.

### Edit sites

| File | Change |
|------|--------|
| `src/components/ChartTransition.tsx` | New file — the Reanimated scaleY wrapper |
| `src/components/SpendingBarChart.tsx` | Wrap BarChart with ChartTransition, remove `isAnimated`, tighten spacing |
| `app/(tabs)/dashboard.tsx` | Import ChartTransition, wrap LineChart block, remove `isAnimated` |

### What does NOT change

- Data flow, hooks, stores, or business logic — `useDashboardMetrics` is untouched
- The charts keep their existing `key` props — the wrapper just hides the remount behind the animation
- No new dependencies (react-native-reanimated is already in the project)
- No shimmer, no skeleton, no height measurement needed
- Scroll behavior unchanged (still scrolls for long data sets)

### Edge cases

- **Rapid period taps:** If the user taps a new period while a transition is in-flight, the animation resets — the current scaleY value immediately starts a new shrink from wherever it is. `cancelAnimation` is called on the shared value before starting a new sequence.
- **First render:** No animation plays on mount. The wrapper starts at scaleY 1 and only animates when `transitionKey` changes.
- **Same period re-tap:** If the user taps the already-selected period, `transitionKey` doesn't change, no animation fires.

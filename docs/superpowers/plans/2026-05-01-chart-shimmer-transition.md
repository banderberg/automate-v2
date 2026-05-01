# Chart Shimmer Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the chart remount blink when the dashboard time-range period changes, using a shimmer bridge that shows a skeleton placeholder then fades in the new chart.

**Architecture:** A reusable `ChartTransition` wrapper component with an `idle → shimmer → reveal → idle` state machine. It captures children height via `onLayout`, shows a `SkeletonBone` shimmer for 250ms when `transitionKey` changes, then fades in the new children over 200ms. Wraps the `LineChart` in `dashboard.tsx` and the `BarChart` inside `SpendingBarChart.tsx`.

**Tech Stack:** React Native `Animated` API (already used in `Skeleton.tsx`), existing `SkeletonBone` component.

**Spec:** `docs/superpowers/specs/2026-05-01-chart-shimmer-transition-design.md`

**Testing note:** The project's Jest config is node-based (`ts-jest`, no `@testing-library/react-native`). Existing tests are pure service logic. Since `ChartTransition` is a UI animation component, it will be verified manually in the running app rather than adding a component testing framework (out of scope).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/Skeleton.tsx` | Modify | Export `SkeletonBone` (currently private) |
| `src/components/ChartTransition.tsx` | Create | Reusable shimmer bridge wrapper component |
| `app/(tabs)/dashboard.tsx` | Modify | Wrap LineChart block with `ChartTransition` |
| `src/components/SpendingBarChart.tsx` | Modify | Wrap BarChart block with `ChartTransition` |

---

## Task 1: Export SkeletonBone

**Files:**
- Modify: `src/components/Skeleton.tsx:12`

- [ ] **Step 1: Export the SkeletonBone function**

In `src/components/Skeleton.tsx`, change line 12 from:

```tsx
function SkeletonBone({ width, height, borderRadius = 8, style }: SkeletonBoneProps) {
```

to:

```tsx
export function SkeletonBone({ width, height, borderRadius = 8, style }: SkeletonBoneProps) {
```

Also export the props interface. Change line 5 from:

```tsx
interface SkeletonBoneProps {
```

to:

```tsx
export interface SkeletonBoneProps {
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors may be present, but no errors referencing `Skeleton.tsx` or `SkeletonBone`).

- [ ] **Step 3: Commit**

```bash
git add src/components/Skeleton.tsx
git commit -m "refactor: export SkeletonBone from Skeleton.tsx"
```

---

## Task 2: Create ChartTransition component

**Files:**
- Create: `src/components/ChartTransition.tsx`

- [ ] **Step 1: Create the ChartTransition component**

Create `src/components/ChartTransition.tsx` with this content:

```tsx
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type LayoutChangeEvent } from 'react-native';
import { SkeletonBone } from './Skeleton';

type Phase = 'idle' | 'shimmer' | 'reveal';

const SHIMMER_DURATION = 250;
const FADE_DURATION = 200;

interface ChartTransitionProps {
  transitionKey: string;
  isDark: boolean;
  children: ReactNode;
}

export function ChartTransition({ transitionKey, isDark, children }: ChartTransitionProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const prevKeyRef = useRef(transitionKey);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevKeyRef.current === transitionKey) return;
    prevKeyRef.current = transitionKey;

    if (measuredHeight == null) return;

    setPhase('shimmer');
    fadeAnim.setValue(0);

    shimmerTimerRef.current = setTimeout(() => {
      setPhase('reveal');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        setPhase('idle');
      });
    }, SHIMMER_DURATION);

    return () => {
      if (shimmerTimerRef.current != null) {
        clearTimeout(shimmerTimerRef.current);
      }
    };
  }, [transitionKey]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      setMeasuredHeight(h);
    }
  };

  if (phase === 'shimmer' && measuredHeight != null) {
    return (
      <SkeletonBone
        width="100%"
        height={measuredHeight}
        borderRadius={20}
      />
    );
  }

  return (
    <Animated.View onLayout={handleLayout} style={{ opacity: fadeAnim }}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "ChartTransition" | head -10`
Expected: No errors referencing `ChartTransition.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChartTransition.tsx
git commit -m "feat: add ChartTransition shimmer bridge component"
```

---

## Task 3: Wrap LineChart in dashboard.tsx

**Files:**
- Modify: `app/(tabs)/dashboard.tsx:515-564`

- [ ] **Step 1: Add import**

In `app/(tabs)/dashboard.tsx`, add this import alongside the other component imports (after line 13, near the `DashboardSkeleton` import):

```tsx
import { ChartTransition } from '@/src/components/ChartTransition';
```

- [ ] **Step 2: Wrap the LineChart accessibility View with ChartTransition**

Find the LineChart's accessibility container (lines 515-564). Replace this block:

```tsx
            <View
              accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
            >
              <LineChart
                key={`efficiency-${period}`}
                data={lineChartData}
                width={chartWidth}
                height={160}
                color="#1A9A8F"
                thickness={2.5}
                curved
                areaChart
                startFillColor="rgba(26, 154, 143, 0.10)"
                endFillColor="rgba(26, 154, 143, 0.0)"
                startOpacity={0.1}
                endOpacity={0}
                noOfSections={3}
                yAxisColor="transparent"
                xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
                yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
                xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
                hideRules={false}
                rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
                rulesType="solid"
                dataPointsColor="#1A9A8F"
                dataPointsRadius={4}
                spacing={lineChartData.length > 1 ? Math.max(28, chartWidth / lineChartData.length) : 100}
                scrollToEnd
                scrollAnimation={false}
                initialSpacing={16}
                endSpacing={16}
                isAnimated
                animationDuration={500}
                pointerConfig={{
                  pointerStripColor: '#1A9A8F80',
                  pointerStripWidth: 1,
                  pointerColor: '#1A9A8F',
                  radius: 6,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 36,
                  pointerLabelComponent: (items: { value: number }[]) => (
                    <View style={{ backgroundColor: '#1C1B18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#F5F4F1', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {items[0]?.value?.toFixed(1)} {effLabel}
                      </Text>
                    </View>
                  ),
                }}
              />
            </View>
```

With this (wrapping in `ChartTransition`):

```tsx
            <ChartTransition transitionKey={period} isDark={isDark}>
              <View
                accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
              >
                <LineChart
                  key={`efficiency-${period}`}
                  data={lineChartData}
                  width={chartWidth}
                  height={160}
                  color="#1A9A8F"
                  thickness={2.5}
                  curved
                  areaChart
                  startFillColor="rgba(26, 154, 143, 0.10)"
                  endFillColor="rgba(26, 154, 143, 0.0)"
                  startOpacity={0.1}
                  endOpacity={0}
                  noOfSections={3}
                  yAxisColor="transparent"
                  xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
                  yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
                  xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
                  hideRules={false}
                  rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
                  rulesType="solid"
                  dataPointsColor="#1A9A8F"
                  dataPointsRadius={4}
                  spacing={lineChartData.length > 1 ? Math.max(28, chartWidth / lineChartData.length) : 100}
                  scrollToEnd
                  scrollAnimation={false}
                  initialSpacing={16}
                  endSpacing={16}
                  isAnimated
                  animationDuration={500}
                  pointerConfig={{
                    pointerStripColor: '#1A9A8F80',
                    pointerStripWidth: 1,
                    pointerColor: '#1A9A8F',
                    radius: 6,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 36,
                    pointerLabelComponent: (items: { value: number }[]) => (
                      <View style={{ backgroundColor: '#1C1B18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: '#F5F4F1', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                          {items[0]?.value?.toFixed(1)} {effLabel}
                        </Text>
                      </View>
                    ),
                  }}
                />
              </View>
            </ChartTransition>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "dashboard" | head -10`
Expected: No new errors referencing `dashboard.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/dashboard.tsx
git commit -m "feat: wrap LineChart with ChartTransition shimmer bridge"
```

---

## Task 4: Wrap BarChart in SpendingBarChart.tsx

**Files:**
- Modify: `src/components/SpendingBarChart.tsx:1-2, 68-93`

- [ ] **Step 1: Add import**

In `src/components/SpendingBarChart.tsx`, add this import after the existing imports (after line 2):

```tsx
import { ChartTransition } from './ChartTransition';
```

- [ ] **Step 2: Wrap the BarChart accessibility View with ChartTransition**

Find the BarChart's accessibility container (lines 68-93). Replace this block:

```tsx
      <View accessibilityLabel={`Spending bar chart, ${displayData.length} bars`}>
        <BarChart
          key={`${period}-${displayData.length}`}
          stackData={stackData}
          width={chartWidth}
          height={160}
          barWidth={24}
          spacing={barSpacing}
          initialSpacing={16}
          endSpacing={32}
          noOfSections={3}
          yAxisColor="transparent"
          xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
          yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
          xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
          hideRules={false}
          rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
          rulesType="solid"
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
          isAnimated
          animationDuration={400}
          scrollRef={scrollRef}
          scrollToEnd={needsScroll}
        />
      </View>
```

With this (wrapping in `ChartTransition`):

```tsx
      <ChartTransition transitionKey={`${period}-${displayData.length}`} isDark={isDark}>
        <View accessibilityLabel={`Spending bar chart, ${displayData.length} bars`}>
          <BarChart
            key={`${period}-${displayData.length}`}
            stackData={stackData}
            width={chartWidth}
            height={160}
            barWidth={24}
            spacing={barSpacing}
            initialSpacing={16}
            endSpacing={32}
            noOfSections={3}
            yAxisColor="transparent"
            xAxisColor={isDark ? '#2A2926' : '#F0EFEC'}
            yAxisTextStyle={{ fontSize: 10, color: isDark ? '#8A8680' : '#706C67' }}
            xAxisLabelTextStyle={{ fontSize: 9, color: isDark ? '#8A8680' : '#706C67' }}
            hideRules={false}
            rulesColor={isDark ? '#2A292620' : '#F0EFEC80'}
            rulesType="solid"
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            isAnimated
            animationDuration={400}
            scrollRef={scrollRef}
            scrollToEnd={needsScroll}
          />
        </View>
      </ChartTransition>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "SpendingBarChart" | head -10`
Expected: No new errors referencing `SpendingBarChart.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/SpendingBarChart.tsx
git commit -m "feat: wrap BarChart with ChartTransition shimmer bridge"
```

---

## Task 5: Manual verification in running app

- [ ] **Step 1: Start the dev server**

Run: `npx expo start`

Open the app on a device or simulator.

- [ ] **Step 2: Verify shimmer on LineChart**

Navigate to the Dashboard tab with a vehicle that has 2+ fuel events. Tap through each period tab (1M → 3M → 6M → YTD → 1Y → All). For each tap, verify:
- The Fuel Efficiency chart area shows a brief skeleton shimmer (~250ms)
- The new chart fades in smoothly (~200ms)
- The card header ("Fuel Efficiency" and the efficiency label) does NOT shimmer — it stays stable
- The partial-fills footnote (if present) stays stable
- No blank gap / blink between old and new chart

- [ ] **Step 3: Verify shimmer on BarChart**

On the same Dashboard screen, check the "Spending Over Time" card while tapping periods. Verify:
- The chart area shows a brief skeleton shimmer
- The new bar chart fades in smoothly
- The card header ("Spending Over Time" + "Weekly"/"Monthly") stays stable — the "Weekly"/"Monthly" label snaps, which is expected
- The legend row stays stable
- No blank gap / blink

- [ ] **Step 4: Verify no regression on initial load**

Kill and relaunch the app. Verify:
- The `DashboardSkeleton` still shows on first load (before events are loaded)
- Once loaded, charts appear without any shimmer transition (first render is `idle`, no transition)

- [ ] **Step 5: Verify dark mode**

Toggle to dark mode (Settings tab). Repeat period tapping. Verify:
- Shimmer colors match dark theme (`#2A2926` background)
- Fade-in looks correct against dark card backgrounds

- [ ] **Step 6: Final commit (update CLAUDE.md if needed)**

If `ChartTransition.tsx` was added successfully, update the project structure in `CLAUDE.md` to include it under `components/`:

Add this line in the components section of CLAUDE.md's Project Structure:

```
    ChartTransition.tsx  # Shimmer bridge for chart period transitions
```

```bash
git add CLAUDE.md
git commit -m "docs: add ChartTransition to project structure in CLAUDE.md"
```

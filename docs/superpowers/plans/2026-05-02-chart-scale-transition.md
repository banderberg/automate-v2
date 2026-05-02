# Chart Scale Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the jarring chart blink on period change with a smooth scaleY shrink → pause → grow animation.

**Architecture:** A reusable `ChartTransition` wrapper component using react-native-reanimated shared values to animate scaleY. Wraps both the BarChart and LineChart. The chart remounts (via React key) while invisible at scaleY=0.

**Tech Stack:** react-native-reanimated ~4.1.1, React Native Animated.View

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/ChartTransition.tsx` | Create | Reanimated scaleY wrapper — manages shrink/pause/grow sequence |
| `src/components/SpendingBarChart.tsx` | Modify | Wrap BarChart with ChartTransition, tighten spacing, remove isAnimated |
| `app/(tabs)/dashboard.tsx` | Modify | Import ChartTransition, wrap LineChart, remove isAnimated |

---

### Task 1: Create ChartTransition component

**Files:**
- Create: `src/components/ChartTransition.tsx`

- [ ] **Step 1: Create ChartTransition.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface ChartTransitionProps {
  transitionKey: string;
  children: React.ReactNode;
}

export function ChartTransition({ transitionKey, children }: ChartTransitionProps) {
  const [displayedKey, setDisplayedKey] = useState(transitionKey);
  const scaleY = useSharedValue(1);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (transitionKey === displayedKey) return;

    cancelAnimation(scaleY);

    const updateKey = () => {
      setDisplayedKey(transitionKey);
    };

    scaleY.value = withSequence(
      withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
      withDelay(500, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }))
    );

    // Update the displayed key after the shrink completes (200ms)
    // so the chart remounts while at scaleY 0
    setTimeout(() => runOnJS(updateKey)(), 210);
  }, [transitionKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View style={[{ transformOrigin: 'bottom', overflow: 'hidden' }, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /mnt/data/projects/automate-v2 && npx tsc --noEmit src/components/ChartTransition.tsx 2>&1 | head -20`

Expected: No type errors (or only unrelated warnings from the broader project).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChartTransition.tsx
git commit -m "feat: add ChartTransition reanimated scaleY wrapper"
```

---

### Task 2: Integrate ChartTransition into SpendingBarChart

**Files:**
- Modify: `src/components/SpendingBarChart.tsx`

- [ ] **Step 1: Add import and wrap BarChart**

At the top of `SpendingBarChart.tsx`, add:

```tsx
import { ChartTransition } from '@/src/components/ChartTransition';
```

Then wrap the `<View accessibilityLabel={...}>` containing the BarChart with ChartTransition:

```tsx
      <ChartTransition transitionKey={period}>
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
            animationDuration={400}
            scrollRef={scrollRef}
            scrollToEnd={needsScroll}
          />
        </View>
      </ChartTransition>
```

Note: `isAnimated` prop is removed from BarChart.

- [ ] **Step 2: Tighten bar spacing**

Change line 42 from:

```tsx
  const barSpacing = needsScroll ? 28 : Math.max(20, Math.min(44, (chartWidth - 40) / displayData.length - 24));
```

To:

```tsx
  const barSpacing = needsScroll ? 20 : Math.max(12, Math.min(32, (chartWidth - 40) / displayData.length - 24));
```

- [ ] **Step 3: Verify compilation**

Run: `cd /mnt/data/projects/automate-v2 && npx tsc --noEmit src/components/SpendingBarChart.tsx 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SpendingBarChart.tsx
git commit -m "feat: wrap SpendingBarChart with ChartTransition, tighten spacing"
```

---

### Task 3: Integrate ChartTransition into dashboard LineChart

**Files:**
- Modify: `app/(tabs)/dashboard.tsx`

- [ ] **Step 1: Add import**

Add to the imports section of `dashboard.tsx`:

```tsx
import { ChartTransition } from '@/src/components/ChartTransition';
```

- [ ] **Step 2: Wrap LineChart with ChartTransition**

In the fuel efficiency chart section (around line 515-562), wrap the accessibility View + LineChart with ChartTransition. The result should look like:

```tsx
            <ChartTransition transitionKey={period}>
              <View
                accessibilityLabel={`Fuel efficiency chart, ${lineChartData.length} data points, average ${metrics.efficiency.average?.toFixed(1) ?? 'N/A'} ${effLabel}`}
              >
                <LineChart
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
                  initialSpacing={16}
                  endSpacing={16}
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

Note: `isAnimated` prop is removed from LineChart.

- [ ] **Step 3: Verify compilation**

Run: `cd /mnt/data/projects/automate-v2 && npx tsc --noEmit app/\(tabs\)/dashboard.tsx 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/dashboard.tsx"
git commit -m "feat: wrap LineChart with ChartTransition, remove isAnimated"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Start dev server**

Run: `cd /mnt/data/projects/automate-v2 && npx expo start`

- [ ] **Step 2: Test the transition**

On the dashboard:
1. Tap different period buttons (1M, 3M, 6M, YTD, 1Y, All)
2. Verify: bars shrink down toward x-axis (~200ms), pause (~500ms), grow back up with new data (~300ms)
3. Verify: line chart does the same shrink/pause/grow
4. Verify: card headers and legends remain stable during transition
5. Verify: rapid tapping doesn't break the animation (should reset cleanly)
6. Verify: first render shows charts immediately without animation

- [ ] **Step 3: Test edge cases**

1. Switch between periods that have the same number of data points
2. Switch to a period with no data (if possible) — chart should just disappear
3. Verify bar tap-to-select still works after transition completes
4. Check both light and dark modes

- [ ] **Step 4: Final commit (if any tweaks needed)**

```bash
git add -A
git commit -m "fix: chart transition tweaks from visual testing"
```

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
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (prevKeyRef.current === transitionKey) return;
    prevKeyRef.current = transitionKey;

    if (measuredHeight == null) return;

    animRef.current?.stop();

    setPhase('shimmer');
    fadeAnim.setValue(0);

    shimmerTimerRef.current = setTimeout(() => {
      setPhase('reveal');
      const anim = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start(() => {
        setPhase('idle');
      });
    }, SHIMMER_DURATION);

    return () => {
      if (shimmerTimerRef.current != null) {
        clearTimeout(shimmerTimerRef.current);
      }
      animRef.current?.stop();
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

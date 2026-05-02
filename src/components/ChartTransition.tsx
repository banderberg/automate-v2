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
  const cachedChildren = useRef<React.ReactNode>(children);

  if (transitionKey === displayedKey) {
    cachedChildren.current = children;
  }

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

    setTimeout(() => runOnJS(updateKey)(), 210);
  }, [transitionKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View style={[{ transformOrigin: 'bottom', overflow: 'hidden' }, animatedStyle]}>
      {cachedChildren.current}
    </Animated.View>
  );
}

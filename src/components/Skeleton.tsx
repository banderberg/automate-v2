import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';

interface SkeletonBoneProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBone({ width, height, borderRadius = 8, style }: SkeletonBoneProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#2A2926' : '#E8E6E1',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Period tabs */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBone key={i} width={36} height={16} borderRadius={4} />
        ))}
      </View>

      {/* "Total Spent" label */}
      <SkeletonBone width={80} height={10} borderRadius={3} style={{ marginBottom: 8 }} />

      {/* Hero number */}
      <SkeletonBone width={180} height={48} borderRadius={6} style={{ marginBottom: 24 }} />

      {/* Secondary metrics row */}
      <View style={{ flexDirection: 'row', marginBottom: 32 }}>
        <View style={{ flex: 1 }}>
          <SkeletonBone width={70} height={10} borderRadius={3} style={{ marginBottom: 8 }} />
          <SkeletonBone width={60} height={22} borderRadius={4} />
        </View>
        <View style={{ width: 1, marginHorizontal: 20 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBone width={70} height={10} borderRadius={3} style={{ marginBottom: 8 }} />
          <SkeletonBone width={60} height={22} borderRadius={4} />
        </View>
      </View>

      {/* Chart card */}
      <SkeletonBone width="100%" height={200} borderRadius={20} style={{ marginBottom: 24 }} />

      {/* Spending card */}
      <SkeletonBone width="100%" height={140} borderRadius={20} style={{ marginBottom: 24 }} />

      {/* Recent header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <SkeletonBone width={50} height={14} borderRadius={4} />
        <SkeletonBone width={40} height={14} borderRadius={4} />
      </View>

      {/* Recent events */}
      <SkeletonBone width="100%" height={180} borderRadius={20} />
    </View>
  );
}

export function RemindersSkeleton() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{ borderRadius: 20, padding: 16, borderWidth: 1, borderColor: isDark ? '#2A2926' : '#E2E0DB' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <SkeletonBone width={140} height={16} borderRadius={4} />
            <SkeletonBone width={64} height={20} borderRadius={10} />
          </View>
          <SkeletonBone width="100%" height={6} borderRadius={3} style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <SkeletonBone width={100} height={12} borderRadius={3} />
            <SkeletonBone width={80} height={12} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function HistorySkeleton() {
  return (
    <View style={{ paddingTop: 8 }}>
      {/* Month header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <SkeletonBone width={110} height={14} borderRadius={4} />
        <SkeletonBone width={60} height={14} borderRadius={4} />
      </View>

      {/* Event rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <SkeletonBone width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBone width={120} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBone width={80} height={10} borderRadius={3} />
          </View>
          <SkeletonBone width={50} height={14} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

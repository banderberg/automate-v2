import { View, Text, Pressable } from 'react-native';
import type { ReminderWithStatus } from '../types';

interface ReminderCardProps {
  reminder: ReminderWithStatus;
  odometerUnit: 'miles' | 'kilometers';
  onPress: () => void;
}

const STATUS_STYLES = {
  overdue: { badge: '#FEE2E2', text: '#EF4444', bar: '#EF4444' },
  soon: { badge: '#FEF3C7', text: '#92400E', bar: '#F59E0B' },
  upcoming: { badge: '#D1FAE5', text: '#10B981', bar: '#10B981' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function progressRatio(reminder: ReminderWithStatus): number {
  if (reminder.distanceRemaining != null && reminder.distanceInterval != null && reminder.distanceInterval > 0) {
    const distRatio = 1 - reminder.distanceRemaining / reminder.distanceInterval;
    if (reminder.daysRemaining != null && reminder.timeInterval != null) {
      const totalDays = reminder.timeInterval * (
        reminder.timeUnit === 'years' ? 365
          : reminder.timeUnit === 'months' ? 30
            : reminder.timeUnit === 'weeks' ? 7 : 1
      );
      if (totalDays > 0) {
        const timeRatio = 1 - reminder.daysRemaining / totalDays;
        return Math.max(0, Math.min(1, Math.max(distRatio, timeRatio)));
      }
    }
    return Math.max(0, Math.min(1, distRatio));
  }
  if (reminder.daysRemaining != null && reminder.timeInterval != null) {
    const totalDays = reminder.timeInterval * (
      reminder.timeUnit === 'years' ? 365
        : reminder.timeUnit === 'months' ? 30
          : reminder.timeUnit === 'weeks' ? 7 : 1
    );
    if (totalDays > 0) {
      return Math.max(0, Math.min(1, 1 - reminder.daysRemaining / totalDays));
    }
  }
  return 0;
}

export function ReminderCard({ reminder, odometerUnit, onPress }: ReminderCardProps) {
  const styles = STATUS_STYLES[reminder.status];
  const statusLabel = reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1);
  const ratio = progressRatio(reminder);
  const odoLabel = odometerUnit === 'miles' ? 'mi' : 'km';
  const pctLabel = `${Math.round(ratio * 100)}%`;

  return (
    <Pressable
      onPress={onPress}
      className="bg-card dark:bg-card-dark rounded-2xl p-4 border border-divider-subtle dark:border-divider-dark active:opacity-80"
      accessibilityLabel={`${reminder.linkedName} reminder, status: ${statusLabel}, ${pctLabel} progress`}
      accessibilityRole="button"
    >
      {/* Name + status badge */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-base font-semibold text-ink dark:text-ink-on-dark flex-1 mr-3" numberOfLines={1}>
          {reminder.linkedName}
        </Text>
        <View
          className="px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: styles.badge }}
          accessibilityLabel={`${statusLabel} reminder`}
        >
          <Text className="text-xs font-bold" style={{ color: styles.text }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="flex-row items-center mb-2.5 gap-2">
        <View className="flex-1 h-1.5 bg-divider dark:bg-divider-dark rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${ratio * 100}%`, backgroundColor: styles.bar }}
          />
        </View>
        <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark w-8 text-right">{pctLabel}</Text>
      </View>

      {/* Next due info */}
      <View className="gap-1">
        {reminder.nextOdometer != null && (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark">
            Next: {reminder.nextOdometer.toLocaleString('en-US')} {odoLabel}
            {reminder.distanceRemaining != null && (
              <Text>
                {' '}({reminder.distanceRemaining > 0 ? `${reminder.distanceRemaining.toLocaleString('en-US')} ${odoLabel} remaining` : 'overdue'})
              </Text>
            )}
          </Text>
        )}
        {reminder.nextDate != null && (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-on-dark">
            Next: {formatDate(reminder.nextDate)}
            {reminder.daysRemaining != null && (
              <Text>
                {' '}({reminder.daysRemaining > 0 ? `${reminder.daysRemaining} days remaining` : 'overdue'})
              </Text>
            )}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

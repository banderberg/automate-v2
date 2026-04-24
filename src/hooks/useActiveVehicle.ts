import { useMemo } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { useEventStore } from '../stores/eventStore';
import { useReminderStore } from '../stores/reminderStore';

export function useActiveVehicle() {
  const activeVehicle = useVehicleStore((s) => s.activeVehicle);
  const events = useEventStore((s) => s.events);
  const reminders = useReminderStore((s) => s.reminders);

  const currentOdometer = useMemo(() => {
    const odometers = events
      .filter((e) => e.odometer != null)
      .map((e) => e.odometer!);
    return odometers.length > 0 ? Math.max(...odometers) : null;
  }, [events]);

  const fuelEvents = useMemo(
    () => events.filter((e) => e.type === 'fuel'),
    [events]
  );

  const serviceEvents = useMemo(
    () => events.filter((e) => e.type === 'service'),
    [events]
  );

  const expenseEvents = useMemo(
    () => events.filter((e) => e.type === 'expense'),
    [events]
  );

  const eventCount = events.length;

  return {
    activeVehicle,
    events,
    reminders,
    currentOdometer,
    fuelEvents,
    serviceEvents,
    expenseEvents,
    eventCount,
  };
}

import { Linking } from 'react-native';

let Notifications: typeof import('expo-notifications') | null = null;

async function getNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Notifications) return Notifications;
  try {
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  } catch {
    return null;
  }
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const n = await getNotifications();
  if (!n) return 'undetermined';
  const { status } = await n.getPermissionsAsync();
  return status;
}

export async function requestPermission(): Promise<boolean> {
  const n = await getNotifications();
  if (!n) return false;
  const { status: existing } = await n.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await n.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminder(
  nextDate: string,
  reminderName: string,
  vehicleName: string
): Promise<string | null> {
  const n = await getNotifications();
  if (!n) return null;

  const granted = await requestPermission();
  if (!granted) return null;

  const triggerDate = new Date(nextDate + 'T08:00:00');
  if (triggerDate.getTime() <= Date.now()) return null;

  const id = await n.scheduleNotificationAsync({
    content: {
      title: 'AutoMate Reminder',
      body: `${reminderName} is due for ${vehicleName}`,
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return id;
}

export async function cancelReminder(notificationId: string): Promise<void> {
  const n = await getNotifications();
  if (!n) return;
  try {
    await n.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Best effort — notification may have already fired or been cleared
  }
}

export function openNotificationSettings(): void {
  Linking.openSettings();
}

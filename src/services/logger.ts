import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LogLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

type LogContext = Record<string, string | number | boolean | null | undefined>;

let initialized = false;

/**
 * Reads the Sentry DSN from Expo public env (`EXPO_PUBLIC_SENTRY_DSN`) or
 * the `extra.sentryDsn` field in app.json. Returns null if neither is set.
 */
function resolveDsn(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (fromExtra && fromExtra.length > 0) return fromExtra;
  return null;
}

function resolveEnvironment(): string {
  if (__DEV__) return 'development';
  const channel = (Constants.expoConfig?.extra as { eas?: { channel?: string } } | undefined)
    ?.eas?.channel;
  if (channel) return channel;
  return 'production';
}

function resolveRelease(): string | undefined {
  const version = Constants.expoConfig?.version;
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();
  if (!version) return undefined;
  return buildNumber ? `${version}+${buildNumber}` : version;
}

/**
 * Initializes Sentry and global error handlers. Safe to call multiple times;
 * subsequent calls are no-ops. If no DSN is configured, the logger still
 * forwards to console.error in dev but skips remote reporting.
 */
export function initLogger(): void {
  if (initialized) return;
  initialized = true;

  const dsn = resolveDsn();
  if (dsn) {
    Sentry.init({
      dsn,
      environment: resolveEnvironment(),
      release: resolveRelease(),
      tracesSampleRate: 0,
      enableNativeCrashHandling: true,
      attachStacktrace: true,
      debug: false,
    });
  }

  installGlobalHandlers();
}

function installGlobalHandlers(): void {
  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;

  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      logError(error, { source: 'globalHandler', fatal: isFatal ?? false });
      previous(error, isFatal);
    });
  }

  const tracking = (globalThis as { HermesInternal?: unknown }).HermesInternal
    ? safeRequire('promise/setimmediate/rejection-tracking')
    : null;
  if (tracking && typeof tracking.enable === 'function') {
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: unknown) => {
        logError(error, { source: 'unhandledRejection', rejectionId: id });
      },
      onHandled: () => {
        // Rejection eventually handled — nothing to do.
      },
    });
  }
}

function safeRequire(
  moduleName: string
): { enable?: (opts: unknown) => void } | null {
  try {
    return require(moduleName) as { enable?: (opts: unknown) => void };
  } catch {
    return null;
  }
}

/**
 * Reports an error to Sentry (if configured) and logs it to the console in dev.
 * `context` is attached as Sentry "extra" data and is searchable in the dashboard.
 */
export function logError(error: unknown, context?: LogContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (__DEV__) {
    console.error('[logger]', err.message, context ?? {});
  }

  if (initialized) {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  }
}

/**
 * Reports a non-throwing message (e.g. a recoverable warning) to Sentry.
 */
export function logMessage(message: string, level: LogLevel = 'info', context?: LogContext): void {
  if (__DEV__) {
    const fn = level === 'error' || level === 'fatal' ? console.error : console.log;
    fn('[logger]', message, context ?? {});
  }

  if (initialized) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
}

/**
 * Tags the current Sentry session with an anonymous user id so errors can be
 * grouped by user without collecting PII.
 */
export function setLoggerUser(id: string): void {
  if (!initialized) return;
  Sentry.setUser({ id });
}

/**
 * Sets a tag (indexed, low-cardinality) on the current Sentry scope.
 */
export function setLoggerTag(key: string, value: string): void {
  if (!initialized) return;
  Sentry.setTag(key, value);
}

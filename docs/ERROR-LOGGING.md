# Error Logging Setup

The app reports errors to [Sentry](https://sentry.io) via `@sentry/react-native`. Without a configured DSN, the logger no-ops on remote reporting and only logs to the dev console — so the app runs fine without setup, but you won't see production errors.

## One-time setup

### 1. Create the Sentry DSN environment variable

Set `EXPO_PUBLIC_SENTRY_DSN` for every EAS environment you build for:

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_DSN \
  --value "https://your-dsn-here@sentry.io/your-project" \
  --visibility plaintext \
  --environment production \
  --environment preview \
  --environment development
```

`plaintext` is fine — DSNs are designed to be embedded in client apps and are not secret. Use `--visibility sensitive` if you'd rather mask the value in EAS dashboard URLs.

Verify with:

```bash
eas env:list
```

### 2. Local dev

For `expo start`, set the same var in a gitignored `.env.local`:

```bash
echo 'EXPO_PUBLIC_SENTRY_DSN=https://your-dsn-here@sentry.io/your-project' > .env.local
```

`.env*.local` is already in `.gitignore`.

### 3. Verify it works

Temporarily drop a test button into any screen, tap it, then look for the event in your Sentry dashboard:

```ts
import { logError } from '@/src/services/logger';

<Button title="Sentry test" onPress={() => logError(new Error('hello from automate-v2'))} />
```

The event should arrive within ~30s and include the anonymous device id, app version, and platform tags set by `attachLoggerContext()` in `app/_layout.tsx`.

## How it works

- `src/services/logger.ts` is the single facade. Callers never import `@sentry/react-native` directly.
- `initLogger()` runs at the top of `app/_layout.tsx` (before the root component renders), reads the DSN, and installs:
  - The Sentry SDK (only if a DSN is set)
  - A global `ErrorUtils` handler for native/JS crashes
  - A Hermes promise rejection tracker for unhandled async failures
- After app init, `attachLoggerContext()` tags the session with `appVersion`, `buildVersion`, `platform`, and an anonymous device id so errors group cleanly per-user/version. No PII.
- `AppErrorBoundary.componentDidCatch` reports React render crashes with the component stack as `extra` data.
- All 30 catch blocks across the 6 Zustand stores call `logError(e, { store, action, ... })` so errors are searchable per-flow in the Sentry dashboard.

## Logger API

```ts
import { logError, logMessage, setLoggerUser, setLoggerTag } from '@/src/services/logger';

// Report an error with optional searchable context
logError(err, { store: 'eventStore', action: 'addEvent', eventType: 'fuel' });

// Report a non-throwing message
logMessage('cache rebuilt', 'info', { entries: 42 });

// Set/update user or tag context (rarely needed outside _layout.tsx)
setLoggerUser('anonymous-device-id');
setLoggerTag('experiment', 'b');
```

`logError` accepts unknown values — it normalises non-`Error` throws into `Error` instances before reporting.

## Optional: source maps for EAS builds

Without source maps, stack traces show minified bundle paths. To upload them automatically on every EAS build, configure the Sentry plugin in `app.json` with the org and project, then set a Sentry auth token as an EAS secret:

1. Create an auth token at https://sentry.io/settings/account/api/auth-tokens/ with the `project:releases` scope.
2. Store it as a secret in EAS:
   ```bash
   eas env:create --name SENTRY_AUTH_TOKEN \
     --value "sntrys_..." \
     --visibility secret \
     --environment production --environment preview
   ```
3. Update the plugin entry in `app.json`:
   ```json
   ["@sentry/react-native/expo", {
     "organization": "your-org-slug",
     "project": "your-project-slug"
   }]
   ```

The plugin reads `SENTRY_AUTH_TOKEN` from the build environment automatically; do not hardcode it in `app.json`.

## Cost

Sentry's free Developer plan covers 5k errors/month, which is plenty for a single-user-base app. If you blow past that, the next tier is ~$26/month for 50k events.

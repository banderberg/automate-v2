import { useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

const GUARD_MS = 500;

export function useGuardedNavigate() {
  const router = useRouter();
  const navigating = useRef(false);

  const push = useCallback(
    (href: Href) => {
      if (navigating.current) return;
      navigating.current = true;
      router.push(href);
      setTimeout(() => { navigating.current = false; }, GUARD_MS);
    },
    [router],
  );

  const replace = useCallback(
    (href: Href) => {
      if (navigating.current) return;
      navigating.current = true;
      router.replace(href);
      setTimeout(() => { navigating.current = false; }, GUARD_MS);
    },
    [router],
  );

  return { push, replace, back: router.back };
}

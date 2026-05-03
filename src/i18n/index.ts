import { I18n, type TranslateOptions } from 'i18n-js';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';

const i18n = new I18n({ en });

i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? 'en';

type Primitive = string | number | boolean | null;

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type LeafPaths<T> = {
  [K in keyof T]-?: T[K] extends Primitive
    ? K & string
    : T[K] extends object
      ? Join<K, LeafPaths<T[K]>>
      : never;
}[keyof T];

export type TranslationKey = LeafPaths<typeof en>;

type TranslateParams = Record<string, string | number>;

export function t(key: TranslationKey, params?: TranslateParams): string {
  return i18n.t(key, params as TranslateOptions);
}

export { i18n };

export interface CurrencyConfig {
  symbol: string;
  position: 'prefix' | 'suffix';
  space: boolean;
  decimals: number;
  name: string;
}

export const CURRENCY_MAP: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', position: 'prefix', space: false, decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', position: 'suffix', space: true, decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', position: 'prefix', space: false, decimals: 2, name: 'British Pound' },
  CAD: { symbol: 'C$', position: 'prefix', space: false, decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', position: 'prefix', space: false, decimals: 2, name: 'Australian Dollar' },
  INR: { symbol: '₹', position: 'prefix', space: false, decimals: 2, name: 'Indian Rupee' },
  BRL: { symbol: 'R$', position: 'prefix', space: false, decimals: 2, name: 'Brazilian Real' },
  MXN: { symbol: 'MX$', position: 'prefix', space: false, decimals: 2, name: 'Mexican Peso' },
  JPY: { symbol: '¥', position: 'prefix', space: false, decimals: 0, name: 'Japanese Yen' },
  KRW: { symbol: '₩', position: 'prefix', space: false, decimals: 0, name: 'Korean Won' },
  PLN: { symbol: 'zł', position: 'suffix', space: true, decimals: 2, name: 'Polish Złoty' },
  SEK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Swedish Krona' },
  NOK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', position: 'suffix', space: true, decimals: 2, name: 'Danish Krone' },
  CHF: { symbol: 'CHF', position: 'prefix', space: true, decimals: 2, name: 'Swiss Franc' },
  ZAR: { symbol: 'R', position: 'prefix', space: false, decimals: 2, name: 'South African Rand' },
  TRY: { symbol: '₺', position: 'prefix', space: false, decimals: 2, name: 'Turkish Lira' },
  RUB: { symbol: '₽', position: 'suffix', space: true, decimals: 2, name: 'Russian Ruble' },
  PHP: { symbol: '₱', position: 'prefix', space: false, decimals: 2, name: 'Philippine Peso' },
  NZD: { symbol: 'NZ$', position: 'prefix', space: false, decimals: 2, name: 'New Zealand Dollar' },
};

function getConfig(code: string): CurrencyConfig {
  return CURRENCY_MAP[code] ?? CURRENCY_MAP.USD;
}

export function getCurrencySymbol(code: string): string {
  return getConfig(code).symbol;
}

export function formatCurrency(amount: number, code: string): string {
  const cfg = getConfig(code);
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  if (cfg.position === 'suffix') {
    return cfg.space ? `${formatted} ${cfg.symbol}` : `${formatted}${cfg.symbol}`;
  }
  return cfg.space ? `${cfg.symbol} ${formatted}` : `${cfg.symbol}${formatted}`;
}

export interface SplitCurrencyResult {
  symbol: string;
  dollars: string;
  cents: string;
  position: 'prefix' | 'suffix';
  decimals: number;
}

export function splitCurrency(amount: number, code: string): SplitCurrencyResult {
  const cfg = getConfig(code);
  const fixed = amount.toFixed(cfg.decimals);
  const [whole, frac] = fixed.split('.');
  return {
    symbol: cfg.symbol,
    dollars: parseInt(whole, 10).toLocaleString('en-US'),
    cents: frac ?? (cfg.decimals > 0 ? '00' : ''),
    position: cfg.position,
    decimals: cfg.decimals,
  };
}

export const CURRENCIES: { value: string; label: string }[] = Object.entries(CURRENCY_MAP).map(
  ([code, cfg]) => ({ value: code, label: `${cfg.symbol} ${cfg.name} (${code})` }),
);

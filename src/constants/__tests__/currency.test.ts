import {
  CURRENCY_MAP,
  CURRENCIES,
  getCurrencySymbol,
  formatCurrency,
  splitCurrency,
} from '../currency';

describe('CURRENCY_MAP', () => {
  it('contains 20 currencies', () => {
    expect(Object.keys(CURRENCY_MAP)).toHaveLength(20);
  });

  it('every entry has required fields', () => {
    for (const [code, cfg] of Object.entries(CURRENCY_MAP)) {
      expect(cfg.symbol).toBeTruthy();
      expect(['prefix', 'suffix']).toContain(cfg.position);
      expect(typeof cfg.space).toBe('boolean');
      expect(cfg.decimals).toBeGreaterThanOrEqual(0);
      expect(cfg.name).toBeTruthy();
    }
  });
});

describe('CURRENCIES picker list', () => {
  it('has one entry per currency in the map', () => {
    expect(CURRENCIES).toHaveLength(Object.keys(CURRENCY_MAP).length);
  });

  it('each entry has value (code) and a label with symbol and name', () => {
    for (const entry of CURRENCIES) {
      expect(entry.value).toBeTruthy();
      expect(CURRENCY_MAP[entry.value]).toBeDefined();
      expect(entry.label).toContain(entry.value);
      expect(entry.label).toContain(CURRENCY_MAP[entry.value].symbol);
    }
  });
});

describe('getCurrencySymbol', () => {
  it('returns the symbol for known currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('PLN')).toBe('zł');
    expect(getCurrencySymbol('CHF')).toBe('CHF');
  });

  it('falls back to USD symbol for unknown code', () => {
    expect(getCurrencySymbol('XYZ')).toBe('$');
  });
});

describe('formatCurrency', () => {
  describe('prefix currencies without space', () => {
    it('USD — basic amount', () => {
      expect(formatCurrency(42.5, 'USD')).toBe('$42.50');
    });

    it('USD — thousands separator', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    });

    it('USD — zero', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
    });

    it('GBP', () => {
      expect(formatCurrency(99.9, 'GBP')).toBe('£99.90');
    });

    it('multi-char prefix symbol (CAD)', () => {
      expect(formatCurrency(10, 'CAD')).toBe('C$10.00');
    });
  });

  describe('prefix currencies with space', () => {
    it('CHF', () => {
      expect(formatCurrency(100, 'CHF')).toBe('CHF 100.00');
    });
  });

  describe('suffix currencies with space', () => {
    it('EUR', () => {
      expect(formatCurrency(42.5, 'EUR')).toBe('42.50 €');
    });

    it('PLN', () => {
      expect(formatCurrency(1500, 'PLN')).toBe('1,500.00 zł');
    });

    it('RUB', () => {
      expect(formatCurrency(2999.99, 'RUB')).toBe('2,999.99 ₽');
    });
  });

  describe('zero-decimal currencies', () => {
    it('JPY — no decimal places', () => {
      expect(formatCurrency(1500, 'JPY')).toBe('¥1,500');
    });

    it('KRW — no decimal places', () => {
      expect(formatCurrency(50000, 'KRW')).toBe('₩50,000');
    });

    it('JPY — rounds to integer', () => {
      expect(formatCurrency(1500.7, 'JPY')).toBe('¥1,501');
    });
  });

  describe('unknown currency falls back to USD', () => {
    it('formats like USD', () => {
      expect(formatCurrency(10, 'FAKE')).toBe('$10.00');
    });
  });
});

describe('splitCurrency', () => {
  it('USD — splits whole and fractional parts', () => {
    const result = splitCurrency(1234.56, 'USD');
    expect(result.symbol).toBe('$');
    expect(result.dollars).toBe('1,234');
    expect(result.cents).toBe('56');
    expect(result.position).toBe('prefix');
    expect(result.decimals).toBe(2);
  });

  it('USD — zero amount', () => {
    const result = splitCurrency(0, 'USD');
    expect(result.dollars).toBe('0');
    expect(result.cents).toBe('00');
  });

  it('USD — pads single-digit cents', () => {
    const result = splitCurrency(5.1, 'USD');
    expect(result.cents).toBe('10');
  });

  it('EUR — suffix position', () => {
    const result = splitCurrency(99.99, 'EUR');
    expect(result.symbol).toBe('€');
    expect(result.position).toBe('suffix');
    expect(result.dollars).toBe('99');
    expect(result.cents).toBe('99');
  });

  it('JPY — zero-decimal currency returns empty cents', () => {
    const result = splitCurrency(1500, 'JPY');
    expect(result.symbol).toBe('¥');
    expect(result.dollars).toBe('1,500');
    expect(result.cents).toBe('');
    expect(result.decimals).toBe(0);
  });

  it('KRW — zero-decimal currency returns empty cents', () => {
    const result = splitCurrency(50000, 'KRW');
    expect(result.cents).toBe('');
  });

  it('unknown code falls back to USD', () => {
    const result = splitCurrency(10, 'NOPE');
    expect(result.symbol).toBe('$');
    expect(result.position).toBe('prefix');
    expect(result.cents).toBe('00');
  });
});

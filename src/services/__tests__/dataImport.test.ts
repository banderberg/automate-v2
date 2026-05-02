jest.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));
jest.mock('../../db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('../../db/queries/places', () => ({}));
jest.mock('../../db/queries/namedEntities', () => ({
  serviceTypeQueries: {},
  categoryQueries: {},
}));

import { detectFormat, parseDrivvoCSV } from '../dataImport';

describe('detectFormat', () => {
  it('detects fuelio via "## Vehicle:" marker', () => {
    expect(detectFormat('## Vehicle: My Car\nDate,Fuel station,...')).toBe('fuelio');
  });

  it('detects automate via header', () => {
    expect(detectFormat('EventType,Odometer,OdometerUnit,Cost\n...')).toBe('automate');
  });

  it('detects fuelly via header', () => {
    expect(detectFormat('Date,MPG,Miles,Gallons,Price\n...')).toBe('fuelly');
  });

  it('detects drivvo via "## Drivvo" marker', () => {
    expect(detectFormat('## Drivvo Fuel\nDate,Volume,...')).toBe('drivvo');
  });

  it('detects drivvo via "fuel station" + "fill type" headers', () => {
    expect(detectFormat('Date,Volume,Fuel Station,Fill Type,Total Cost\n...')).toBe('drivvo');
  });

  it('returns unknown for unrecognized content', () => {
    expect(detectFormat('random,data,here\n1,2,3')).toBe('unknown');
  });

  it('fuelio wins over drivvo when both markers present', () => {
    expect(detectFormat('## Vehicle: My Car\nfuel station,fill type\n...')).toBe('fuelio');
  });
});

describe('parseDrivvoCSV', () => {
  describe('fuel section', () => {
    it('parses a basic fuel section with section marker', () => {
      const csv = [
        '## Fuel',
        'Date,Volume,Price/Volume,Total Cost,Odometer,Fuel Station,Fill Type,Notes',
        '2025-03-15,40.5,1.459,59.09,12500,Shell,Full,Regular trip',
        '2025-03-01,35.2,1.509,53.12,12100,BP,Partial,',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.format).toBe('drivvo');
      expect(result.events).toHaveLength(2);

      const first = result.events[0];
      expect(first.date).toBe('2025-03-15');
      expect(first.type).toBe('fuel');
      expect(first.cost).toBe(59.09);
      expect(first.volume).toBe(40.5);
      expect(first.pricePerUnit).toBeCloseTo(1.459);
      expect(first.odometer).toBe(12500);
      expect(first.placeName).toBe('Shell');
      expect(first.isPartialFill).toBe(false);
      expect(first.notes).toBe('Regular trip');

      const second = result.events[1];
      expect(second.isPartialFill).toBe(true);
      expect(second.notes).toBeUndefined();
    });

    it('parses DD/MM/YYYY date format', () => {
      const csv = [
        '## Fuel',
        'Date,Volume,Total Cost',
        '15/03/2025,40.5,59.09',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].date).toBe('2025-03-15');
    });

    it('handles missing optional columns gracefully', () => {
      const csv = [
        '## Fuel',
        'Date,Total Cost',
        '2025-03-15,59.09',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].cost).toBe(59.09);
      expect(result.events[0].volume).toBeUndefined();
      expect(result.events[0].odometer).toBeUndefined();
      expect(result.events[0].placeName).toBeUndefined();
    });

    it('skips rows with invalid dates', () => {
      const csv = [
        '## Fuel',
        'Date,Total Cost',
        'not-a-date,59.09',
        '2025-03-15,42.00',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].cost).toBe(42);
    });

    it('skips rows with non-numeric total cost', () => {
      const csv = [
        '## Fuel',
        'Date,Total Cost',
        '2025-03-15,abc',
        '2025-03-15,42.00',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
    });
  });

  describe('service section', () => {
    it('parses service events', () => {
      const csv = [
        '## Service',
        'Date,Description,Cost,Odometer,Notes',
        '2025-02-10,Oil Change,45.00,11800,Synthetic',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);

      const event = result.events[0];
      expect(event.type).toBe('service');
      expect(event.date).toBe('2025-02-10');
      expect(event.cost).toBe(45);
      expect(event.odometer).toBe(11800);
      expect(event.serviceTypes).toEqual(['Oil Change']);
      expect(event.notes).toBe('Synthetic');
    });
  });

  describe('expense section', () => {
    it('parses expense events', () => {
      const csv = [
        '## Expense',
        'Date,Description,Cost,Notes',
        '2025-01-20,Parking Pass,120.00,Monthly',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);

      const event = result.events[0];
      expect(event.type).toBe('expense');
      expect(event.category).toBe('Parking Pass');
      expect(event.cost).toBe(120);
    });
  });

  describe('type field override', () => {
    it('overrides to expense when type column contains expense keywords', () => {
      const csv = [
        '## Service',
        'Date,Description,Cost,Type',
        '2025-01-20,Parking,50.00,Parking',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].type).toBe('expense');
      expect(result.events[0].category).toBe('Parking');
      expect(result.events[0].serviceTypes).toBeUndefined();
    });

    it('overrides to expense for toll type', () => {
      const csv = [
        '## Service',
        'Date,Description,Cost,Type',
        '2025-01-20,Highway toll,5.00,Toll',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].type).toBe('expense');
    });
  });

  describe('multi-section parsing', () => {
    it('parses fuel + service + expense in one file', () => {
      const csv = [
        '## Fuel',
        'Date,Volume,Total Cost,Fuel Station,Fill Type',
        '2025-03-15,40.5,59.09,Shell,Full',
        '',
        '## Service',
        'Date,Description,Cost',
        '2025-02-10,Oil Change,45.00',
        '',
        '## Expense',
        'Date,Description,Cost',
        '2025-01-20,Insurance,200.00',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(3);

      const types = result.events.map((e) => e.type);
      expect(types).toEqual(['fuel', 'service', 'expense']);
    });

    it('resets header map between sections', () => {
      const csv = [
        '## Fuel',
        'Date,Volume,Total Cost',
        '2025-03-15,40.5,59.09',
        '## Service',
        'Date,Description,Cost',
        '2025-02-10,Oil Change,45.00',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(2);
      expect(result.events[1].serviceTypes).toEqual(['Oil Change']);
    });
  });

  describe('flexible header matching', () => {
    it('matches case-insensitive headers', () => {
      const csv = [
        '## Fuel',
        'DATE,VOLUME,TOTAL COST,ODOMETER',
        '2025-03-15,40.5,59.09,12500',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].volume).toBe(40.5);
      expect(result.events[0].odometer).toBe(12500);
    });

    it('matches alternate column names (Quantity instead of Volume)', () => {
      const csv = [
        '## Fuel',
        'Date,Quantity,Total Cost',
        '2025-03-15,40.5,59.09',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].volume).toBe(40.5);
    });

    it('matches "Mileage" for odometer', () => {
      const csv = [
        '## Fuel',
        'Date,Total Cost,Mileage',
        '2025-03-15,59.09,12500',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].odometer).toBe(12500);
    });
  });

  describe('headerless section detection', () => {
    it('auto-detects fuel section from header content without ## marker', () => {
      const csv = [
        'Date,Volume,Total Cost,Fill Type',
        '2025-03-15,40.5,59.09,Full',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('fuel');
    });

    it('auto-detects service/expense section from header content without ## marker', () => {
      const csv = [
        'Date,Description,Cost,Type',
        '2025-02-10,Oil Change,45.00,Service',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('service');
    });
  });

  describe('quoted fields', () => {
    it('handles commas inside quoted fields', () => {
      const csv = [
        '## Fuel',
        'Date,Total Cost,Fuel Station,Fill Type',
        '2025-03-15,59.09,"Shell, Main St",Full',
      ].join('\n');

      const result = parseDrivvoCSV(csv);
      expect(result.events[0].placeName).toBe('Shell, Main St');
    });
  });

  describe('empty input', () => {
    it('returns empty events for empty string', () => {
      const result = parseDrivvoCSV('');
      expect(result.events).toHaveLength(0);
      expect(result.format).toBe('drivvo');
    });

    it('returns empty events for only section markers', () => {
      const result = parseDrivvoCSV('## Fuel\n## Service\n');
      expect(result.events).toHaveLength(0);
    });
  });
});

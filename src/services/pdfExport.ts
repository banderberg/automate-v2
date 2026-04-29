import { printToFileAsync } from 'expo-print';
import { getDatabase } from '../db/client';

interface EventRow {
  eventId: string;
  date: string;
  type: string;
  odometer: number | null;
  odometerUnit: string;
  cost: number;
  volume: number | null;
  volumeUnit: string;
  pricePerUnit: number | null;
  placeName: string | null;
  categoryName: string | null;
  notes: string | null;
}

interface VehicleRow {
  nickname: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  vin: string | null;
  odometerUnit: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${months[monthIdx]} ${parseInt(day, 10)}, ${year}`;
}

function getEventTypeColor(type: string): string {
  switch (type) {
    case 'fuel':
      return '#1A9A8F';
    case 'service':
      return '#E8772B';
    case 'expense':
      return '#2EAD76';
    default:
      return '#6B7280';
  }
}

function getEventTypeLabel(type: string): string {
  switch (type) {
    case 'fuel':
      return 'Fuel';
    case 'service':
      return 'Service';
    case 'expense':
      return 'Expense';
    default:
      return type;
  }
}

function buildDescription(
  row: EventRow,
  serviceTypeNames: string | undefined,
): string {
  switch (row.type) {
    case 'fuel': {
      const vol = row.volume != null ? row.volume.toFixed(2) : '-';
      const unit = row.volumeUnit || 'gal';
      const price = row.pricePerUnit != null ? `$${row.pricePerUnit.toFixed(3)}` : '-';
      return `Fill-Up: ${vol} ${unit} @ ${price}/${unit === 'gallons' ? 'gal' : unit === 'litres' ? 'L' : unit}`;
    }
    case 'service':
      return serviceTypeNames || '-';
    case 'expense':
      return row.categoryName || '-';
    default:
      return '-';
  }
}

function buildHtml(
  vehicle: VehicleRow,
  rows: EventRow[],
  serviceTypeMap: Map<string, string>,
  startDate: string | undefined,
  endDate: string | undefined,
): string {
  const totalSpent = rows.reduce((sum, r) => sum + r.cost, 0);
  const totalEvents = rows.length;

  const periodStart = startDate ? formatDate(startDate) : (rows.length > 0 ? formatDate(rows[rows.length - 1].date) : '-');
  const periodEnd = endDate ? formatDate(endDate) : (rows.length > 0 ? formatDate(rows[0].date) : '-');

  const vehicleTitle = escapeHtml(vehicle.nickname);
  const vehicleSubtitle = escapeHtml(
    [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '),
  );
  const vinDisplay = vehicle.vin ? escapeHtml(vehicle.vin) : null;

  // Group events by year (events are sorted descending by date)
  const eventsByYear = new Map<string, EventRow[]>();
  for (const row of rows) {
    const year = row.date.substring(0, 4);
    const existing = eventsByYear.get(year);
    if (existing) {
      existing.push(row);
    } else {
      eventsByYear.set(year, [row]);
    }
  }

  const yearSections = Array.from(eventsByYear.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, events]) => {
      const tableRows = events
        .map((row) => {
          const desc = escapeHtml(buildDescription(row, serviceTypeMap.get(row.eventId)));
          const typeColor = getEventTypeColor(row.type);
          const typeLabel = getEventTypeLabel(row.type);
          const odometerStr = row.odometer != null
            ? `${row.odometer.toLocaleString()} ${row.odometerUnit === 'kilometers' ? 'km' : 'mi'}`
            : '-';
          const notesStr = row.notes ? escapeHtml(row.notes) : '';
          const placeStr = row.placeName ? escapeHtml(row.placeName) : '';

          return `
            <tr>
              <td>${formatDate(row.date)}</td>
              <td><span class="type-badge" style="background-color: ${typeColor};">${typeLabel}</span></td>
              <td>${desc}${placeStr ? `<br/><span class="place">${placeStr}</span>` : ''}</td>
              <td class="right">${odometerStr}</td>
              <td class="right">${formatCurrency(row.cost)}</td>
              <td class="notes">${notesStr}</td>
            </tr>`;
        })
        .join('\n');

      return `
        <h2>${year}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th class="right">Odometer</th>
              <th class="right">Cost</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>`;
    })
    .join('\n');

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #F5F5F7;
      color: #1A1A1A;
      padding: 40px;
      font-size: 12px;
      line-height: 1.5;
    }

    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #E5E7EB;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 16px;
      color: #6B7280;
      margin-bottom: 4px;
    }

    .vin {
      font-size: 12px;
      color: #9CA3AF;
      font-family: monospace;
    }

    .summary {
      display: flex;
      gap: 24px;
      margin-bottom: 32px;
      padding: 16px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
    }

    .summary-item {
      text-align: center;
      flex: 1;
    }

    .summary-label {
      font-size: 11px;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: #1A1A1A;
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1A1A1A;
      margin: 24px 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #E5E7EB;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      overflow: hidden;
    }

    thead tr {
      background: #F5F5F7;
    }

    th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #E5E7EB;
    }

    td {
      padding: 10px 12px;
      font-size: 12px;
      color: #1A1A1A;
      border-bottom: 1px solid #F5F5F7;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .right {
      text-align: right;
    }

    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .place {
      font-size: 10px;
      color: #9CA3AF;
    }

    .notes {
      max-width: 120px;
      font-size: 11px;
      color: #6B7280;
    }

    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 11px;
      color: #9CA3AF;
    }

    @media print {
      body {
        background: #FFFFFF;
        padding: 20px;
      }

      .summary {
        break-inside: avoid;
      }

      table {
        break-inside: auto;
      }

      tr {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${vehicleTitle}</h1>
    <p class="subtitle">${vehicleSubtitle}</p>
    ${vinDisplay ? `<p class="vin">VIN: ${vinDisplay}</p>` : ''}
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Total Events</div>
      <div class="summary-value">${totalEvents}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Spent</div>
      <div class="summary-value">${formatCurrency(totalSpent)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Period</div>
      <div class="summary-value" style="font-size: 14px;">${periodStart} &ndash; ${periodEnd}</div>
    </div>
  </div>

  ${yearSections || '<p style="text-align: center; color: #9CA3AF; padding: 40px 0;">No events found for the selected period.</p>'}

  <div class="footer">
    <p>Generated by AutoMate on ${generatedDate}</p>
  </div>
</body>
</html>`;
}

export async function generateServiceHistoryPDF(
  vehicleId: string,
  startDate?: string,
  endDate?: string,
): Promise<string> {
  const db = getDatabase();

  // Query vehicle details
  const vehicle = await db.getFirstAsync<VehicleRow>(
    `SELECT nickname, make, model, year, trim, vin, odometerUnit
     FROM vehicle WHERE id = ?`,
    [vehicleId],
  );

  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  // Build query conditions
  const conditions: string[] = ['e.vehicleId = ?'];
  const params: (string | number)[] = [vehicleId];

  if (startDate) {
    conditions.push('e.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('e.date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.join(' AND ');

  // Query events
  const rows = await db.getAllAsync<EventRow>(
    `SELECT e.id as eventId, e.date, e.type, e.odometer, v.odometerUnit, e.cost,
            e.volume, v.volumeUnit, e.pricePerUnit,
            p.name as placeName, c.name as categoryName, e.notes
     FROM event e
     JOIN vehicle v ON e.vehicleId = v.id
     LEFT JOIN place p ON e.placeId = p.id
     LEFT JOIN category c ON e.categoryId = c.id
     WHERE ${whereClause}
     ORDER BY e.date DESC, e.createdAt DESC`,
    params,
  );

  // Query service types for service events
  const serviceEventIds = rows.filter((r) => r.type === 'service').map((r) => r.eventId);
  const serviceTypeMap = new Map<string, string>();

  for (const eventId of serviceEventIds) {
    const serviceTypes = await db.getAllAsync<{ name: string }>(
      `SELECT st.name FROM event_service_type est
       JOIN service_type st ON est.serviceTypeId = st.id
       WHERE est.eventId = ?
       ORDER BY st.sortOrder`,
      [eventId],
    );
    serviceTypeMap.set(eventId, serviceTypes.map((s) => s.name).join(', '));
  }

  // Build HTML and generate PDF
  const html = buildHtml(vehicle, rows, serviceTypeMap, startDate, endDate);
  const { uri } = await printToFileAsync({ html });

  return uri;
}

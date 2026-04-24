interface VinDecodeResult {
  year?: number;
  make?: string;
  model?: string;
}

export async function decodeVin(vin: string): Promise<VinDecodeResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const results = data?.Results?.[0];
    if (!results) return null;

    const result: VinDecodeResult = {};

    if (results.ModelYear && results.ModelYear !== '0') {
      result.year = parseInt(results.ModelYear, 10);
    }
    if (results.Make && results.Make.trim()) {
      result.make = results.Make.trim();
    }
    if (results.Model && results.Model.trim()) {
      result.model = results.Model.trim();
    }

    return result;
  } catch {
    return null;
  }
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Insight, InsightEngineInput } from '../services/insightEngine';
import { generateInsights } from '../services/insightEngine';
import * as insightImpressions from '../db/queries/insightImpressions';
import type { InsightImpressionRow } from '../db/queries/insightImpressions';

const SHOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DISMISSED_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INSIGHTS = 3;

export interface DisplayedInsight extends Insight {
  impressionId: string | null;
}

export function useInsights(
  input: InsightEngineInput | null,
  vehicleId: string | null,
) {
  const [insights, setInsights] = useState<DisplayedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const recordedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!input || !vehicleId) {
      setInsights([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function evaluate() {
      setLoading(true);
      const allInsights = generateInsights(input!);
      const impressions = await insightImpressions.getLatestByVehicle(vehicleId!);

      const impressionMap = new Map<string, InsightImpressionRow>();
      for (const imp of impressions) {
        impressionMap.set(imp.insightType, imp);
      }

      const now = Date.now();
      const filtered = allInsights.filter((insight) => {
        const lastImpression = impressionMap.get(insight.type);
        if (!lastImpression) return true;

        if (lastImpression.dataHash === insight.dataKey) return false;

        const shownAt = new Date(lastImpression.shownAt).getTime();
        const cooldown = lastImpression.dismissedAt ? DISMISSED_COOLDOWN_MS : SHOWN_COOLDOWN_MS;
        return now - shownAt >= cooldown;
      });

      filtered.sort((a, b) => b.score - a.score);
      const top = filtered.slice(0, MAX_INSIGHTS);

      if (cancelled) return;
      setInsights(top.map((i) => ({ ...i, impressionId: null })));
      setLoading(false);

      // Record impressions for displayed insights
      for (const insight of top) {
        const key = `${vehicleId}:${insight.type}:${insight.dataKey}`;
        if (recordedRef.current.has(key)) continue;
        recordedRef.current.add(key);
        const id = await insightImpressions.recordImpression(vehicleId!, insight.type, insight.dataKey);
        if (!cancelled) {
          setInsights((prev) =>
            prev.map((i) => (i.type === insight.type && i.dataKey === insight.dataKey ? { ...i, impressionId: id } : i))
          );
        }
      }
    }

    evaluate();

    return () => {
      cancelled = true;
    };
  }, [input, vehicleId]);

  const dismiss = useCallback(async (impressionId: string, insightType: string) => {
    await insightImpressions.markDismissed(impressionId);
    setInsights((prev) => prev.filter((i) => i.type !== insightType));
  }, []);

  return { insights, loading, dismiss };
}

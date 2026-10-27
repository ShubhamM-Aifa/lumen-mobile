/**
 * Runs trigger watch on Today: looks at what the patient logged in the last day, matches it against
 * the patterns found in their own history, and hands any new observation to the notification budget.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { useInsights } from './useInsights';
import { useIntelligenceStore } from '../store/intelligenceStore';
import { buildTriggerWatchCandidates, WatchedEntry, WATCH_LOOKBACK_MS } from '../services/intelligence/triggerWatch';

export const WATCH_SEEN_KEY = 'lumen:intel:watch_seen_v1';
const MAX_SEEN = 200;

/** Kept in memory too, so two quick runs cannot both announce the same entry before the save lands. */
const memorySeen = new Set<string>();
let running = false;

export async function loadSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_SEEN_KEY);
    const saved: string[] = raw ? JSON.parse(raw) : [];
    saved.forEach(id => memorySeen.add(id));
  } catch {
    // an unreadable list just means we might repeat one observation
  }
  return new Set(memorySeen);
}

async function remember(ids: string[]): Promise<void> {
  ids.forEach(id => memorySeen.add(id));
  const all = Array.from(memorySeen).slice(-MAX_SEEN);
  try {
    await AsyncStorage.setItem(WATCH_SEEN_KEY, JSON.stringify(all));
  } catch {
    // best effort
  }
}

export function resetTriggerWatchMemory(): void {
  memorySeen.clear();
  running = false;
}

export function useTriggerWatch(): void {
  const policyLoaded = useIntelligenceStore(s => s.loaded);
  const { data: insightData } = useInsights();
  const { data: entries, refetch } = useQuery<WatchedEntry[]>({
    // 'day-entries' is invalidated by every place that saves a log, so a new entry re-runs this
    queryKey: ['day-entries', 'trigger-watch'],
    queryFn: async () => {
      const from = new Date(Date.now() - WATCH_LOOKBACK_MS).toISOString();
      const rows = await api.get<WatchedEntry[]>('/logs', { params: { from, limit: 100 } });
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 60 * 1000,
  });

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  useEffect(() => {
    const findings = insightData?.findings ?? [];
    if (!policyLoaded || running || findings.length === 0 || !entries || entries.length === 0) return;
    running = true;
    (async () => {
      try {
        const seen = await loadSeen();
        const candidates = buildTriggerWatchCandidates({ findings, entries, now: Date.now(), seen });
        if (candidates.length === 0) return;
        await remember(candidates.flatMap(c => [c.id, c.data?.patternKey].filter((k): k is string => typeof k === 'string')));
        await useIntelligenceStore.getState().submit(candidates);
      } catch {
        // observation is best effort; it never blocks Today
      } finally {
        running = false;
      }
    })();
  }, [policyLoaded, insightData, entries]);
}

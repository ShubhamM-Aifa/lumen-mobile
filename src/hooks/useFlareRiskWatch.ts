/**
 * Runs the early-warning candidate on Today: once the server has a fresh alert, hand it to the
 * notification budget exactly once per result (a new `computedAt` means a new result to announce).
 */
import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useWarning } from './useWarning';
import { useIntelligenceStore } from '../store/intelligenceStore';
import { buildFlareRiskCandidate } from '../services/intelligence/flareRiskWatch';

export const FLARE_RISK_SEEN_KEY = 'lumen:intel:flare_risk_seen_v1';
const MAX_SEEN = 20;

let memorySeen = new Set<string>();
let running = false;

export async function loadFlareRiskSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FLARE_RISK_SEEN_KEY);
    const saved: string[] = raw ? JSON.parse(raw) : [];
    saved.forEach(id => memorySeen.add(id));
  } catch {
    // worst case we repeat one announcement
  }
  return new Set(memorySeen);
}

async function remember(id: string): Promise<void> {
  memorySeen.add(id);
  const all = Array.from(memorySeen).slice(-MAX_SEEN);
  try { await AsyncStorage.setItem(FLARE_RISK_SEEN_KEY, JSON.stringify(all)); } catch {}
}

export function resetFlareRiskWatchMemory(): void {
  memorySeen = new Set();
  running = false;
}

export function useFlareRiskWatch(): void {
  const policyLoaded = useIntelligenceStore(s => s.loaded);
  const { data: warning, refetch } = useWarning();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  useEffect(() => {
    if (!policyLoaded || running || !warning?.ready) return;
    running = true;
    (async () => {
      try {
        const seen = await loadFlareRiskSeen();
        const candidates = buildFlareRiskCandidate({ warning, now: Date.now(), seen });
        if (candidates.length === 0) return;
        const computedAt = candidates[0].data?.computedAt as string | undefined;
        if (computedAt) await remember(computedAt);
        await useIntelligenceStore.getState().submit(candidates);
      } catch {
        // best effort; it never blocks Today
      } finally {
        running = false;
      }
    })();
  }, [policyLoaded, warning]);
}

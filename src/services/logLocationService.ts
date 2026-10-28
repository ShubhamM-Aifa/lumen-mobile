/**
 * Fast, non-blocking Background Location Engine for health logging.
 * - Captures coordinates & human-friendly place name for Quick Taps, Quick Logs, Check-Ins, etc.
 * - 0ms blocking: Uses in-memory cache (<5 min TTL) and last-known GPS hardware position.
 * - Graceful fallback: If GPS or permissions are unavailable, fails silently without breaking log creation.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ILogLocation } from '@lumen/shared';

const TAG_LOCATION_SETTING_KEY = '@lumen:settings:tag_location_enabled';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

interface CachedLocation {
  data: ILogLocation;
  timestamp: number;
}

let inMemoryLocationCache: CachedLocation | null = null;
let isResolvingBackgroundGps = false;

class LogLocationService {
  /**
   * Check whether the user has location tagging enabled in settings.
   */
  async isLocationTaggingEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(TAG_LOCATION_SETTING_KEY);
      if (val === null) return true; // Default enabled
      return val === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Toggle location tagging preference.
   */
  async setLocationTaggingEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(TAG_LOCATION_SETTING_KEY, enabled ? 'true' : 'false');
      if (!enabled) {
        inMemoryLocationCache = null;
      }
    } catch (e) {
      console.warn('[LogLocationService] Failed to save setting:', e);
    }
  }

  /**
   * Resolves reverse geocoding for coordinates to a human-readable place.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<{
    name?: string;
    city?: string;
    region?: string;
    country?: string;
    formattedAddress?: string;
  }> {
    if (Platform.OS === 'web') {
      return {};
    }
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const first = results[0];
        const nameCandidate = first.name && !first.name.match(/^\d+$/) ? first.name : undefined;
        const cityCandidate = first.city || first.subregion || first.district || undefined;
        const regionCandidate = first.region || undefined;
        const countryCandidate = first.country || undefined;

        const parts: string[] = [];
        if (nameCandidate && nameCandidate !== cityCandidate) parts.push(nameCandidate);
        if (cityCandidate) parts.push(cityCandidate);
        if (regionCandidate) parts.push(regionCandidate);

        return {
          name: nameCandidate,
          city: cityCandidate,
          region: regionCandidate,
          country: countryCandidate,
          formattedAddress: parts.join(', ') || undefined,
        };
      }
    } catch (e) {
      // Non-critical
    }

    return {};
  }

  /**
   * Fast, non-blocking snapshot for immediate attachment to logs.
   * Completes in < 20ms by utilizing in-memory cache or native last-known position.
   */
  async getFastLocationSnapshot(): Promise<ILogLocation | null> {
    try {
      const enabled = await this.isLocationTaggingEnabled();
      if (!enabled) return null;

      const now = Date.now();
      if (inMemoryLocationCache && (now - inMemoryLocationCache.timestamp < CACHE_TTL_MS)) {
        return inMemoryLocationCache.data;
      }

      // Check permission without blocking with prompts
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm || perm.status !== 'granted') return null;

      // 1. Try instant last known location
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        const { latitude, longitude, accuracy } = lastKnown.coords;
        const snapshot: ILogLocation = {
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: accuracy ? Number(accuracy.toFixed(1)) : undefined,
          city: inMemoryLocationCache?.data?.city,
          region: inMemoryLocationCache?.data?.region,
          formattedAddress: inMemoryLocationCache?.data?.formattedAddress,
        };

        // Cache immediately
        inMemoryLocationCache = { data: snapshot, timestamp: now };

        // Enrich reverse geocode in background
        this.enrichReverseGeocodeInBackground(snapshot);

        return snapshot;
      }

      // Trigger background update if none cached
      this.refreshLocationCacheInBackground();
      return inMemoryLocationCache ? inMemoryLocationCache.data : null;
    } catch (err) {
      console.warn('[LogLocationService] getFastLocationSnapshot error:', err);
      return null;
    }
  }

  /**
   * Refreshes the location cache asynchronously without blocking any caller.
   */
  async refreshLocationCacheInBackground(): Promise<void> {
    if (isResolvingBackgroundGps) return;
    isResolvingBackgroundGps = true;

    try {
      const enabled = await this.isLocationTaggingEnabled();
      if (!enabled) {
        isResolvingBackgroundGps = false;
        return;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm || perm.status !== 'granted') {
        isResolvingBackgroundGps = false;
        return;
      }

      const freshLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (freshLoc?.coords) {
        const { latitude, longitude, accuracy } = freshLoc.coords;
        const geo = await this.reverseGeocode(latitude, longitude);

        const newLoc: ILogLocation = {
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: accuracy ? Number(accuracy.toFixed(1)) : undefined,
          name: geo.name,
          city: geo.city,
          region: geo.region,
          country: geo.country,
          formattedAddress: geo.formattedAddress,
        };

        inMemoryLocationCache = {
          data: newLoc,
          timestamp: Date.now(),
        };
      }
    } catch {
      // Ignored
    } finally {
      isResolvingBackgroundGps = false;
    }
  }

  private async enrichReverseGeocodeInBackground(loc: ILogLocation): Promise<void> {
    try {
      const geo = await this.reverseGeocode(loc.latitude, loc.longitude);
      const enriched: ILogLocation = {
        ...loc,
        name: geo.name,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        formattedAddress: geo.formattedAddress,
      };
      inMemoryLocationCache = {
        data: enriched,
        timestamp: Date.now(),
      };
    } catch {}
  }
}

export const logLocationService = new LogLocationService();
export default logLocationService;

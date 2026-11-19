import { api } from '../api/client';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  WeatherData,
  FlareTriggerAssessment,
  weatherService,
  assessAutoimmuneFlareTriggers,
} from '../services/weatherService';
import { sendWeatherFlareNotification } from '../services/notifications';

const CACHE_KEY = 'lumen:weather_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache to preserve battery and network
const NOTIF_THROTTLE_MS = 3 * 60 * 60 * 1000; // 3 hours cooldown for repeat flare notifications

export interface FlareNotificationAlert {
  id: string;
  title: string;
  message: string;
  riskLevel: 'moderate' | 'high';
  pressureHpa: number;
  uvIndex: number;
  cityName: string;
  timestamp: number;
  dismissed: boolean;
}

interface WeatherCacheData {
  weather: WeatherData;
  assessment: FlareTriggerAssessment;
  timestamp: number;
  activeFlareAlert?: FlareNotificationAlert | null;
}

interface WeatherStoreState {
  weather: WeatherData | null;
  assessment: FlareTriggerAssessment | null;
  activeFlareAlert: FlareNotificationAlert | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  lastFetched: number | null;

  // Actions
  initWeather: () => Promise<void>;
  fetchWeather: (options?: { force?: boolean; isUserRefresh?: boolean }) => Promise<void>;
  requestPermissionAndFetch: () => Promise<boolean>;
  dismissFlareAlert: () => void;
  clearCache: () => Promise<void>;
}

export const useWeatherStore = create<WeatherStoreState>((set, get) => ({
  weather: null,
  assessment: null,
  activeFlareAlert: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  permissionStatus: 'undetermined',
  lastFetched: null,

  initWeather: async () => {
    // 1. Try reading from AsyncStorage cache first for instant UI response
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: WeatherCacheData = JSON.parse(cached);
        const isStalePlaceholder =
          !parsed?.weather?.cityName ||
          parsed.weather.cityName === 'Your Location' ||
          parsed.weather.cityName === 'Your City';

        if (parsed?.weather && parsed?.assessment && !isStalePlaceholder) {
          set({
            weather: parsed.weather,
            assessment: parsed.assessment,
            activeFlareAlert: parsed.activeFlareAlert ?? null,
            lastFetched: parsed.timestamp,
            permissionStatus: 'granted',
          });

          // If cached data is still fresh (within 30 mins), don't hit GPS/network
          const age = Date.now() - (parsed.timestamp || 0);
          if (age < CACHE_TTL_MS) {
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[WeatherStore] Failed to load cache:', e);
    }

    // 2. Refresh weather if cache is expired, missing, or was a placeholder
    await get().fetchWeather({ force: true });
  },

  requestPermissionAndFetch: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        set({ permissionStatus: 'granted', error: null });
        await get().fetchWeather({ force: true });
        return true;
      } else {
        set({
          permissionStatus: 'denied',
          error: 'Location access is required to fetch local weather & atmospheric flare alerts.',
        });
        return false;
      }
    } catch (err: any) {
      set({
        permissionStatus: 'denied',
        error: err?.message || 'Failed to request location permission.',
      });
      return false;
    }
  },

  dismissFlareAlert: () => {
    const current = get().activeFlareAlert;
    if (current) {
      set({ activeFlareAlert: { ...current, dismissed: true } });
    }
  },

  fetchWeather: async (options = {}) => {
    const { force = false, isUserRefresh = false } = options;
    const state = get();

    // Check TTL if not forced
    if (!force && state.weather && state.lastFetched) {
      const age = Date.now() - state.lastFetched;
      if (age < CACHE_TTL_MS) {
        return;
      }
    }

    if (state.isLoading) return;

    if (isUserRefresh) {
      set({ isRefreshing: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      // 1. Check or request location permissions
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        set({
          permissionStatus: 'denied',
          isLoading: false,
          isRefreshing: false,
          error: 'Enable location permission to see weather and flare trigger reports.',
        });
        return;
      }

      set({ permissionStatus: 'granted' });

      // 2. Fetch current coordinates
      let location: Location.LocationObject | null = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (locErr) {
        console.warn('[WeatherStore] getCurrentPosition failed, falling back to last known:', locErr);
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location?.coords) {
        throw new Error('Unable to determine device location. Please ensure GPS is turned on.');
      }

      const { latitude, longitude } = location.coords;
      // Daily weather for Insights › Explore is kept on the server for a rounded (~1 km) location.
      // The server only refetches when the place changed or every few hours.
      api.put('/weather/location', { lat: Math.round(latitude * 100) / 100, lon: Math.round(longitude * 100) / 100 }).catch(() => {});

      // 3. Reverse geocode to get city and area name
      const { city, region } = await weatherService.reverseGeocode(latitude, longitude);

      // 4. Fetch live weather & forecast from Open-Meteo
      const weatherData = await weatherService.fetchForecast(latitude, longitude, city, region);
      const assessment = assessAutoimmuneFlareTriggers(weatherData);

      const now = Date.now();

      // 5. Build flare notification alert if risk is elevated
      let activeFlareAlert: FlareNotificationAlert | null = null;
      if (assessment.overallRisk === 'high' || assessment.overallRisk === 'moderate') {
        const alertTitle = assessment.overallRisk === 'high'
          ? 'High Flare Trigger Potential'
          : 'Moderate Environmental Sensitivity';
        const alertMessage = `${assessment.actionableTip} (${weatherData.cityName}: ${weatherData.temperatureC}°C, ${weatherData.pressureHpa} hPa)`;

        activeFlareAlert = {
          id: `weather-flare-${now}`,
          title: alertTitle,
          message: alertMessage,
          riskLevel: assessment.overallRisk,
          pressureHpa: weatherData.pressureHpa,
          uvIndex: weatherData.uvIndexMax,
          cityName: weatherData.cityName,
          timestamp: now,
          dismissed: false,
        };

        // Check throttle and dispatch native notification
        try {
          const lastNotifRaw = await AsyncStorage.getItem('lumen:weather:last_notif');
          let shouldSendNotif = true;
          if (lastNotifRaw) {
            const parsedNotif = JSON.parse(lastNotifRaw);
            const age = now - (parsedNotif.timestamp || 0);
            if (age < NOTIF_THROTTLE_MS && !(assessment.overallRisk === 'high' && parsedNotif.riskLevel === 'moderate')) {
              shouldSendNotif = false;
            }
          }

          if (shouldSendNotif) {
            await sendWeatherFlareNotification(
              `⚠️ ${alertTitle}`,
              alertMessage,
              assessment.overallRisk
            );
            await AsyncStorage.setItem('lumen:weather:last_notif', JSON.stringify({
              timestamp: now,
              riskLevel: assessment.overallRisk,
            })).catch(() => {});
          }
        } catch (notifErr) {
          console.warn('[WeatherStore] Notification dispatch error:', notifErr);
        }
      }

      // 6. Cache to local storage
      const cachePayload: WeatherCacheData = {
        weather: weatherData,
        assessment,
        timestamp: now,
        activeFlareAlert,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload)).catch(() => {});

      // 7. Update state
      set({
        weather: weatherData,
        assessment,
        activeFlareAlert,
        lastFetched: now,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
    } catch (err: any) {
      console.warn('[WeatherStore] fetchWeather error:', err);
      set({
        isLoading: false,
        isRefreshing: false,
        error: err?.message || 'Failed to update weather information.',
      });
    }
  },

  clearCache: async () => {
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    set({ weather: null, assessment: null, activeFlareAlert: null, lastFetched: null });
  },
}));

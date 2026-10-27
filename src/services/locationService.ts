/**
 * Location and Pedometer service for Walking & Activity Tracking.
 * - Session-bound GPS: Location hardware is active ONLY during an active session.
 * - Accurate Haversine distance accumulation between consecutive waypoints.
 * - Outlier rejection: Rejects points with poor accuracy (>25m) or impossible walking speed (>15 km/h).
 * - Step counting via hardware Pedometer.
 */
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { IActivityPoint } from '@lumen/shared';

export interface LocationUpdateCallback {
  (point: IActivityPoint, totalDistanceMeters: number, currentSpeedKmh: number): void;
}

export interface StepUpdateCallback {
  (steps: number): void;
}

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private pedometerSubscription: { remove: () => void } | null = null;
  
  private lastAcceptedPoint: IActivityPoint | null = null;
  private accumulatedDistanceMeters: number = 0;
  private initialPedometerStepCount: number = 0;
  private currentStepCount: number = 0;

  /**
   * Request permissions with clear rationale.
   */
  async requestPermissions(): Promise<{ location: boolean; pedometer: boolean }> {
    let locationGranted = false;
    let pedometerGranted = false;

    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      // Walks are tracked while the walk screen is open; "Always" location is not needed.
      locationGranted = fgStatus === 'granted';
    } catch (e) {
      console.warn('[LocationService] Location permission error:', e);
    }

    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        const { status } = await Pedometer.requestPermissionsAsync();
        pedometerGranted = status === 'granted';
      }
    } catch (e) {
      console.warn('[LocationService] Pedometer permission error:', e);
    }

    return { location: locationGranted, pedometer: pedometerGranted };
  }

  /**
   * Starts tracking GPS and pedometer steps for an active walking session.
   */
  async startTracking(
    onLocationUpdate: LocationUpdateCallback,
    onStepUpdate?: StepUpdateCallback
  ): Promise<boolean> {
    await this.stopTracking(); // Ensure previous subscriptions cleared

    this.lastAcceptedPoint = null;
    this.accumulatedDistanceMeters = 0;
    this.currentStepCount = 0;

    const { location } = await this.requestPermissions();
    if (!location) {
      console.warn('[LocationService] Foreground location permission denied.');
      return false;
    }

    // Subscribe to GPS updates
    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000,   // every 3 seconds
          distanceInterval: 4,  // every 4 meters
        },
        (loc) => {
          const { latitude, longitude, altitude, accuracy, speed } = loc.coords;
          const timestamp = loc.timestamp;

          // 1. Accuracy filter: Ignore if accuracy radius is worse than 25 meters
          if (accuracy && accuracy > 25) {
            return;
          }

          const currentPoint: IActivityPoint = {
            latitude,
            longitude,
            altitude: altitude ?? undefined,
            accuracy: accuracy ?? undefined,
            speed: speed ?? undefined,
            timestamp,
          };

          let segmentDistance = 0;
          let calculatedSpeedKmh = speed && speed > 0 ? speed * 3.6 : 0;

          if (this.lastAcceptedPoint) {
            const timeDiffSec = (timestamp - this.lastAcceptedPoint.timestamp) / 1000;
            segmentDistance = calculateHaversineDistance(
              this.lastAcceptedPoint.latitude,
              this.lastAcceptedPoint.longitude,
              latitude,
              longitude
            );

            // 2. Velocity spike outlier filter: Walking speed cannot exceed 15 km/h (4.16 m/s)
            if (timeDiffSec > 0) {
              const instantaneousSpeedKmh = (segmentDistance / timeDiffSec) * 3.6;
              if (instantaneousSpeedKmh > 15) {
                // Outlier GPS jump — discard point
                return;
              }
              if (!calculatedSpeedKmh || calculatedSpeedKmh <= 0) {
                calculatedSpeedKmh = instantaneousSpeedKmh;
              }
            }

            this.accumulatedDistanceMeters += segmentDistance;
          }

          this.lastAcceptedPoint = currentPoint;
          onLocationUpdate(currentPoint, this.accumulatedDistanceMeters, calculatedSpeedKmh);
        }
      );
    } catch (err) {
      console.error('[LocationService] Failed to watch position:', err);
      return false;
    }

    // Subscribe to hardware pedometer if available
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        this.pedometerSubscription = Pedometer.watchStepCount((result) => {
          this.currentStepCount = result.steps;
          onStepUpdate?.(this.currentStepCount);
        });
      }
    } catch (err) {
      console.warn('[LocationService] Pedometer subscription failed:', err);
    }

    return true;
  }

  /**
   * Pauses sensor polling to preserve battery while walk is paused.
   */
  async pauseTracking(): Promise<void> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  /**
   * Resumes GPS and Pedometer.
   */
  async resumeTracking(
    onLocationUpdate: LocationUpdateCallback,
    onStepUpdate?: StepUpdateCallback
  ): Promise<boolean> {
    return this.startTracking(onLocationUpdate, onStepUpdate);
  }

  /**
   * Stops tracking completely and frees hardware resources.
   */
  async stopTracking(): Promise<{ distanceMeters: number; steps: number }> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.pedometerSubscription) {
      this.pedometerSubscription.remove();
      this.pedometerSubscription = null;
    }

    const result = {
      distanceMeters: Math.round(this.accumulatedDistanceMeters),
      steps: this.currentStepCount,
    };

    this.lastAcceptedPoint = null;
    this.accumulatedDistanceMeters = 0;
    this.currentStepCount = 0;

    return result;
  }
}

export const locationService = new LocationService();
export default locationService;

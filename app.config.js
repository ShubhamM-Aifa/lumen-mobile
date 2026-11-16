// app.config.js — Expo dynamic config
const fs = require('fs');
const path = require('path');

// Firebase config for push (Lumen AI notifications). From an EAS file secret (GOOGLE_SERVICES_JSON)
// or ./google-services.json; without it the build still works, just without push.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
  || (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
  ...config,
  name: 'Lumen',
  slug: 'lumen',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFF8F0',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.lumen.health',
    infoPlist: {
      NSCameraUsageDescription: 'Lumen uses the camera to capture photos of symptoms or body output for tracking purposes.',
      NSPhotoLibraryUsageDescription: 'Lumen accesses your photo library to attach images to log entries.',
      NSFaceIDUsageDescription: 'Lumen uses Face ID to protect your health data.',
      NSLocationWhenInUseUsageDescription: 'Lumen uses your location to provide hyper-local weather reports and assess autoimmune flare triggers like barometric pressure and UV levels.',
      NSMotionUsageDescription: 'Lumen reads the steps your iPhone already counts to show your daily steps and, if you turn it on, to find your walks automatically.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFF8F0',
    },
    package: 'com.lumen.health',
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: [
      'CAMERA',
      'READ_MEDIA_IMAGES',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'SCHEDULE_EXACT_ALARM',
      'USE_FULL_SCREEN_INTENT',
      'WAKE_LOCK',
      'SYSTEM_ALERT_WINDOW',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACTIVITY_RECOGNITION',
      'FOREGROUND_SERVICE',
      // Health Connect: steps for automatic walks, read in the background too
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND',
    ],
    // Not used: walks are tracked while the walk screen is open, and steps come from Health Connect
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.FOREGROUND_SERVICE_LOCATION'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    '@react-native-google-signin/google-signin',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#FF6B35',
        sounds: [],
        androidMode: 'default',
        androidCollapsedTitle: 'Lumen Reminder',
        iosDisplayInForeground: true,
      },
    ],
    'react-native-health-connect',
    'expo-background-task',
    // Native clock-style alarms (full-screen over the lock screen, alarm-volume ringing)
    './plugins/withLumenAlarm',
    // Lumen AI voice chat: on-device listening (adds RECORD_AUDIO + Google recognizer visibility)
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Lumen uses the microphone so you can talk to Lumen AI.',
        speechRecognitionPermission: 'Lumen turns your speech into text for Lumen AI.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox', 'com.google.android.as'],
      },
    ],
    [
      'expo-build-properties',
      {
        // Health Connect needs Android 8 (API 26) or newer
        android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 },
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Lumen uses Face ID to protect your health data.',
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'TodayGlanceWidget',
            label: 'Today',
            description: 'Live progress for daily goals, water, stand, meds, and flare',
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            widgetCategory: 'home_screen|keyguard',
            updatePeriodMillis: 1800000,
            previewImage: './assets/widgets/todayglancewidget_preview.png',
          },
          {
            name: 'NextReminderWidget',
            label: 'Next Reminder',
            description: 'Shows your next scheduled health reminder and time',
            minWidth: '140dp',
            minHeight: '110dp',
            targetCellWidth: 2,
            targetCellHeight: 2,
            widgetCategory: 'home_screen|keyguard',
            updatePeriodMillis: 1800000,
            previewImage: './assets/widgets/nextreminderwidget_preview.png',
          },
          {
            name: 'WaterGoalWidget',
            label: 'Water',
            description: 'Daily water intake progress bar',
            minWidth: '140dp',
            minHeight: '110dp',
            targetCellWidth: 2,
            targetCellHeight: 2,
            widgetCategory: 'home_screen|keyguard',
            updatePeriodMillis: 1800000,
            previewImage: './assets/widgets/watergoalwidget_preview.png',
          },
          {
            name: 'QuickTapWidget',
            label: 'Quick Log',
            description: 'One-tap water logging and quick health tracker',
            minWidth: '140dp',
            minHeight: '110dp',
            targetCellWidth: 2,
            targetCellHeight: 2,
            widgetCategory: 'home_screen|keyguard',
            updatePeriodMillis: 1800000,
            previewImage: './assets/widgets/quicktapwidget_preview.png',
          },
          {
            name: 'MyDayWidget',
            label: 'My Day',
            description: "View and complete today's tasks and to-dos",
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            maxResizeWidth: '500dp',
            maxResizeHeight: '400dp',
            resizeMode: 'horizontal|vertical',
            widgetCategory: 'home_screen|keyguard',
            updatePeriodMillis: 1800000,
            previewImage: './assets/widgets/mydaywidget_preview.png',
          },
        ],
      },
    ],
  ],
  scheme: 'lumen',
  extra: {
    apiUrl:                process.env.EXPO_PUBLIC_API_URL                 ?? 'http://localhost:3000/api/v1',
    googleWebClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID    ?? '',
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    googleIosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    ?? '',
    eas: { projectId: '08e8f5ec-be22-413f-9bdb-348811301173' },
  },
});

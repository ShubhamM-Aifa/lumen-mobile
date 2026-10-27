/**
 * User Profile & Settings Screen
 * ─ User Profile Hero Card (Avatar, Name, Email, Account Type, Edit Name Modal)
 * ─ Health Conditions & Diagnoses Manager (Quick tags + Custom condition builder)
 * ─ App Preferences & Units (Metric/Imperial, °C/°F, Day Boundary Hour, Theme)
 * ─ Security (Biometric App Lock with expo-local-authentication)
 * ─ Health Data & Configuration Management (Export Reports, Export/Import Setup)
 * ─ Multi-layered Logout Flow (API logout, Token wipe, Cross-store reset, Login redirect)
 * ─ Danger Zone (Permanent account & health record deletion)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import { ScreenTopBar } from '../src/components/ios/ScreenTopBar';
import { InsetGroup, GroupedRow } from '../src/components/ios/InsetGroup';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSecurityStore } from '../src/store/securityStore';
import {
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Mail,
  Shield,
  Moon,
  Sun,
  SunMoon,
  Globe,
  Thermometer,
  Clock,
  LogOut,
  Trash2,
  Check,
  Edit2,
  Plus,
  X,
  Sparkles,
  Lock,
  KeyRound,
  Heart,
  Ruler,
  Scale,
  Calendar,
  MapPin,
  Users,
  ArrowRightLeft,
  UserPlus,
  Cake,
  FlaskConical,
  Bell,
  ScanFace,
  FileText,
  Archive,
  Target,
  Minus,
} from 'lucide-react-native';

import { useTheme } from '../src/theme/ThemeContext';
import { useAuthStore } from '../src/store/authStore';
import { useQuickLogStore } from '../src/store/quickLogStore';
import { useActivityStore } from '../src/store/activityStore';
import { useAutoWalkStore } from '../src/store/autoWalkStore';
import { usePhotoVaultStore } from '../src/store/photoVaultStore';
import { logLocationService } from '../src/services/logLocationService';
import { useGoogleAuth } from '../src/hooks/useGoogleAuth';
import { AccountSwitcherModal } from '../src/components/auth/AccountSwitcherModal';
import { api } from '../src/api/client';
import { buttonProps } from '../src/utils/accessibility';
import { typography } from '../src/theme/typography';
import { ThemeTokens } from '../src/theme/tokens';
import { LumenLogo } from '../src/components/common/LumenLogo';
import { DayClockCard } from '../src/components/DayClockCard';
import { AutoWalkSettingsGroup } from '../src/components/settings/AutoWalkSettingsGroup';
import {
  useSleepTrackerStore,
  formatGoalHours,
  goalRangeLabel,
  SLEEP_GOAL_MIN_MINUTES,
  SLEEP_GOAL_MAX_MINUTES,
  SLEEP_GOAL_STEP_MINUTES,
} from '../src/store/sleepTrackerStore';
import { ModularAvatar } from '../src/components/avatar/ModularAvatar';
import { AvatarStudioModal } from '../src/components/avatar/AvatarStudioModal';

type ThemePref = 'system' | 'light' | 'dark';

const THEME_OPTIONS: {
  key: ThemePref;
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}[] = [
  { key: 'system', label: 'System', icon: SunMoon },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

const UNIT_OPTIONS: { key: 'metric' | 'imperial'; label: string; desc: string }[] = [
  { key: 'metric', label: 'Metric', desc: 'km, kg, ml' },
  { key: 'imperial', label: 'Imperial', desc: 'mi, lb, oz' },
];

const TEMP_OPTIONS: { key: 'C' | 'F'; label: string }[] = [
  { key: 'C', label: '°C (Celsius)' },
  { key: 'F', label: '°F (Fahrenheit)' },
];

const DAY_BOUNDARY_OPTIONS: { hour: number; label: string }[] = [
  { hour: 0, label: '12 AM' },
  { hour: 2, label: '2 AM' },
  { hour: 4, label: '4 AM' },
  { hour: 6, label: '6 AM' },
];

const COMMON_CONDITIONS = [
  'Lupus (SLE)',
  'Rheumatoid Arthritis',
  'Crohn’s Disease',
  'Ulcerative Colitis',
  'Psoriasis',
  'Fibromyalgia',
  'Long COVID',
  'Chronic Fatigue (ME/CFS)',
  'Migraine',
  'Asthma',
  'POTS',
  'Endometriosis',
  'Eczema',
  'IBS',
];

const GENDER_OPTIONS: { key: 'male' | 'female' | 'non-binary' | 'other' | 'prefer_not_to_say'; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non-binary', label: 'Non-Binary' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const APP_LOCK_KEY = 'lumen:security:app_lock';

/** iOS system colours for the icon tiles in the settings list. */
const TILE = {
  blue: '#007AFF',
  indigo: '#5856D6',
  pink: '#FF2D55',
  orange: '#FF9500',
  red: '#FF3B30',
  green: '#34C759',
  gray: '#8E8E93',
};

/** Sub-screens of Settings, opened as /settings?section=<key>. */
const SECTION_TITLES: Record<string, string> = {
  sleep: 'Sleep & Recovery',
  sleepgoal: 'Sleep Goal',
  vitals: 'Personal Vitals',
  conditions: 'Conditions & Health Focus',
  units: 'Units & Day Reset',
  appearance: 'Appearance',
  security: 'Security & Credentials',
};

export default function SettingsScreen() {
  const { palette, preference, setPreference } = useTheme();
  const {
    user,
    savedAccounts,
    updateProfile,
    setPassword,
    logout,
    fetchProfile,
    isLoading,
    deleteAccountAndData,
    purgeAllLocalData,
  } = useAuthStore();

  const { section } = useLocalSearchParams<{ section?: string }>();
  const sleepGoalMinutes = useSleepTrackerStore(st => st.targetGoalMinutes);
  const sleepGoalLoaded = useSleepTrackerStore(st => st.isLoaded);
  const loadSleepState = useSleepTrackerStore(st => st.loadState);
  const setSleepGoal = useSleepTrackerStore(st => st.setTargetGoalMinutes);
  useEffect(() => {
    if (!sleepGoalLoaded) loadSleepState();
  }, [sleepGoalLoaded, loadSleepState]);
  const sectionTitle = section ? SECTION_TITLES[section] : undefined;
  const openSection = (key: string) => router.push({ pathname: '/settings', params: { section: key } });

  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [avatarStudioVisible, setAvatarStudioVisible] = useState(false);

  const isPrimaryUser = user?.authMethod === 'google';

  const { signInWithGoogle, googleReady, isLoading: googleAuthLoading } = useGoogleAuth();

  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Account Deletion State
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Profile Edit Modal state
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Account Password Modal state
  const [setPasswordVisible, setSetPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match. Please verify and try again.');
      return;
    }
    setIsSavingPassword(true);
    try {
      await setPassword(newPassword);
      Alert.alert('Password Saved', 'Your account password has been updated. You can now also sign in with email and this password.');
      setSetPasswordVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Failed to update account password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Sensitive Photo PIN Modal state
  const [photoPinModalVisible, setPhotoPinModalVisible] = useState(false);
  const [newPhotoPin, setNewPhotoPin] = useState('');
  const [confirmPhotoPin, setConfirmPhotoPin] = useState('');
  const [isSavingPhotoPin, setIsSavingPhotoPin] = useState(false);

  const handleSavePhotoPin = async () => {
    if (!/^\d{4}$/.test(newPhotoPin)) {
      Alert.alert('Invalid PIN', 'Photo PIN must be exactly 4 numeric digits.');
      return;
    }
    if (newPhotoPin !== confirmPhotoPin) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
      return;
    }
    setIsSavingPhotoPin(true);
    try {
      await usePhotoVaultStore.getState().setPhotoPin(newPhotoPin);
      Alert.alert('Photo PIN Saved', 'Your 4-digit Sensitive Photo PIN is now active. Private photos in your logs and timeline will require this PIN or biometrics to view.');
      setPhotoPinModalVisible(false);
      setNewPhotoPin('');
      setConfirmPhotoPin('');
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Failed to update photo PIN');
    } finally {
      setIsSavingPhotoPin(false);
    }
  };

  // Condition Manager state
  const [addConditionVisible, setAddConditionVisible] = useState(false);
  const [customCondition, setCustomCondition] = useState('');
  const [isUpdatingConditions, setIsUpdatingConditions] = useState(false);

  // Personal Vitals & Demographics state
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [weight, setWeight] = useState(user?.weight != null ? String(user.weight) : '');
  const [gender, setGender] = useState<string>(user?.gender || '');
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [vitalsSaved, setVitalsSaved] = useState(false);

  // Security state from securityStore
  const isAppLockEnabled = useSecurityStore(s => s.isAppLockEnabled);
  const toggleAppLock = useSecurityStore(s => s.toggleAppLock);
  const biometricType = useSecurityStore(s => s.biometricType);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isLocationTaggingEnabled, setIsLocationTaggingEnabled] = useState(true);

  useEffect(() => {
    logLocationService.isLocationTaggingEnabled().then(setIsLocationTaggingEnabled);
  }, []);

  const handleToggleLocationTagging = async (val: boolean) => {
    Haptics.selectionAsync();
    setIsLocationTaggingEnabled(val);
    await logLocationService.setLocationTaggingEnabled(val);
  };

  useEffect(() => {
    fetchProfile().catch(() => {});
  }, [fetchProfile]);

  useEffect(() => {
    if (user?.name) {
      setNewName(user.name);
    }
    if (user) {
      if (user.age != null) setAge(String(user.age));
      if (user.weight != null) setWeight(String(user.weight));
      if (user.gender) setGender(user.gender);
    }
  }, [user?.name, user?.age, user?.weight, user?.gender]);

  // Initials generator
  const initials = user?.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Save Name Handler
  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return;
    }
    setIsSavingName(true);
    try {
      await updateProfile({ name: newName.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditNameVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Toggle Condition Handler
  const handleToggleCondition = async (condition: string) => {
    Haptics.selectionAsync();
    const current = user?.conditions || [];
    const exists = current.includes(condition);
    const updated = exists ? current.filter(c => c !== condition) : [...current, condition];

    setIsUpdatingConditions(true);
    try {
      await updateProfile({ conditions: updated });
    } catch {
      Alert.alert('Error', 'Failed to update conditions.');
    } finally {
      setIsUpdatingConditions(false);
    }
  };

  // Add Custom Condition Handler
  const handleAddCustomCondition = async () => {
    const trimmed = customCondition.trim();
    if (!trimmed) return;
    const current = user?.conditions || [];
    if (current.includes(trimmed)) {
      setCustomCondition('');
      setAddConditionVisible(false);
      return;
    }
    const updated = [...current, trimmed];
    setIsUpdatingConditions(true);
    try {
      await updateProfile({ conditions: updated });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCustomCondition('');
      setAddConditionVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to add condition.');
    } finally {
      setIsUpdatingConditions(false);
    }
  };

  // Save Vitals Handler
  const handleSaveVitals = async () => {
    setIsSavingVitals(true);
    try {
      const parsedAge = age.trim() ? parseInt(age.trim(), 10) : undefined;
      const parsedWeight = weight.trim() ? parseFloat(weight.trim()) : undefined;

      if (parsedAge !== undefined && (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 130)) {
        Alert.alert('Invalid Age', 'Please enter a valid age between 0 and 130.');
        setIsSavingVitals(false);
        return;
      }
      if (parsedWeight !== undefined && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight.');
        setIsSavingVitals(false);
        return;
      }

      await updateProfile({
        age: parsedAge,
        weight: parsedWeight,
        gender: (gender as any) || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVitalsSaved(true);
      setTimeout(() => setVitalsSaved(false), 2500);
    } catch {
      Alert.alert('Error', 'Failed to save personal vitals.');
    } finally {
      setIsSavingVitals(false);
    }
  };

  // Preference Handlers
  const handleUnitsChange = async (units: 'metric' | 'imperial') => {
    Haptics.selectionAsync();
    try {
      await updateProfile({ preferences: { units } });
    } catch {}
  };

  const handleTempUnitChange = async (tempUnit: 'C' | 'F') => {
    Haptics.selectionAsync();
    try {
      await updateProfile({ preferences: { tempUnit } });
    } catch {}
  };

  const handleDayBoundaryChange = async (dayBoundaryHour: number) => {
    Haptics.selectionAsync();
    try {
      await updateProfile({ preferences: { dayBoundaryHour } });
      useQuickLogStore.getState().fetchTodayTaps(dayBoundaryHour).catch(() => {});
      // Walking totals and today's steps follow the new boundary too
      useActivityStore.getState().fetchTodaySummary().catch(() => {});
      useAutoWalkStore.getState().sync({ force: true }).catch(() => {});
    } catch {}
  };

  const handleThemeChange = async (pref: ThemePref) => {
    Haptics.selectionAsync();
    setPreference(pref);
    try {
      await updateProfile({ preferences: { theme: pref } });
    } catch {}
  };

  // App Lock Switch Handler
  const handleToggleAppLock = async (value: boolean) => {
    Haptics.selectionAsync();
    const result = await toggleAppLock(value);
    if (!result.success && result.message) {
      Alert.alert('Biometric App Lock', result.message);
    } else if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Log Out of Lumen',
      'Are you sure you want to log out? Your local session and active logs will be safely synchronized.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/(auth)/login');
            } catch {
              router.replace('/(auth)/login');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  // Delete Account & All Data Handler
  const executeAccountDeletion = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteAccountAndData();
      router.replace('/(auth)/login');
    } catch (err: any) {
      setIsDeletingAccount(false);
      const isNetwork = !err?.statusCode || err?.statusCode >= 500;
      Alert.alert(
        'Deletion Incomplete',
        isNetwork
          ? 'Unable to reach the server to delete remote data. Would you like to wipe all local health data and log out on this device now?'
          : (err?.message || 'Could not delete your account. Please check your connection and try again.'),
        isNetwork
          ? [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Wipe Device Data',
                style: 'destructive',
                onPress: async () => {
                  setIsDeletingAccount(true);
                  await purgeAllLocalData();
                  router.replace('/(auth)/login');
                },
              },
            ]
          : [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handleDeleteAccount = () => {
    if (!isPrimaryUser) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Account Deletion Restricted',
        'You are currently logged in with shared member credentials. Only the Primary Account Owner (signed in via Google) can delete this account and all associated health records.',
        [{ text: 'Understood', style: 'default' }]
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Account & All Data?',
      'This will permanently delete your user account, entire health history, day sessions, walking routes, medications, custom trackers, and scheduled reminders. This action CANNOT be reversed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: executeAccountDeletion,
        },
      ],
    );
  };

  const activeUnits = user?.preferences?.units || 'metric';
  const activeTempUnit = user?.preferences?.tempUnit || 'C';
  const activeBoundary = user?.preferences?.dayBoundaryHour ?? 4;
  const userConditions = user?.conditions || [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenTopBar
        title={sectionTitle ?? 'Settings'}
        backLabel="Go back"
        sheet
        onBack={() => (sectionTitle ? router.back() : safeGoBack('/(tabs)/today'))}
      />

      <ScrollView
        contentContainerStyle={sectionTitle ? styles.scroll : styles.hubScroll}
        showsVerticalScrollIndicator={false}
      >
        {sectionTitle ? (
          <>
        {section === 'sleepgoal' ? (
          <View style={styles.goalWrap}>
            <InsetGroup
              footer={`Nights of ${formatGoalHours(sleepGoalMinutes - 60)} hours or more count as on target. This is your own target, not medical advice. Your care team can tell you what suits you.`}
            >
              <GroupedRow
                icon={Target}
                tile={TILE.indigo}
                label="Sleep goal"
                sub={`${goalRangeLabel(sleepGoalMinutes)} hours`}
                trailing={
                  <View style={styles.goalStepper}>
                    <TouchableOpacity
                      style={[styles.goalBtn, sleepGoalMinutes <= SLEEP_GOAL_MIN_MINUTES && styles.goalBtnOff]}
                      disabled={sleepGoalMinutes <= SLEEP_GOAL_MIN_MINUTES}
                      onPress={() => { Haptics.selectionAsync(); setSleepGoal(sleepGoalMinutes - SLEEP_GOAL_STEP_MINUTES); }}
                      {...buttonProps('Lower sleep goal by 30 minutes', false)}
                    >
                      <Minus size={18} color={palette.text} />
                    </TouchableOpacity>
                    <Text style={styles.goalValue} maxFontSizeMultiplier={1.3} accessibilityLabel={`${formatGoalHours(sleepGoalMinutes)} hours`}>
                      {formatGoalHours(sleepGoalMinutes)} h
                    </Text>
                    <TouchableOpacity
                      style={[styles.goalBtn, sleepGoalMinutes >= SLEEP_GOAL_MAX_MINUTES && styles.goalBtnOff]}
                      disabled={sleepGoalMinutes >= SLEEP_GOAL_MAX_MINUTES}
                      onPress={() => { Haptics.selectionAsync(); setSleepGoal(sleepGoalMinutes + SLEEP_GOAL_STEP_MINUTES); }}
                      {...buttonProps('Raise sleep goal by 30 minutes', false)}
                    >
                      <Plus size={18} color={palette.text} />
                    </TouchableOpacity>
                  </View>
                }
              />
            </InsetGroup>
          </View>
        ) : null}
        {section === 'sleep' ? (
          <>
        {/* Sleep & Recovery Summary Card */}
        <View>
          <DayClockCard />
        </View>

        {/* Day Boundary Hour — when a tracking day ends/begins, same concept as wake/bedtime above */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Clock size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Day Reset Boundary</Text>
                <Text style={styles.rowSub}>When a new tracking day starts</Text>
              </View>
            </View>
          </View>
          <View style={styles.segRow}>
            {DAY_BOUNDARY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.hour}
                style={[
                  styles.segSmall,
                  activeBoundary === opt.hour && styles.segActive,
                ]}
                onPress={() => handleDayBoundaryChange(opt.hour)}
                {...buttonProps(`Day boundary: ${opt.label}`, false)}
              >
                <Text
                  style={[
                    styles.segLabel,
                    activeBoundary === opt.hour && styles.segLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

          </>
        ) : null}
        {section === 'vitals' ? (
          <>
        {/* Personal Vitals & Demographics */}
        <View style={styles.sectionHeaderRow}>
          <View />
          {vitalsSaved && (
            <View style={styles.savedPill}>
              <Check size={12} color={palette.successText} />
              <Text style={styles.savedPillText}>Saved</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionDescription}>
          Recorded confidentially for symptom correlations, dosage tracking, and metabolic baselines.
        </Text>

        <View style={styles.card}>
          {/* Section 1: Body Metrics (Age & Weight) */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Heart size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Body Metrics</Text>
                <Text style={styles.rowSub}>Age and weight for metabolic tracking</Text>
              </View>
            </View>
          </View>

          <View style={styles.vitalsInputsRow}>
            {/* Age field */}
            <View style={styles.vitalField}>
              <Text style={styles.vitalFieldLabel}>Age</Text>
              <View style={styles.vitalFieldBox}>
                <TextInput
                  style={styles.vitalTextInput}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 29"
                  placeholderTextColor={palette.placeholder}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.vitalUnitSuffix}>yrs</Text>
              </View>
            </View>

            {/* Weight field */}
            <View style={styles.vitalField}>
              <Text style={styles.vitalFieldLabel}>
                Weight ({activeUnits === 'imperial' ? 'lbs' : 'kg'})
              </Text>
              <View style={styles.vitalFieldBox}>
                <TextInput
                  style={styles.vitalTextInput}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder={activeUnits === 'imperial' ? 'e.g. 154' : 'e.g. 70'}
                  placeholderTextColor={palette.placeholder}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Text style={styles.vitalUnitSuffix}>
                  {activeUnits === 'imperial' ? 'lbs' : 'kg'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 2: Gender Identity */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <UserIcon size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Gender Identity</Text>
                <Text style={styles.rowSub}>For clinical and hormonal correlation</Text>
              </View>
            </View>
          </View>

          <View style={styles.chipsContainer}>
            {GENDER_OPTIONS.map(opt => {
              const isSelected = gender === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.conditionChip, isSelected && styles.conditionChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGender(prev => prev === opt.key ? '' : opt.key);
                  }}
                  {...buttonProps(`Gender: ${opt.label}`, false)}
                >
                  {isSelected && <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />}
                  <Text style={[styles.conditionChipText, isSelected && styles.conditionChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Save Button Row */}
          <View style={styles.vitalsActionRow}>
            <TouchableOpacity
              style={[styles.saveVitalsButton, vitalsSaved && styles.saveVitalsButtonSuccess]}
              onPress={handleSaveVitals}
              disabled={isSavingVitals}
              {...buttonProps('Save personal vitals')}
            >
              {isSavingVitals ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : vitalsSaved ? (
                <View style={styles.btnRow}>
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.saveVitalsButtonText}>Vitals Saved</Text>
                </View>
              ) : (
                <Text style={styles.saveVitalsButtonText}>Save Vitals</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

          </>
        ) : null}
        {section === 'conditions' ? (
          <>
        {/* Health Conditions & Diagnoses */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Conditions & Health Focus</Text>
          {isUpdatingConditions && <ActivityIndicator size="small" color={palette.primaryText} />}
        </View>
        <Text style={styles.sectionDescription}>
          Select the chronic conditions or symptoms you are tracking. Lumen tailors questionnaires, trigger correlations, and reminder triggers around these.
        </Text>

        <View style={styles.card}>
          <View style={styles.chipsContainer}>
            {/* Common Condition Chips */}
            {COMMON_CONDITIONS.map(cond => {
              const isSelected = userConditions.includes(cond);
              return (
                <TouchableOpacity
                  key={cond}
                  style={[styles.conditionChip, isSelected && styles.conditionChipActive]}
                  onPress={() => handleToggleCondition(cond)}
                  {...buttonProps(`Condition: ${cond}`, false)}
                >
                  {isSelected && <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />}
                  <Text
                    style={[
                      styles.conditionChipText,
                      isSelected && styles.conditionChipTextActive,
                    ]}
                  >
                    {cond}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom user conditions not in COMMON_CONDITIONS */}
            {userConditions
              .filter(c => !COMMON_CONDITIONS.includes(c))
              .map(cond => (
                <TouchableOpacity
                  key={cond}
                  style={[styles.conditionChip, styles.conditionChipActive]}
                  onPress={() => handleToggleCondition(cond)}
                  {...buttonProps(`Condition: ${cond}`, false)}
                >
                  <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={[styles.conditionChipText, styles.conditionChipTextActive]}>
                    {cond}
                  </Text>
                  <X size={12} color="#FFFFFF" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              ))}

            {/* Add Custom Condition Button */}
            <TouchableOpacity
              style={styles.addConditionChip}
              onPress={() => setAddConditionVisible(true)}
              {...buttonProps('Add custom condition')}
            >
              <Plus size={14} color={palette.primaryText} />
              <Text style={styles.addConditionText}>Add Condition</Text>
            </TouchableOpacity>
          </View>
        </View>

          </>
        ) : null}
        {section === 'units' ? (
          <>
        {/* Units & Measurements */}
        <View style={styles.card}>
          {/* Units System */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ruler size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Measurement System</Text>
                <Text style={styles.rowSub}>For distance, volume & metrics</Text>
              </View>
            </View>
          </View>
          <View style={styles.segRow}>
            {UNIT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.seg,
                  activeUnits === opt.key && styles.segActive,
                ]}
                onPress={() => handleUnitsChange(opt.key)}
                {...buttonProps(`${opt.label} units`, false)}
              >
                <Text
                  style={[
                    styles.segLabel,
                    activeUnits === opt.key && styles.segLabelActive,
                  ]}
                >
                  {opt.label} ({opt.desc})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Temperature */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Thermometer size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Temperature Scale</Text>
                <Text style={styles.rowSub}>For fever and ambient logging</Text>
              </View>
            </View>
          </View>
          <View style={styles.segRow}>
            {TEMP_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.seg,
                  activeTempUnit === opt.key && styles.segActive,
                ]}
                onPress={() => handleTempUnitChange(opt.key)}
                {...buttonProps(opt.label, false)}
              >
                <Text
                  style={[
                    styles.segLabel,
                    activeTempUnit === opt.key && styles.segLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

          </>
        ) : null}
        {section === 'appearance' ? (
          <>
        {/* Appearance */}
        <View style={styles.card}>
          <View style={styles.segRowTop}>
            {THEME_OPTIONS.map(opt => {
              const isSelected = preference === opt.key;
              const IconComp = opt.icon;
              const iconColor = isSelected ? '#FFFFFF' : palette.textSecondary;

              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.seg,
                    isSelected && styles.segActive,
                  ]}
                  onPress={() => handleThemeChange(opt.key)}
                  {...buttonProps(`${opt.label} theme`, false)}
                  activeOpacity={0.8}
                >
                  <IconComp size={16} color={iconColor} strokeWidth={2.2} />
                  <Text
                    style={[
                      styles.segLabel,
                      isSelected && styles.segLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

          </>
        ) : null}
        {section === 'security' ? (
          <>
        {/* Security & Credentials */}
        <View style={styles.card}>
          {/* Account Password Section */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <KeyRound size={18} color={palette.primaryText} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.rowLabel}>Account Password</Text>
                  <View style={[
                    styles.methodBadge,
                    { backgroundColor: isPrimaryUser ? palette.primary + '20' : palette.surfaceAlt }
                  ]}>
                    <Text style={[
                      styles.methodBadgeText,
                      { color: isPrimaryUser ? palette.primary : palette.textSecondary }
                    ]}>
                      {isPrimaryUser ? '👑 Primary (Google)' : '👥 Shared Member (Password)'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.rowSub}>
                  {isPrimaryUser
                    ? (user?.hasPassword
                        ? 'Configured. You can share this password with family or caregivers so they can log in to view and add logs.'
                        : 'No password set. Sign-in is handled via Google. Set a password to allow family/caregiver access.')
                    : 'Managed by the Primary Account Owner. Secondary members cannot create or modify this password.'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Row */}
          {isPrimaryUser ? (
            <TouchableOpacity
              style={[styles.passwordActionBtn, { backgroundColor: palette.primary }]}
              onPress={() => {
                setNewPassword('');
                setConfirmPassword('');
                setSetPasswordVisible(true);
              }}
              {...buttonProps(user?.hasPassword ? 'Change Account Password' : 'Set Account Password')}
            >
              <Text style={styles.passwordActionBtnText}>
                {user?.hasPassword ? 'Change Shared Password' : 'Set Password for Family Access'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.elevateNoticeBox}>
              <Text style={styles.elevateNoticeText}>
                🔒 Only the Primary Account Owner can create or change the shared account password.
              </Text>
            </View>
          )}

          {/* Sensitive Photo Vault PIN */}
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 12, paddingTop: 12 }]}>
            <View style={styles.rowLeft}>
              <Lock size={18} color={palette.primaryText} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.rowLabel}>Sensitive Photo PIN</Text>
                  <View style={[
                    styles.methodBadge,
                    { backgroundColor: user?.hasPhotoPin ? palette.primary + '20' : palette.surfaceAlt }
                  ]}>
                    <Text style={[
                      styles.methodBadgeText,
                      { color: user?.hasPhotoPin ? palette.primary : palette.textSecondary }
                    ]}>
                      {user?.hasPhotoPin ? '4-Digit PIN Active' : 'Not Configured'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.rowSub}>
                  {isPrimaryUser
                    ? (user?.hasPhotoPin
                        ? 'Private photos (flare-ups, skin, stool) require your 4-digit PIN or device biometrics to view.'
                        : 'Set a 4-digit PIN to lock sensitive medical and body photos across your timeline.')
                    : (user?.hasPhotoPin
                        ? "Protected by the Primary Owner's 4-digit PIN. You must enter this PIN to reveal sensitive photos (device biometrics disabled)."
                        : 'No Sensitive Photo PIN configured by the primary account owner.')}
                </Text>
              </View>
            </View>
          </View>

          {/* Photo PIN Action Row */}
          {isPrimaryUser ? (
            <TouchableOpacity
              style={[styles.passwordActionBtn, { backgroundColor: palette.primary }]}
              onPress={() => {
                setNewPhotoPin('');
                setConfirmPhotoPin('');
                setPhotoPinModalVisible(true);
              }}
              {...buttonProps(user?.hasPhotoPin ? 'Change Photo PIN' : 'Set Photo PIN')}
            >
              <Text style={styles.passwordActionBtnText}>
                {user?.hasPhotoPin ? 'Change Photo PIN' : 'Set Photo PIN (4-Digit)'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.elevateNoticeBox}>
              <Text style={styles.elevateNoticeText}>
                🔒 Only the Primary Account Owner can configure or update the 4-Digit Sensitive Photo PIN.
              </Text>
            </View>
          )}
        </View>

          </>
        ) : null}
          </>
        ) : (
          <>
        {/* Hub: profile + grouped rows */}
        <View style={styles.hubHero}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAvatarStudioVisible(true);
            }}
            activeOpacity={0.85}
            {...buttonProps('Customize animated avatar')}
          >
            <ModularAvatar size={74} animated={true} interactive={false} />
          </TouchableOpacity>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1}>{user?.name || 'Lumen Member'}</Text>
            <TouchableOpacity style={styles.editNameBtn} onPress={() => setEditNameVisible(true)} {...buttonProps('Edit name')}>
              <Edit2 size={16} color={palette.primaryText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroEmail} numberOfLines={1}>{user?.email || '—'}</Text>
          <Text style={styles.hubMeta}>
            {isPrimaryUser ? 'Primary account owner' : 'Shared member access'}{memberSince ? ` · Joined ${memberSince}` : ''}
          </Text>
          <View style={styles.hubHeroButtons}>
            <TouchableOpacity
              style={styles.hubPill}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAvatarStudioVisible(true);
              }}
              activeOpacity={0.8}
              {...buttonProps('Edit avatar')}
            >
              <Sparkles size={15} color={palette.primaryText} />
              <Text style={styles.hubPillText}>Edit Avatar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.hubPill}
              onPress={() => setAccountSwitcherVisible(true)}
              activeOpacity={0.8}
              {...buttonProps('Switch account')}
            >
              <ArrowRightLeft size={15} color={palette.primaryText} />
              <Text style={styles.hubPillText}>Switch Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <InsetGroup title="Accounts & Access">
          <GroupedRow icon={Users} tile={TILE.blue} label="Switch Account" value={savedAccounts && savedAccounts.length > 1 ? `${savedAccounts.length} accounts` : undefined} chevron onPress={() => setAccountSwitcherVisible(true)} />
          <GroupedRow icon={UserPlus} tile={TILE.blue} label="Add Another Account" chevron onPress={() => setAccountSwitcherVisible(true)} />
        </InsetGroup>

        <InsetGroup title="Sleep & Recovery">
          <GroupedRow icon={Moon} tile={TILE.indigo} label="Sleep & Day Session" sub="Wake, bedtime, sleep quality & day reset" chevron onPress={() => openSection('sleep')} />
          <GroupedRow icon={Target} tile={TILE.indigo} label="Sleep Goal" value={`${formatGoalHours(sleepGoalMinutes)} h`} chevron onPress={() => openSection('sleepgoal')} />
        </InsetGroup>

        <AutoWalkSettingsGroup />

        <InsetGroup title="Personal Vitals & Demographics">
          <GroupedRow icon={Cake} tile={TILE.pink} label="Age" value={user?.age != null ? String(user.age) : undefined} chevron onPress={() => openSection('vitals')} />
          <GroupedRow icon={Scale} tile={TILE.orange} label="Weight" value={user?.weight != null ? `${user.weight} ${activeUnits === 'imperial' ? 'lb' : 'kg'}` : undefined} chevron onPress={() => openSection('vitals')} />
          <GroupedRow icon={UserIcon} tile={TILE.gray} label="Sex" value={GENDER_OPTIONS.find(o => o.key === user?.gender)?.label} chevron onPress={() => openSection('vitals')} />
        </InsetGroup>

        <InsetGroup title="Conditions & Health Focus">
          <GroupedRow icon={Heart} tile={TILE.pink} label="Conditions" value={userConditions.length ? String(userConditions.length) : undefined} chevron onPress={() => openSection('conditions')} />
        </InsetGroup>

        <InsetGroup title="Measurement & Scale Units">
          <GroupedRow icon={Ruler} tile={TILE.gray} label="Units" value={`${activeUnits === 'imperial' ? 'Imperial' : 'Metric'} · °${activeTempUnit}`} chevron onPress={() => openSection('units')} />
          <GroupedRow icon={FlaskConical} tile={TILE.gray} label="Custom Units" chevron onPress={() => router.push('/customize/units')} />
        </InsetGroup>

        <InsetGroup>
          <GroupedRow icon={Bell} tile={TILE.red} label="Notifications & Intelligence" chevron onPress={() => router.push('/notification-settings')} />
          <GroupedRow icon={SunMoon} tile={TILE.blue} label="Appearance" value={THEME_OPTIONS.find(o => o.key === preference)?.label} chevron onPress={() => openSection('appearance')} />
        </InsetGroup>

        <InsetGroup title="Security & Credentials">
          <GroupedRow icon={ScanFace} tile={TILE.green} label="Biometric App Lock" toggle toggled={isAppLockEnabled} onToggle={handleToggleAppLock} />
          <GroupedRow icon={Lock} tile={TILE.gray} label="Sensitive Photo PIN" value={user?.hasPhotoPin ? 'On' : 'Off'} chevron onPress={() => openSection('security')} />
          <GroupedRow icon={MapPin} tile={TILE.blue} label="Auto-Tag Location on Logs" toggle toggled={isLocationTaggingEnabled} onToggle={handleToggleLocationTagging} />
          <GroupedRow icon={KeyRound} tile={TILE.gray} label="Account Password" value={user?.hasPassword ? 'Set' : 'Not set'} chevron onPress={() => openSection('security')} />
        </InsetGroup>

        <InsetGroup title="Health Data & Backups">
          <GroupedRow icon={FileText} tile={TILE.orange} label="Export Health Summary" sub="PDF or CSV reports for doctors" chevron onPress={() => router.push('/reports')} />
          <GroupedRow icon={Archive} tile={TILE.gray} label="Configuration Backup" chevron onPress={() => router.push('/customize/export')} />
        </InsetGroup>

        <InsetGroup title="Account Session">
          <GroupedRow icon={LogOut} tile={TILE.red} label="Log Out" sub="Safely close session and clear local cache" onPress={isLoggingOut ? undefined : handleLogout} destructive />
        </InsetGroup>

        <View style={styles.hubDanger}>
        {/* Danger Zone */}
        <View style={[styles.card, styles.dangerCard, !isPrimaryUser && { opacity: 0.8 }]}>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            {...buttonProps('Delete account and all data')}
          >
            <View style={styles.dangerRow}>
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={palette.errorText} style={{ marginRight: 6 }} />
              ) : (
                <Trash2 size={18} color={isPrimaryUser ? palette.error : palette.textSecondary} />
              )}
              <Text style={[styles.dangerText, !isPrimaryUser && { color: palette.textSecondary }]}>
                {isDeletingAccount ? 'Deleting Account & Data...' : 'Delete Account & All Data'}
              </Text>
            </View>
            <Text style={styles.dangerSub}>
              {isPrimaryUser
                ? 'Permanently delete all logged symptoms, walking routes, medications, and your account. This action cannot be reversed.'
                : '🔒 Restricted to Primary Account Owner. Secondary members cannot delete this account or its clinical records.'}
            </Text>
          </TouchableOpacity>
        </View>
        </View>

        {/* About Lumen Brand Section */}
        <View style={styles.brandFooter}>
          <LumenLogo variant="full" size={54} />
          <Text style={[styles.brandVersionText, { color: palette.textSecondary }]}>
            Version 0.1.0 • Built with care for Autoimmune Health
          </Text>
        </View>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile Name</Text>
            <Text style={styles.modalDesc}>How should Lumen address you in your daily check-ins?</Text>

            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Your full name"
              placeholderTextColor={palette.placeholder}
              autoFocus
              maxLength={80}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditNameVisible(false)}
                disabled={isSavingName}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Custom Condition Modal */}
      <Modal
        visible={addConditionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddConditionVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Health Condition</Text>
            <Text style={styles.modalDesc}>
              Enter any medical condition, syndrome, or chronic symptom you want to track.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={customCondition}
              onChangeText={setCustomCondition}
              placeholder="e.g. Hashimoto's, Sjögren's, Raynaud's"
              placeholderTextColor={palette.placeholder}
              autoFocus
              maxLength={60}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setCustomCondition('');
                  setAddConditionVisible(false);
                }}
                disabled={isUpdatingConditions}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleAddCustomCondition}
                disabled={isUpdatingConditions || !customCondition.trim()}
              >
                {isUpdatingConditions ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Add Condition</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set / Reset Account Password Modal */}
      <Modal
        visible={setPasswordVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSetPasswordVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {user?.hasPassword ? 'Change Account Password' : 'Set Account Password'}
            </Text>
            <Text style={styles.modalDesc}>
              Enter a secure password (min 8 characters). Once set, you can use your email and this password to sign into Lumen.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (8+ characters)"
              placeholderTextColor={palette.placeholder}
              secureTextEntry
              autoFocus
              accessibilityLabel="New Password"
            />

            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={palette.placeholder}
              secureTextEntry
              accessibilityLabel="Confirm New Password"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setSetPasswordVisible(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isSavingPassword}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePassword}
                disabled={isSavingPassword}
              >
                {isSavingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set / Reset Sensitive Photo PIN Modal */}
      <Modal
        visible={photoPinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPinModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {user?.hasPhotoPin ? 'Change Photo Vault PIN' : 'Set Photo Vault PIN'}
            </Text>
            <Text style={styles.modalDesc}>
              Enter a 4-digit numeric PIN. Once set, sensitive photos will remain blurred until this PIN is entered or biometric verification succeeds.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newPhotoPin}
              onChangeText={(t) => setNewPhotoPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="4-digit PIN (e.g. 1234)"
              placeholderTextColor={palette.placeholder}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              accessibilityLabel="New Photo PIN"
            />

            <TextInput
              style={styles.modalInput}
              value={confirmPhotoPin}
              onChangeText={(t) => setConfirmPhotoPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Confirm 4-digit PIN"
              placeholderTextColor={palette.placeholder}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              accessibilityLabel="Confirm Photo PIN"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setPhotoPinModalVisible(false);
                  setNewPhotoPin('');
                  setConfirmPhotoPin('');
                }}
                disabled={isSavingPhotoPin}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePhotoPin}
                disabled={isSavingPhotoPin}
              >
                {isSavingPhotoPin ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fullscreen Deletion Progress Modal */}
      <Modal
        visible={isDeletingAccount}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingIconCircle}>
              <Trash2 size={28} color={palette.errorText} />
            </View>
            <ActivityIndicator size="large" color={palette.errorText} style={{ marginVertical: 14 }} />
            <Text style={styles.loadingTitle}>Deleting Account & All Data</Text>
            <Text style={styles.loadingDesc}>
              Permanently purging your health logs, activity sessions, scheduled reminders, and server profile. Please do not close the app.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Multi-Account Switcher Bottom Sheet */}
      <AccountSwitcherModal
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
      />

      {/* Reddit-style Animated Avatar Studio Modal */}
      <AvatarStudioModal
        visible={avatarStudioVisible}
        onClose={() => setAvatarStudioVisible(false)}
      />
    </SafeAreaView>
  );
}

function makeStyles(palette: ThemeTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 40,
      gap: 8,
    },
    hubScroll: { paddingTop: 10, paddingBottom: 40, gap: 22 },
    hubHero: { alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 4 },
    hubMeta: { ...typography.footnote, color: palette.textSecondary },
    hubHeroButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
    hubPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: palette.tint + '1F',
    },
    hubPillText: { ...typography.subheadBold, color: palette.primaryText },
    hubDanger: { paddingHorizontal: 16 },
    goalWrap: { marginHorizontal: -16 },
    goalStepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    goalBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceAlt,
    },
    goalBtnOff: { opacity: 0.4 },
    goalValue: { ...typography.headline, color: palette.text, minWidth: 48, textAlign: 'center' },
    // Hero Card
    profileHeroCard: {
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 26,
      paddingVertical: 20,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 8,
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    avatarInitials: {
      ...typography.h2,
      color: '#FFFFFF',
      fontWeight: '800',
      letterSpacing: 1,
    },
    avatarBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: palette.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.surface,
    },
    heroDetails: {
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: 4,
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    heroName: {
      ...typography.title2,
      color: palette.text,
      flexShrink: 1,
      textAlign: 'center',
    },
    editNameBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: palette.tint + '1F',
    },
    heroEmailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    heroEmail: {
      ...typography.subhead,
      color: palette.textSecondary,
      flexShrink: 1,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    accountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.tint + '1F',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 9999,
    },
    accountBadgeText: {
      ...typography.footnote,
      color: palette.primaryText,
      fontWeight: '600',
    },
    memberSinceText: {
      ...typography.footnote,
      color: palette.textSecondary,
    },
    customizeAvatarHeroBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
      minHeight: 40,
      borderRadius: 20,
      backgroundColor: palette.surfaceAlt,
    },
    customizeAvatarHeroText: {
      ...typography.subhead,
      color: palette.primaryText,
    },
    switchAccountHeroBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
      minHeight: 40,
      borderRadius: 20,
      backgroundColor: palette.surfaceAlt,
    },
    switchAccountHeroText: {
      ...typography.subhead,
      color: palette.primaryText,
    },
    accountCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.tint + '1F',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 9999,
    },
    accountCountText: {
      ...typography.footnote,
      color: palette.primaryText,
      fontWeight: '600',
    },
    accountSwitchCard: {
      backgroundColor: palette.surface,
      borderRadius: 26,
      overflow: 'hidden',
      marginBottom: 10,
    },
    accountSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      minHeight: 52,
    },
    accountSwitchIconBox: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: palette.tint + '1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountSwitchInfo: {
      flex: 1,
      gap: 2,
    },
    accountSwitchLabel: {
      ...typography.bodyLarge,
      color: palette.text,
    },
    accountSwitchSubLabel: {
      ...typography.footnote,
      color: palette.textSecondary,
    },
    accountSwitchActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      minHeight: 36,
      borderRadius: 18,
      backgroundColor: palette.tint + '1F',
    },
    accountSwitchActionPillText: {
      ...typography.subheadBold,
      color: palette.primaryText,
    },
    // Sections
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginTop: 14,
      marginBottom: 2,
    },
    sectionTitle: {
      ...typography.sectionLabel,
      color: palette.textSecondary,
      paddingHorizontal: 4,
      marginTop: 14,
      marginBottom: 2,
    },
    sectionDescription: {
      ...typography.footnote,
      color: palette.textSecondary,
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 26,
      overflow: 'hidden',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: palette.border,
      marginHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    rowLabel: {
      ...typography.bodyLarge,
      color: palette.text,
    },
    rowSub: {
      ...typography.footnote,
      color: palette.textSecondary,
      marginTop: 2,
    },
    // Condition Chips
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      padding: 14,
    },
    conditionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      minHeight: 34,
      borderRadius: 17,
      backgroundColor: palette.surfaceAlt,
    },
    conditionChipActive: {
      backgroundColor: palette.primary,
    },
    conditionChipText: {
      ...typography.subhead,
      color: palette.text,
    },
    conditionChipTextActive: {
      color: '#FFFFFF',
    },
    addConditionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      minHeight: 34,
      borderRadius: 17,
      backgroundColor: palette.tint + '1F',
    },
    addConditionText: {
      ...typography.subheadBold,
      color: palette.primaryText,
    },
    // Segment Controls
    segRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
    },
    segRowTop: {
      flexDirection: 'row',
      gap: 8,
      padding: 14,
    },
    seg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: palette.surfaceAlt,
    },
    segSmall: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
      borderRadius: 20,
      backgroundColor: palette.surfaceAlt,
    },
    segActive: {
      backgroundColor: palette.primary,
    },
    segIcon: {
      fontSize: 14,
    },
    segLabel: {
      ...typography.subhead,
      color: palette.text,
    },
    segLabelActive: {
      color: '#FFFFFF',
    },
    // Danger Zone
    dangerCard: {
      backgroundColor: palette.error + '14',
      marginTop: 14,
      padding: 16,
    },
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    dangerText: {
      ...typography.bodyBold,
      color: palette.errorText,
    },
    dangerSub: {
      ...typography.caption,
      color: palette.errorText + 'BB',
      lineHeight: 18,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: palette.surface,
      borderRadius: 26,
      padding: 22,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
    modalTitle: {
      ...typography.title2,
      color: palette.text,
    },
    modalDesc: {
      ...typography.subhead,
      color: palette.textSecondary,
    },
    modalInput: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 48,
      color: palette.text,
      ...typography.bodyLarge,
      marginTop: 6,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 8,
    },
    modalCancelBtn: {
      paddingHorizontal: 18,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: palette.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      ...typography.headline,
      color: palette.textSecondary,
      fontWeight: '500',
    },
    modalSaveBtn: {
      paddingHorizontal: 18,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: palette.primary,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveText: {
      ...typography.headline,
      color: '#FFFFFF',
    },
    // Vitals section
    vitalsInputsRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
    },
    vitalField: {
      flex: 1,
      gap: 6,
    },
    vitalFieldLabel: {
      ...typography.footnote,
      color: palette.textSecondary,
    },
    vitalFieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surfaceAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 48,
    },
    vitalTextInput: {
      flex: 1,
      height: 48,
      color: palette.text,
      ...typography.body,
      fontWeight: '600',
      fontSize: 15,
      paddingVertical: 0,
    },
    vitalUnitSuffix: {
      ...typography.footnote,
      color: palette.textSecondary,
      marginLeft: 6,
    },
    vitalsActionRow: {
      padding: 16,
    },
    saveVitalsButton: {
      backgroundColor: palette.primary,
      minHeight: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveVitalsButtonSuccess: {
      backgroundColor: palette.success,
    },
    saveVitalsButtonText: {
      ...typography.headline,
      color: '#FFFFFF',
    },
    btnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    savedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.success + '26',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    savedPillText: {
      ...typography.footnote,
      color: palette.successText,
      fontWeight: '600',
    },
    loadingOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    loadingCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: palette.surface,
      borderRadius: 26,
      padding: 28,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    loadingIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: palette.error + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingTitle: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 8,
    },
    loadingDesc: {
      ...typography.body,
      fontSize: 13,
      lineHeight: 19,
      color: palette.textSecondary,
      textAlign: 'center',
    },
    methodBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    methodBadgeText: {
      ...typography.caption,
      fontWeight: '700',
      fontSize: 11,
    },
    passwordActionBtn: {
      marginTop: 10,
      marginHorizontal: 16,
      marginBottom: 14,
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    passwordActionBtnText: {
      ...typography.button,
      color: '#FFFFFF',
      fontSize: 14,
    },
    elevateNoticeBox: {
      backgroundColor: palette.surfaceAlt,
      borderRadius: 18,
      padding: 14,
      marginTop: 10,
      gap: 10,
    },
    elevateNoticeText: {
      ...typography.footnote,
      color: palette.textSecondary,
    },
    elevateBtn: {
      backgroundColor: palette.primary,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    elevateBtnText: {
      ...typography.button,
      color: '#FFFFFF',
      fontSize: 13,
    },
    brandFooter: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
      marginBottom: 8,
      gap: 10,
    },
    brandVersionText: {
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
}

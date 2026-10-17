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
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
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
} from 'lucide-react-native';

import { useTheme } from '../src/theme/ThemeContext';
import { useAuthStore } from '../src/store/authStore';
import { useQuickLogStore } from '../src/store/quickLogStore';
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

  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);

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
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => safeGoBack('/(tabs)/today')}
          {...buttonProps('Go back')}
        >
          <ChevronLeft size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile & Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* User Hero Profile Card */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Sparkles size={13} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroDetails}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.name || 'Lumen Member'}
              </Text>
              <TouchableOpacity
                style={styles.editNameBtn}
                onPress={() => setEditNameVisible(true)}
                {...buttonProps('Edit name')}
              >
                <Edit2 size={16} color={palette.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroEmailRow}>
              <Mail size={14} color={palette.textSecondary} />
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.email || '—'}
              </Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={[
                styles.accountBadge,
                !isPrimaryUser && { backgroundColor: palette.surfaceAlt, borderColor: palette.border }
              ]}>
                <Lock size={11} color={isPrimaryUser ? palette.primary : palette.textSecondary} />
                <Text style={[
                  styles.accountBadgeText,
                  !isPrimaryUser && { color: palette.textSecondary }
                ]}>
                  {isPrimaryUser ? '👑 Primary Account Owner' : '👥 Shared Member Access'}
                </Text>
              </View>
              {memberSince ? (
                <Text style={styles.memberSinceText}>Joined {memberSince}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.switchAccountHeroBtn}
              onPress={() => setAccountSwitcherVisible(true)}
              activeOpacity={0.8}
              {...buttonProps('Switch Account')}
            >
              <ArrowRightLeft size={13} color={palette.primary} />
              <Text style={styles.switchAccountHeroText}>
                Switch / Manage Accounts ({savedAccounts?.length || 1})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Multi-Account Management Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Accounts & Access</Text>
          <View style={styles.accountCountBadge}>
            <Users size={11} color={palette.primary} />
            <Text style={styles.accountCountText}>
              {savedAccounts?.length || 1} {savedAccounts?.length === 1 ? 'account' : 'accounts'}
            </Text>
          </View>
        </View>
        <Text style={styles.sectionDescription}>
          Switch between clinical profiles, family members, or personal tracking spaces without signing out.
        </Text>
        <View style={styles.accountSwitchCard}>
          <TouchableOpacity
            style={styles.accountSwitchRow}
            onPress={() => setAccountSwitcherVisible(true)}
            activeOpacity={0.7}
            {...buttonProps('Manage multi-accounts')}
          >
            <View style={styles.accountSwitchIconBox}>
              <Users size={20} color={palette.primary} />
            </View>
            <View style={styles.accountSwitchInfo}>
              <Text style={styles.accountSwitchLabel}>Switch or Add Account</Text>
              <Text style={styles.accountSwitchSubLabel} numberOfLines={1}>
                Active: {user?.name || user?.email || 'Current Account'}
              </Text>
            </View>
            <View style={styles.accountSwitchActionPill}>
              <ArrowRightLeft size={13} color={palette.primary} />
              <Text style={styles.accountSwitchActionPillText}>Switch</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Sleep & Recovery Summary Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Sleep & Recovery</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Track sleep quality, duration, and cellular recovery milestones.
        </Text>
        <View style={{ marginBottom: 18 }}>
          <DayClockCard />
        </View>

        {/* Personal Vitals & Demographics */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Personal Vitals & Demographics</Text>
          {vitalsSaved && (
            <View style={styles.savedPill}>
              <Check size={12} color="#10B981" />
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

        {/* Health Conditions & Diagnoses */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Conditions & Health Focus</Text>
          {isUpdatingConditions && <ActivityIndicator size="small" color={palette.primary} />}
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
              <Plus size={14} color={palette.primary} />
              <Text style={styles.addConditionText}>Add Condition</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Units & Measurements */}
        <Text style={styles.sectionTitle}>Measurement & Scale Units</Text>
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

          <View style={styles.divider} />

          {/* Day Boundary Hour */}
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

        {/* Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
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

        {/* Security & Credentials */}
        <Text style={styles.sectionTitle}>Security & Credentials</Text>
        <View style={styles.card}>
          {/* Account Password Section */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <KeyRound size={18} color={palette.primary} />
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
              <Lock size={18} color={palette.primary} />
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

          {/* Biometric App Lock */}
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 12, paddingTop: 12 }]}>
            <View style={styles.rowLeft}>
              <Shield size={18} color={palette.textSecondary} />
              <View>
                <Text style={styles.rowLabel}>Biometric App Lock</Text>
                <Text style={styles.rowSub}>
                  {biometricType === 'FACE'
                    ? 'Require Face ID or device passcode upon launch'
                    : biometricType === 'FINGERPRINT'
                    ? 'Require fingerprint or device passcode upon launch'
                    : 'Require biometrics or device passcode upon launch'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: palette.border, true: palette.primary + '88' }}
              thumbColor={isAppLockEnabled ? palette.primary : palette.textDisabled}
              accessibilityLabel="Biometric App Lock"
            />
          </View>

          {/* Automatic Location Tagging */}
          <View style={[styles.row, styles.rowLast, { borderTopWidth: 1, borderTopColor: palette.border, marginTop: 12, paddingTop: 12 }]}>
            <View style={styles.rowLeft}>
              <MapPin size={18} color={palette.textSecondary} />
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.rowLabel}>Auto-Tag Location on Logs</Text>
                <Text style={styles.rowSub}>
                  Silently capture location context for Quick Taps, check-ins, and symptom questionnaires to correlate environmental triggers.
                </Text>
              </View>
            </View>
            <Switch
              value={isLocationTaggingEnabled}
              onValueChange={handleToggleLocationTagging}
              trackColor={{ false: palette.border, true: palette.primary + '88' }}
              thumbColor={isLocationTaggingEnabled ? palette.primary : palette.textDisabled}
              accessibilityLabel="Auto-tag location on logs"
            />
          </View>
        </View>

        {/* Health Data & Backups */}
        <Text style={styles.sectionTitle}>Health Data & Backups</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/reports')}
            {...buttonProps('Export clinical health report')}
          >
            <View style={styles.rowLeft}>
              <Heart size={18} color={palette.primary} />
              <View>
                <Text style={styles.rowLabel}>Export Health Summary</Text>
                <Text style={styles.rowSub}>Generate PDF or CSV reports for doctors</Text>
              </View>
            </View>
            <ChevronRight size={18} color={palette.textDisabled} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={() => router.push('/customize/export')}
            {...buttonProps('Export or import configuration')}
          >
            <View style={styles.rowLeft}>
              <Globe size={18} color={palette.secondary} />
              <View>
                <Text style={styles.rowLabel}>Configuration Backup</Text>
                <Text style={styles.rowSub}>Export or import custom trackers & questions</Text>
              </View>
            </View>
            <ChevronRight size={18} color={palette.textDisabled} />
          </TouchableOpacity>
        </View>

        {/* Session & Sign Out */}
        <Text style={styles.sectionTitle}>Account Session</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowLast]}
            onPress={handleLogout}
            disabled={isLoggingOut}
            {...buttonProps('Log out of Lumen')}
          >
            <View style={styles.rowLeft}>
              <LogOut size={18} color={palette.warning} />
              <View>
                <Text style={[styles.rowLabel, { color: palette.warning }]}>
                  Log Out
                </Text>
                <Text style={styles.rowSub}>Safely close session and clear local cache</Text>
              </View>
            </View>
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={palette.warning} />
            ) : (
              <ChevronRight size={18} color={palette.warning} />
            )}
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={[styles.card, styles.dangerCard, !isPrimaryUser && { opacity: 0.8 }]}>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            {...buttonProps('Delete account and all data')}
          >
            <View style={styles.dangerRow}>
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={palette.error} style={{ marginRight: 6 }} />
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
 
        {/* About Lumen Brand Section */}
        <View style={styles.brandFooter}>
          <LumenLogo variant="full" size={54} />
          <Text style={[styles.brandVersionText, { color: palette.textSecondary }]}>
            Version 0.1.0 • Built with care for Autoimmune Health
          </Text>
        </View>

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
              <Trash2 size={28} color={palette.error} />
            </View>
            <ActivityIndicator size="large" color={palette.error} style={{ marginVertical: 14 }} />
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
    </SafeAreaView>
  );
}

function makeStyles(palette: ThemeTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      backgroundColor: palette.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: palette.surfaceAlt,
    },
    topBarTitle: {
      ...typography.h3,
      fontSize: 18,
      color: palette.text,
      fontWeight: '700',
    },
    scroll: {
      padding: 18,
      gap: 8,
    },
    // Hero Card
    profileHeroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
      marginBottom: 10,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 16,
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
      flex: 1,
      gap: 4,
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroName: {
      ...typography.h3,
      fontSize: 19,
      fontWeight: '700',
      color: palette.text,
      flex: 1,
    },
    editNameBtn: {
      padding: 4,
      borderRadius: 8,
      backgroundColor: palette.primary + '18',
    },
    heroEmailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroEmail: {
      ...typography.caption,
      color: palette.textSecondary,
      flex: 1,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    accountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primary + '14',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 9999,
    },
    accountBadgeText: {
      ...typography.caption,
      fontSize: 11,
      color: palette.primary,
      fontWeight: '600',
    },
    memberSinceText: {
      ...typography.caption,
      fontSize: 11,
      color: palette.textDisabled,
    },
    switchAccountHeroBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: palette.primary + '14',
      borderWidth: 1,
      borderColor: palette.primary + '30',
    },
    switchAccountHeroText: {
      ...typography.caption,
      fontSize: 12,
      color: palette.primary,
      fontWeight: '700',
    },
    accountCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primary + '14',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 9999,
    },
    accountCountText: {
      ...typography.caption,
      fontSize: 11,
      color: palette.primary,
      fontWeight: '600',
    },
    accountSwitchCard: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: 'hidden',
      marginBottom: 10,
    },
    accountSwitchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    accountSwitchIconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountSwitchInfo: {
      flex: 1,
      gap: 2,
    },
    accountSwitchLabel: {
      ...typography.body,
      fontWeight: '700',
      color: palette.text,
      fontSize: 15,
    },
    accountSwitchSubLabel: {
      ...typography.caption,
      color: palette.textSecondary,
      fontSize: 12,
    },
    accountSwitchActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: palette.primary + '18',
    },
    accountSwitchActionPillText: {
      ...typography.caption,
      color: palette.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    // Sections
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      marginBottom: 2,
    },
    sectionTitle: {
      ...typography.label,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 2,
    },
    sectionDescription: {
      ...typography.caption,
      color: palette.textSecondary,
      marginBottom: 6,
      lineHeight: 18,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      backgroundColor: palette.border,
      marginHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
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
      ...typography.body,
      color: palette.text,
      fontWeight: '600',
    },
    rowSub: {
      ...typography.caption,
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
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surfaceAlt,
    },
    conditionChipActive: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    conditionChipText: {
      ...typography.caption,
      color: palette.text,
      fontWeight: '600',
    },
    conditionChipTextActive: {
      color: '#FFFFFF',
    },
    addConditionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 9999,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: palette.primary,
      backgroundColor: palette.primary + '10',
    },
    addConditionText: {
      ...typography.caption,
      color: palette.primary,
      fontWeight: '700',
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
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surfaceAlt,
    },
    segSmall: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surfaceAlt,
    },
    segActive: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    segIcon: {
      fontSize: 14,
    },
    segLabel: {
      ...typography.small,
      color: palette.textSecondary,
      fontWeight: '600',
    },
    segLabelActive: {
      color: '#FFFFFF',
    },
    // Danger Zone
    dangerCard: {
      borderColor: palette.error + '44',
      backgroundColor: palette.error + '08',
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
      color: palette.error,
    },
    dangerSub: {
      ...typography.caption,
      color: palette.error + 'BB',
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
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
    modalTitle: {
      ...typography.h3,
      color: palette.text,
      fontWeight: '700',
    },
    modalDesc: {
      ...typography.caption,
      color: palette.textSecondary,
      lineHeight: 18,
    },
    modalInput: {
      backgroundColor: palette.surfaceAlt,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: palette.text,
      ...typography.body,
      marginTop: 6,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 8,
    },
    modalCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: palette.surfaceAlt,
    },
    modalCancelText: {
      ...typography.body,
      color: palette.textSecondary,
      fontWeight: '600',
    },
    modalSaveBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: palette.primary,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
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
      ...typography.caption,
      color: palette.textSecondary,
      fontWeight: '600',
      fontSize: 12,
    },
    vitalFieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surfaceAlt,
      borderWidth: 1.5,
      borderColor: palette.border,
      borderRadius: 12,
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
      ...typography.caption,
      color: palette.textDisabled,
      fontWeight: '700',
      fontSize: 12,
      marginLeft: 6,
    },
    vitalsActionRow: {
      padding: 16,
    },
    saveVitalsButton: {
      backgroundColor: palette.primary,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveVitalsButtonSuccess: {
      backgroundColor: '#10B981',
    },
    saveVitalsButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
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
      backgroundColor: '#10B9811A',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    savedPillText: {
      ...typography.caption,
      color: '#10B981',
      fontWeight: '700',
      fontSize: 11,
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
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
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
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    passwordActionBtnText: {
      ...typography.button,
      color: '#FFFFFF',
      fontSize: 14,
    },
    elevateNoticeBox: {
      backgroundColor: palette.surfaceAlt,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      gap: 10,
    },
    elevateNoticeText: {
      ...typography.caption,
      color: palette.textSecondary,
      lineHeight: 16,
    },
    elevateBtn: {
      backgroundColor: palette.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
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

/**
 * InitialPermissionsModal — Displayed once on the user's very first app launch after installation.
 * Educates the user on why Lumen uses Notifications, Location, and Camera before prompting,
 * resulting in significantly higher grant rates and full transparency.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  MapPin,
  Camera,
  CheckCircle2,
  Sparkles,
  Shield,
  ArrowRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { permissionService } from '../../services/permissionService';
import { LumenLogo } from '../common/LumenLogo';

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export function InitialPermissionsModal({ visible, onComplete }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEnableAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    try {
      await permissionService.requestAllInitialPermissions();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await permissionService.markInitialPrimerCompleted();
    onComplete();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header Icon & Title */}
            <View style={styles.header}>
              <LumenLogo variant="badge" size={64} style={styles.logoBadge} />
              <Text style={styles.title}>Welcome to Lumen</Text>
              <Text style={styles.subtitle}>
                To give you the most accurate daily wellness & symptom tracking, Lumen uses a few device permissions:
              </Text>
            </View>

            {/* Permission Items List */}
            <View style={styles.permissionsList}>
              {/* 1. Notifications */}
              <View style={styles.permItem}>
                <View style={[styles.permIconBadge, { backgroundColor: '#3B82F618' }]}>
                  <Bell size={20} color="#3B82F6" strokeWidth={2.2} />
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>Reminders & Alarms</Text>
                  <Text style={styles.permDesc}>
                    Timely alerts for medication, hydration check-ins, and symptom prompts.
                  </Text>
                </View>
              </View>

              {/* 2. Location */}
              <View style={styles.permItem}>
                <View style={[styles.permIconBadge, { backgroundColor: '#10B98118' }]}>
                  <MapPin size={20} color="#10B981" strokeWidth={2.2} />
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>Walking & Exercise Location</Text>
                  <Text style={styles.permDesc}>
                    GPS distance, path mapping, and pace calculation during outdoor walking.
                  </Text>
                </View>
              </View>

              {/* 3. Camera & Photos */}
              <View style={styles.permItem}>
                <View style={[styles.permIconBadge, { backgroundColor: '#F59E0B18' }]}>
                  <Camera size={20} color="#F59E0B" strokeWidth={2.2} />
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>Symptom & Stool Photos</Text>
                  <Text style={styles.permDesc}>
                    Attach photos of skin rashes, swelling, or stool logs for private tracking.
                  </Text>
                </View>
              </View>
            </View>

            {/* Privacy Promise */}
            <View style={styles.privacyBanner}>
              <Shield size={16} color={palette.primaryText} />
              <Text style={styles.privacyText}>
                Your health data is completely private and never shared with third parties.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.enableBtn}
                onPress={handleEnableAll}
                disabled={isProcessing}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.enableBtnText}>Enable Permissions</Text>
                    <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipBtn}
                onPress={handleSkip}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.skipBtnText}>I'll choose as I go</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: palette.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: palette.primary + '18',
    borderWidth: 1.5,
    borderColor: palette.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13.5,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  permissionsList: {
    gap: 12,
    marginBottom: 18,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  permIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permInfo: {
    flex: 1,
  },
  permTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.text,
    marginBottom: 2,
  },
  permDesc: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    lineHeight: 17,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.primary + '12',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.primary + '25',
  },
  privacyText: {
    ...typography.caption,
    fontSize: 11.5,
    color: palette.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  actions: {
    gap: 8,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  enableBtnText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  skipBtnText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
  },
}));

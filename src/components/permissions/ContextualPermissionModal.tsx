/**
 * ContextualPermissionModal — Just-In-Time (JIT) permission prompt.
 * Displayed when a user triggers a specific feature without the needed permission
 * (e.g. Start Walking -> Location, Add/Toggle Reminder -> Notifications, Take Photo -> Camera).
 * Handles both initial direct OS prompts and "Open System Settings" if permanently blocked.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  MapPin,
  Bell,
  Camera,
  Image,
  ExternalLink,
  CheckCircle2,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import {
  PermissionType,
  PERMISSION_METADATA,
  permissionService,
} from '../../services/permissionService';

interface Props {
  visible: boolean;
  permissionType: PermissionType;
  onGranted: () => void;
  onDismiss: () => void;
}

export function ContextualPermissionModal({
  visible,
  permissionType,
  onGranted,
  onDismiss,
}: Props) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const meta = PERMISSION_METADATA[permissionType];

  useEffect(() => {
    if (visible) {
      // Check whether this permission is already permanently blocked
      permissionService.checkPermission(permissionType).then((res) => {
        if (!res.granted && !res.canAskAgain) {
          setIsPermanentlyDenied(true);
        } else {
          setIsPermanentlyDenied(false);
        }
      });
    }
  }, [visible, permissionType]);

  const handleRequestOrOpenSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRequesting(true);

    try {
      if (isPermanentlyDenied) {
        // Deep link to device App Settings
        await permissionService.openAppSettings();
        onDismiss();
      } else {
        // Trigger OS permission dialog
        const res = await permissionService.requestPermission(permissionType);
        if (res.granted) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onGranted();
        } else if (!res.canAskAgain) {
          setIsPermanentlyDenied(true);
        }
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const renderIcon = () => {
    switch (permissionType) {
      case 'location':
        return <MapPin size={34} color={palette.primaryText} strokeWidth={2.2} />;
      case 'notifications':
        return <Bell size={34} color={palette.primaryText} strokeWidth={2.2} />;
      case 'camera':
        return <Camera size={34} color={palette.primaryText} strokeWidth={2.2} />;
      case 'mediaLibrary':
        return <Image size={34} color={palette.primaryText} strokeWidth={2.2} />;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
          >
            <X size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Icon Badge */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBadge}>
              {renderIcon()}
            </View>
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.description}>{meta.description}</Text>

          {/* Benefit Box */}
          <View style={styles.benefitBox}>
            <View style={styles.benefitHeader}>
              <ShieldCheck size={16} color={palette.primaryText} />
              <Text style={styles.benefitTitle}>Why Lumen uses this:</Text>
            </View>
            <Text style={styles.benefitText}>{meta.benefit}</Text>
          </View>

          {/* Permanently Denied Guidance Note */}
          {isPermanentlyDenied && (
            <View style={styles.settingsTipBox}>
              <ExternalLink size={14} color="#F59E0B" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTipTitle}>Permission is currently disabled</Text>
                <Text style={styles.settingsTipText}>
                  Please enable it in Settings: {meta.settingsTip}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleRequestOrOpenSettings}
              disabled={isRequesting}
              activeOpacity={0.85}
            >
              {isPermanentlyDenied && (
                <ExternalLink size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.primaryBtnText}>
                {isPermanentlyDenied
                  ? 'Open Phone Settings'
                  : `Allow ${meta.shortName}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyles((palette) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: palette.primary + '18',
    borderWidth: 1.5,
    borderColor: palette.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    ...typography.body,
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitBox: {
    width: '100%',
    backgroundColor: palette.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  benefitTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: palette.text,
    fontSize: 12,
  },
  benefitText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  settingsTipBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  settingsTipTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: '#D97706',
    fontSize: 11.5,
    marginBottom: 2,
  },
  settingsTipText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  buttonStack: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryBtnText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
}));

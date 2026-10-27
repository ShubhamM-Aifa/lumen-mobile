import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Check,
  Plus,
  Trash2,
  X,
  LogOut,
  Mail,
  Lock,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useAuthStore, SavedAccount } from '../../store/authStore';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSwitched?: () => void;
}

export function AccountSwitcherModal({ visible, onClose, onSwitched }: Props) {
  const { palette, colorScheme } = useTheme();
  const styles = useStyles();
  const isDark = colorScheme === 'dark';

  const {
    user: currentUser,
    savedAccounts,
    switchAccount,
    addAccount,
    addGoogleAccount,
    removeAccount,
    logoutAll,
  } = useAuthStore();

  const { signInWithGoogle, googleLoading, googleReady } = useGoogleAuth();

  // Add account form state
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);

  const resetAddForm = () => {
    setEmail('');
    setPassword('');
    setIsAddingAccount(false);
  };

  const handleClose = () => {
    resetAddForm();
    onClose();
  };

  const handleSwitch = async (account: SavedAccount) => {
    if (account.userId === currentUser?._id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSwitchingUserId(account.userId);
    try {
      await switchAccount(account.userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (onSwitched) onSwitched();
      handleClose();
    } catch (err: any) {
      Alert.alert('Switch failed', err?.message || 'Failed to switch account.');
    } finally {
      setSwitchingUserId(null);
    }
  };

  const handleRemove = (account: SavedAccount) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Remove Account',
      `Are you sure you want to remove ${account.email} from this device? Its saved login session will be cleared.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(account.userId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (savedAccounts.length <= 1) {
                handleClose();
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove account.');
            }
          },
        },
      ],
    );
  };

  const handleAddEmailAccount = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Required Fields', 'Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addAccount(trimmedEmail, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetAddForm();
      if (onSwitched) onSwitched();
      handleClose();
    } catch (err: any) {
      Alert.alert('Sign In Failed', err?.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddGoogleAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    signInWithGoogle(
      () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        resetAddForm();
        if (onSwitched) onSwitched();
        handleClose();
      },
      async (idToken: string) => {
        await addGoogleAccount(idToken);
      },
    );
  };

  const handleLogoutAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Log Out All Accounts',
      'This will log out every saved account on this device and return to the login screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutAll();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to log out all accounts.');
            }
          },
        },
      ],
    );
  };

  // Combine current user with saved accounts
  const allAccounts = React.useMemo(() => {
    const map = new Map<string, SavedAccount>();
    if (currentUser) {
      map.set(currentUser._id, {
        userId: currentUser._id,
        email: currentUser.email,
        name: currentUser.name,
        authMethod: (currentUser as any).authMethod,
        hasPassword: (currentUser as any).hasPassword,
        lastActiveAt: new Date().toISOString(),
      });
    }
    for (const a of savedAccounts) {
      map.set(a.userId, a);
    }
    return Array.from(map.values());
  }, [currentUser, savedAccounts]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.sheetContainer}>
          {/* Top handle bar */}
          <View style={styles.handleBar} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <Users size={18} color={palette.primaryText} />
              </View>
              <Text style={styles.headerTitle}>Switch Account</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close account switcher"
            >
              <X size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Accounts List */}
            <View style={styles.accountsSection}>
              {allAccounts.map(account => {
                const isActive = account.userId === currentUser?._id;
                const isSwitching = switchingUserId === account.userId;
                const initials = account.name
                  ? account.name
                      .split(' ')
                      .filter(Boolean)
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'U';

                return (
                  <View
                    key={account.userId}
                    style={[
                      styles.accountCard,
                      isActive && styles.accountCardActive,
                    ]}
                  >
                    <View style={styles.accountCardLeft}>
                      <LinearGradient
                        colors={
                          isActive
                            ? ['#FFA448', '#FF581E']
                            : isDark
                            ? ['#334155', '#1E293B']
                            : ['#E2E8F0', '#CBD5E1']
                        }
                        style={styles.accountAvatar}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            !isActive && { color: palette.text },
                          ]}
                        >
                          {initials}
                        </Text>
                      </LinearGradient>

                      <View style={styles.accountMeta}>
                        <View style={styles.accountNameRow}>
                          <Text style={styles.accountName} numberOfLines={1}>
                            {account.name || 'Member'}
                          </Text>
                          {isActive && (
                            <View style={styles.activePill}>
                              <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              <Text style={styles.activePillText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.accountEmail} numberOfLines={1}>
                          {account.email}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.accountCardRight}>
                      {!isActive ? (
                        <View style={styles.inactiveActionsRow}>
                          <TouchableOpacity
                            style={styles.switchBtn}
                            onPress={() => handleSwitch(account)}
                            disabled={isSwitching}
                            accessibilityRole="button"
                            accessibilityLabel={`Switch to ${account.email}`}
                          >
                            {isSwitching ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <ArrowRightLeft size={12} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={styles.switchBtnText}>Switch</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => handleRemove(account)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove account ${account.email}`}
                          >
                            <Trash2 size={13} color={palette.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Add Another Account Toggle Button */}
            {!isAddingAccount ? (
              <TouchableOpacity
                style={styles.addAccountBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsAddingAccount(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add another account"
              >
                <View style={styles.addIconCircle}>
                  <Plus size={16} color={palette.primaryText} strokeWidth={2.4} />
                </View>
                <Text style={styles.addAccountBtnText}>Add another account</Text>
              </TouchableOpacity>
            ) : (
              /* Inline Add Account Form */
              <View style={styles.addFormCard}>
                <View style={styles.addFormHeader}>
                  <Text style={styles.addFormTitle}>Add Account</Text>
                  <TouchableOpacity
                    style={styles.addFormCancelBtn}
                    onPress={() => setIsAddingAccount(false)}
                  >
                    <Text style={styles.addFormCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {/* Email Input */}
                <View style={styles.inputWrapper}>
                  <Mail size={15} color={palette.textSecondary} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={palette.placeholder}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputWrapper}>
                  <Lock size={15} color={palette.textSecondary} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={palette.placeholder}
                    secureTextEntry
                  />
                </View>

                {/* Sign In & Add Button */}
                <TouchableOpacity
                  style={[styles.submitAddBtn, isSubmitting && { opacity: 0.7 }]}
                  onPress={handleAddEmailAccount}
                  disabled={isSubmitting || googleLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in and add account"
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitAddBtnText}>Sign In & Add</Text>
                  )}
                </TouchableOpacity>

                {/* Google Sign-In Option */}
                {googleReady && (
                  <View style={styles.googleSection}>
                    <View style={styles.orRow}>
                      <View style={styles.orLine} />
                      <Text style={styles.orText}>OR</Text>
                      <View style={styles.orLine} />
                    </View>

                    <TouchableOpacity
                      style={styles.googleBtn}
                      onPress={handleAddGoogleAccount}
                      disabled={isSubmitting || googleLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Google"
                    >
                      {googleLoading ? (
                        <ActivityIndicator size="small" color={palette.text} />
                      ) : (
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Log Out All Accounts Action */}
            {allAccounts.length > 1 && (
              <TouchableOpacity
                style={styles.logoutAllBtn}
                onPress={handleLogoutAll}
                accessibilityRole="button"
                accessibilityLabel="Log out of all accounts"
              >
                <LogOut size={14} color="#EF4444" />
                <Text style={styles.logoutAllText}>Log out of all accounts</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles(palette => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...Platform.select({
      web: { position: 'fixed' as any },
      default: { position: 'absolute' },
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '86%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${palette.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.bodyBold,
    fontSize: 17,
    color: palette.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  accountsSection: {
    gap: 10,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  accountCardActive: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}0C`,
  },
  accountCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  accountMeta: {
    flex: 1,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountName: {
    ...typography.bodyBold,
    fontSize: 14.5,
    color: palette.text,
    flexShrink: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  accountEmail: {
    ...typography.caption,
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
  },
  accountCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactiveActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  switchBtnText: {
    ...typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.border}80`,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}08`,
  },
  addIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${palette.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAccountBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.primaryText,
  },
  addFormCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  addFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  addFormTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: palette.text,
  },
  addFormCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addFormCancelText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: palette.text,
    height: '100%',
  },
  submitAddBtn: {
    backgroundColor: palette.primary,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitAddBtnText: {
    ...typography.bodyBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  googleSection: {
    gap: 10,
    marginTop: 4,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  orText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  googleBtn: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: palette.text,
  },
  logoutAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  logoutAllText: {
    ...typography.caption,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#EF4444',
  },
}));

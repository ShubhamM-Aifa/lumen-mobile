import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useAuthStore } from '../../src/store/authStore';
import { ApiError } from '../../src/api/client';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { LumenLogo } from '../../src/components/common/LumenLogo';

export default function LoginScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const { login, isLoading: authLoading } = useAuthStore();
  const { signInWithGoogle, googleReady, isLoading: googleLoading } = useGoogleAuth();
  const isLoading = authLoading || googleLoading;

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Please enter your email and password');
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/today');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      Alert.alert('Login failed', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoHeader}>
          <LumenLogo variant="badge" size={76} style={styles.logoBadge} />
          <Text style={styles.logo}>🌿 Lumen</Text>
          <Text style={styles.tagline}>Track symptoms, triggers & health patterns</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <ShieldCheck size={16} color={palette.primary} />
            <Text style={styles.badgeText}>Safe & Verified Access</Text>
          </View>
          <Text style={styles.cardTitle}>Sign in to Lumen</Text>
          <Text style={styles.cardSubtitle}>
            New here? Sign in with Google to create your account instantly. No passwords needed to start.
          </Text>

          {/* Primary Hero Google Sign-In */}
          <TouchableOpacity
            style={[styles.googleButton, (!googleReady || isLoading) && styles.buttonDisabled]}
            onPress={() => signInWithGoogle()}
            disabled={!googleReady || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <View style={styles.googleIconCircle}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.googleText}>
              {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Collapsible Email & Password Option */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowPasswordLogin(prev => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Toggle email and password sign in"
          >
            <View style={styles.accordionLeft}>
              <Mail size={16} color={palette.textSecondary} />
              <Text style={styles.accordionTitle}>Sign in with Email & Password</Text>
            </View>
            {showPasswordLogin ? (
              <ChevronUp size={18} color={palette.textSecondary} />
            ) : (
              <ChevronDown size={18} color={palette.textSecondary} />
            )}
          </TouchableOpacity>

          {showPasswordLogin && (
            <View style={styles.passwordForm}>
              <Text style={styles.passwordFormNotice}>
                For family members, caregivers, or shared access using the account password configured by the primary account owner.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Account Email"
                placeholderTextColor={palette.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={palette.placeholder}
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handlePasswordLogin}
                returnKeyType="go"
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handlePasswordLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with email and password"
              >
                <Text style={styles.buttonText}>{isLoading ? 'Signing in…' : 'Sign In'}</Text>
              </TouchableOpacity>

              <Text style={styles.forgotHint}>
                Forgot your password or haven’t set one yet? Tap <Text style={styles.linkBold} onPress={() => signInWithGoogle()}>Continue with Google</Text> above.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Lumen is a personal tracking tool, not a medical diagnostic device.{'\n'}
          Always discuss health decisions with your doctor.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 40 },
  logoHeader: { alignItems: 'center', marginBottom: 24 },
  logoBadge:  { marginBottom: 12 },
  logo:       { ...typography.h1, textAlign: 'center', marginBottom: 4, color: palette.text },
  tagline:    { ...typography.body, color: palette.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: palette.primary + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '600',
  },
  cardTitle: {
    ...typography.h2,
    color: palette.text,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: palette.primary,
    borderRadius: 14,
    padding: 16,
    minHeight: 54,
    marginTop: 4,
  },
  googleIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    ...typography.caption,
    color: palette.textDisabled,
    textTransform: 'uppercase',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  passwordForm: {
    gap: 12,
    paddingTop: 4,
  },
  passwordFormNotice: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 16,
  },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    ...typography.body,
    color: palette.text,
    minHeight: 48,
  },
  button: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  buttonText: {
    ...typography.button,
    color: palette.primary,
  },
  forgotHint: {
    ...typography.caption,
    color: palette.textDisabled,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  linkBold: {
    color: palette.primary,
    fontWeight: '700',
  },
  disclaimer: {
    ...typography.caption,
    color: palette.textDisabled,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 18,
  },
}));


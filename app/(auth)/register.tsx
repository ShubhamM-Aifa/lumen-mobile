import React from 'react';
import {
  View, Text, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react-native';
import { safeGoBack } from '../../src/utils/navigation';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';
import { LumenLogo } from '../../src/components/common/LumenLogo';

export default function RegisterScreen() {
  const { palette } = useTheme();
  const styles = useStyles();
  const { signInWithGoogle, googleReady, isLoading } = useGoogleAuth();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => safeGoBack('/(auth)/login')}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back to Sign In"
        >
          <ArrowLeft size={20} color={palette.textSecondary} />
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.logoHeader}>
          <LumenLogo variant="badge" size={64} style={styles.logoBadge} />
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.sub}>
            Lumen uses verified Google Sign-In for all new accounts to keep your health data private and secured.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.benefitRow}>
            <ShieldCheck size={20} color={palette.primary} />
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>Zero Password Headaches</Text>
              <Text style={styles.benefitDesc}>Get started instantly with a single tap using your Google account.</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <Sparkles size={20} color={palette.primary} />
            <View style={styles.benefitTextCol}>
              <Text style={styles.benefitTitle}>Optional Local Password</Text>
              <Text style={styles.benefitDesc}>Once signed in, you can configure an account password anytime in Settings to also log in with email.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (!googleReady || isLoading) && styles.buttonDisabled]}
            onPress={() => signInWithGoogle()}
            disabled={!googleReady || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <View style={styles.googleIconCircle}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.buttonText}>
              {isLoading ? 'Connecting to Google…' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="link"
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkBold}>Sign in here</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in you acknowledge that Lumen is a personal tracking tool, not a medical diagnostic application.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles(palette => ({
  container: { flex: 1, backgroundColor: palette.background },
  scroll:    { flexGrow: 1, padding: 24, paddingTop: 50 },
  back:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText:  { ...typography.body, color: palette.textSecondary },
  logoHeader: { alignItems: 'center', marginBottom: 24 },
  logoBadge:  { marginBottom: 12 },
  heading:   { ...typography.h2, color: palette.text, textAlign: 'center', marginBottom: 8 },
  sub:       { ...typography.bodySmall, color: palette.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 20,
    gap: 18,
    marginVertical: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    ...typography.body,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 2,
  },
  benefitDesc: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: palette.primary,
    borderRadius: 14,
    padding: 16,
    minHeight: 52,
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  googleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4285F4',
  },
  buttonText: { ...typography.button, color: '#FFFFFF', fontSize: 16 },
  link: { alignItems: 'center', marginTop: 12 },
  linkText: { ...typography.body, color: palette.textSecondary },
  linkBold: { color: palette.primary, fontWeight: '700' },
  disclaimer: {
    ...typography.caption,
    color: palette.textDisabled,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
}));

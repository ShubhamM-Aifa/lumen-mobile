import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  X,
  MapPin,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Thermometer,
  Droplets,
  Sun,
  Wind,
  Gauge,
  Info,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { useWeatherStore } from '../../store/weatherStore';
import { PressableScale } from '../common/PressableScale';

interface WeatherReportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WeatherReportModal({ visible, onClose }: WeatherReportModalProps) {
  const { palette } = useTheme();
  const styles = useStyles();

  const {
    weather,
    assessment,
    isLoading,
    isRefreshing,
    error,
    permissionStatus,
    lastFetched,
    fetchWeather,
    requestPermissionAndFetch,
  } = useWeatherStore();

  const [refreshSpinning, setRefreshSpinning] = useState(false);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshSpinning(true);
    await fetchWeather({ force: true, isUserRefresh: true });
    setRefreshSpinning(false);
  };

  const handleEnableLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await requestPermissionAndFetch();
  };

  const getRiskColor = (risk?: 'low' | 'moderate' | 'high') => {
    switch (risk) {
      case 'high':
        return '#EF4444';
      case 'moderate':
        return '#F59E0B';
      default:
        return '#10B981';
    }
  };

  const getRiskLabel = (risk?: 'low' | 'moderate' | 'high') => {
    switch (risk) {
      case 'high':
        return 'High Flare Trigger Potential';
      case 'moderate':
        return 'Moderate Environmental Sensitivity';
      default:
        return 'Low Environmental Flare Risk';
    }
  };

  const formattedTime = lastFetched
    ? new Date(lastFetched).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.locationHeader}>
              <View style={styles.locationIconWrap}>
                <MapPin size={18} color={palette.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityText} numberOfLines={1}>
                  {weather?.cityName || 'Detecting Location...'}
                </Text>
                {weather?.regionName ? (
                  <Text style={styles.regionText} numberOfLines={1}>
                    {weather.regionName} {formattedTime ? `• ${formattedTime}` : ''}
                  </Text>
                ) : formattedTime ? (
                  <Text style={styles.regionText}>Updated {formattedTime}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={handleRefresh}
                disabled={isLoading || isRefreshing}
                accessibilityRole="button"
                accessibilityLabel="Refresh live weather"
              >
                {isRefreshing || refreshSpinning ? (
                  <ActivityIndicator size="small" color={palette.primaryText} />
                ) : (
                  <RefreshCw size={17} color={palette.textSecondary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close weather report"
              >
                <X size={18} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content Area */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Permission Denied Fallback */}
            {permissionStatus === 'denied' && (
              <View style={styles.permissionBox}>
                <View style={[styles.permissionIconBadge, { backgroundColor: palette.primary + '18' }]}>
                  <MapPin size={32} color={palette.primaryText} />
                </View>
                <Text style={styles.permissionTitle}>Location Access Needed</Text>
                <Text style={styles.permissionDesc}>
                  Lumen tracks your local barometric pressure drops, humidity, and UV levels to protect you from sudden joint pain, fatigue, and autoimmune flare-ups.
                </Text>

                <PressableScale
                  style={[styles.primaryActionBtn, { backgroundColor: palette.primary }]}
                  onPress={handleEnableLocation}
                >
                  <Text style={styles.primaryActionBtnText}>Enable Location for Flare Alerts</Text>
                </PressableScale>
              </View>
            )}

            {/* Loading Spinner */}
            {isLoading && !weather && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={palette.primaryText} />
                <Text style={styles.loadingText}>Fetching hyper-local atmospheric conditions...</Text>
              </View>
            )}

            {/* Live Weather Report */}
            {weather && (
              <>
                {/* Main Hero Card */}
                <View style={styles.heroCard}>
                  <View style={styles.heroLeft}>
                    <Text style={styles.heroEmoji}>{weather.weatherEmoji}</Text>
                    <View>
                      <View style={styles.heroTempRow}>
                        <Text style={styles.heroTempText}>{weather.temperatureC}°</Text>
                        <Text style={styles.heroTempUnit}>C</Text>
                      </View>
                      <Text style={styles.heroConditionText}>{weather.weatherLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.heroRight}>
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatLabel}>Feels Like</Text>
                      <Text style={styles.heroStatVal}>{weather.apparentTemperatureC}°C</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStatItem}>
                      <Text style={styles.heroStatLabel}>High / Low</Text>
                      <Text style={styles.heroStatVal}>
                        {weather.tempMaxC}° / {weather.tempMinC}°
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Clinical Autoimmune Flare Trigger Assessment */}
                {assessment && (
                  <View
                    style={[
                      styles.riskAssessmentCard,
                      {
                        borderColor: getRiskColor(assessment.overallRisk) + '40',
                        backgroundColor: getRiskColor(assessment.overallRisk) + '10',
                      },
                    ]}
                  >
                    <View style={styles.riskHeaderRow}>
                      {assessment.overallRisk === 'low' ? (
                        <ShieldCheck size={20} color={getRiskColor(assessment.overallRisk)} />
                      ) : (
                        <AlertTriangle size={20} color={getRiskColor(assessment.overallRisk)} />
                      )}
                      <Text
                        style={[
                          styles.riskBadgeText,
                          { color: getRiskColor(assessment.overallRisk) },
                        ]}
                      >
                        {getRiskLabel(assessment.overallRisk)}
                      </Text>
                    </View>

                    <Text style={styles.actionableTipText}>{assessment.actionableTip}</Text>
                  </View>
                )}

                {/* Section Title */}
                <Text style={styles.sectionHeading}>Autoimmune Environmental Factors</Text>

                {/* Detailed Metrics Grid */}
                <View style={styles.metricsGrid}>
                  {/* Barometric Pressure Card */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#8B5CF618' }]}>
                        <Gauge size={18} color="#8B5CF6" />
                      </View>
                      <Text style={styles.metricTitle}>Barometric Pressure</Text>
                    </View>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValueMain}>{weather.pressureHpa}</Text>
                      <Text style={styles.metricValueUnit}> hPa</Text>
                    </View>
                    <View
                      style={[
                        styles.metricTag,
                        {
                          backgroundColor:
                            assessment?.pressureStatus === 'low'
                              ? '#EF444420'
                              : assessment?.pressureStatus === 'high'
                                ? '#3B82F620'
                                : '#10B98120',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.metricTagText,
                          {
                            color:
                              assessment?.pressureStatus === 'low'
                                ? '#EF4444'
                                : assessment?.pressureStatus === 'high'
                                  ? '#3B82F6'
                                  : '#10B981',
                          },
                        ]}
                      >
                        {assessment?.pressureStatus === 'low'
                          ? 'Low (Joint Alert)'
                          : assessment?.pressureStatus === 'high'
                            ? 'High Pressure'
                            : 'Normal / Stable'}
                      </Text>
                    </View>
                    <Text style={styles.metricCardNote}>
                      {assessment?.pressureDescription}
                    </Text>
                  </View>

                  {/* Relative Humidity Card */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#0284C718' }]}>
                        <Droplets size={18} color="#0284C7" />
                      </View>
                      <Text style={styles.metricTitle}>Relative Humidity</Text>
                    </View>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValueMain}>{weather.humidityPct}</Text>
                      <Text style={styles.metricValueUnit}>%</Text>
                    </View>
                    <View
                      style={[
                        styles.metricTag,
                        {
                          backgroundColor:
                            assessment?.humidityStatus === 'humid'
                              ? '#F59E0B20'
                              : assessment?.humidityStatus === 'dry'
                                ? '#6B728020'
                                : '#10B98120',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.metricTagText,
                          {
                            color:
                              assessment?.humidityStatus === 'humid'
                                ? '#F59E0B'
                                : assessment?.humidityStatus === 'dry'
                                  ? '#6B7280'
                                  : '#10B981',
                          },
                        ]}
                      >
                        {assessment?.humidityStatus === 'humid'
                          ? 'Humid (Stiffness Risk)'
                          : assessment?.humidityStatus === 'dry'
                            ? 'Dry Atmosphere'
                            : 'Optimal (Comfort)'}
                      </Text>
                    </View>
                    <Text style={styles.metricCardNote}>
                      {assessment?.humidityDescription}
                    </Text>
                  </View>

                  {/* UV Index Card */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#F9731618' }]}>
                        <Sun size={18} color="#F97316" />
                      </View>
                      <Text style={styles.metricTitle}>UV Radiation Index</Text>
                    </View>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValueMain}>{weather.uvIndexMax}</Text>
                      <Text style={styles.metricValueUnit}> / 11+</Text>
                    </View>
                    <View
                      style={[
                        styles.metricTag,
                        {
                          backgroundColor:
                            assessment?.uvStatus === 'extreme'
                              ? '#EF444420'
                              : assessment?.uvStatus === 'high'
                                ? '#F59E0B20'
                                : assessment?.uvStatus === 'moderate'
                                  ? '#3B82F620'
                                  : '#10B98120',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.metricTagText,
                          {
                            color:
                              assessment?.uvStatus === 'extreme'
                                ? '#EF4444'
                                : assessment?.uvStatus === 'high'
                                  ? '#F59E0B'
                                  : assessment?.uvStatus === 'moderate'
                                    ? '#3B82F6'
                                    : '#10B981',
                          },
                        ]}
                      >
                        UV Level: {assessment?.uvStatus?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.metricCardNote}>
                      {assessment?.uvDescription}
                    </Text>
                  </View>

                  {/* Wind & Circulation Card */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#10B98118' }]}>
                        <Wind size={18} color="#10B981" />
                      </View>
                      <Text style={styles.metricTitle}>Wind & Breeze</Text>
                    </View>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValueMain}>{weather.windSpeedKmh}</Text>
                      <Text style={styles.metricValueUnit}> km/h</Text>
                    </View>
                    <View style={[styles.metricTag, { backgroundColor: '#10B98120' }]}>
                      <Text style={[styles.metricTagText, { color: palette.successText }]}>
                        {weather.windSpeedKmh < 10
                          ? 'Light Breeze'
                          : weather.windSpeedKmh < 25
                            ? 'Moderate Wind'
                            : 'Breezy / Chilly'}
                      </Text>
                    </View>
                    <Text style={styles.metricCardNote}>
                      Wind chill can exacerbate Raynaud's syndrome and cold-induced joint stiffness. Dress warmly if outdoors.
                    </Text>
                  </View>
                </View>

                {/* Clinical Disclaimer */}
                <View style={styles.clinicalFooter}>
                  <Info size={14} color={palette.textSecondary} style={{ marginTop: 2 }} />
                  <Text style={styles.clinicalFooterText}>
                    Atmospheric pressure drops allow inflamed articular tissue to expand, which can stimulate intra-articular nerves. Always listen to your body and adjust physical activity.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Bottom Done Button */}
          <View style={styles.modalBottomBar}>
            <PressableScale
              style={[styles.doneBtn, { backgroundColor: palette.primary }]}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>Close Report</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  const { palette } = useTheme();

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    sheetContainer: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '92%',
      minHeight: '60%',
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 20,
    },
    handleBar: {
      width: 44,
      height: 4.5,
      borderRadius: 3,
      backgroundColor: palette.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: palette.border + '60',
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    locationIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cityText: {
      ...typography.h3,
      fontSize: 17,
      fontWeight: '600',
      color: palette.text,
      letterSpacing: -0.2,
    },
    regionText: {
      ...typography.caption,
      fontSize: 12,
      color: palette.textSecondary,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconCircleBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.surfaceAlt || palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 24,
    },
    heroCard: {
      backgroundColor: palette.surfaceAlt || palette.surface,
      borderRadius: 20,
      padding: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 16,
    },
    heroLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    heroEmoji: {
      fontSize: 44,
    },
    heroTempRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    heroTempText: {
      ...typography.h1,
      fontSize: 34,
      fontWeight: '700',
      color: palette.text,
      lineHeight: 40,
    },
    heroTempUnit: {
      ...typography.body,
      fontSize: 18,
      fontWeight: '500',
      color: palette.textSecondary,
      marginTop: 2,
    },
    heroConditionText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: '500',
      color: palette.textSecondary,
      marginTop: 1,
    },
    heroRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    heroStatItem: {
      alignItems: 'flex-end',
    },
    heroStatLabel: {
      ...typography.caption,
      fontSize: 11,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroStatVal: {
      ...typography.smallBold,
      fontSize: 13,
      fontWeight: '600',
      color: palette.text,
      marginTop: 1,
    },
    heroStatDivider: {
      height: 1,
      width: 50,
      backgroundColor: palette.border,
      marginVertical: 1,
    },
    riskAssessmentCard: {
      borderRadius: 18,
      padding: 16,
      borderWidth: 1.5,
      marginBottom: 20,
    },
    riskHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    riskBadgeText: {
      ...typography.bodyBold,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    actionableTipText: {
      ...typography.body,
      fontSize: 13,
      color: palette.text,
      lineHeight: 19,
    },
    sectionHeading: {
      ...typography.bodyBold,
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 12,
      letterSpacing: -0.2,
    },
    metricsGrid: {
      gap: 12,
      marginBottom: 18,
    },
    metricCard: {
      backgroundColor: palette.surfaceAlt || palette.surface,
      borderRadius: 16,
      padding: 15,
      borderWidth: 1,
      borderColor: palette.border,
    },
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 8,
    },
    metricIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricTitle: {
      ...typography.body,
      fontSize: 13,
      fontWeight: '500',
      color: palette.text,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    metricValueMain: {
      ...typography.h2,
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
    },
    metricValueUnit: {
      ...typography.body,
      fontSize: 14,
      fontWeight: '500',
      color: palette.textSecondary,
    },
    metricTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 3.5,
      borderRadius: 8,
      marginBottom: 8,
    },
    metricTagText: {
      ...typography.caption,
      fontSize: 11,
      fontWeight: '600',
    },
    metricCardNote: {
      ...typography.caption,
      fontSize: 12,
      color: palette.textSecondary,
      lineHeight: 17,
    },
    clinicalFooter: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    clinicalFooterText: {
      flex: 1,
      ...typography.caption,
      fontSize: 11,
      color: palette.textSecondary,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    modalBottomBar: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: palette.border + '60',
      backgroundColor: palette.surface,
    },
    doneBtn: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: {
      ...typography.button,
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    permissionBox: {
      alignItems: 'center',
      paddingVertical: 30,
      paddingHorizontal: 16,
    },
    permissionIconBadge: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    permissionTitle: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    permissionDesc: {
      ...typography.body,
      fontSize: 13,
      color: palette.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    primaryActionBtn: {
      width: '100%',
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionBtnText: {
      ...typography.button,
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    loadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      fontSize: 13,
      fontWeight: '500',
      color: palette.textSecondary,
    },
  });
}

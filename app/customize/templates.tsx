/**
 * Template library — browse and apply ready-made config bundles
 * and discover/publish community-created templates.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import { useConfigStore } from '../../src/store/configStore';
import { useTheme, createThemedStyles } from '../../src/theme/ThemeContext';
import { typography } from '../../src/theme/typography';
import type {
  TemplateCategory,
  TemplateQuickAction,
  ConditionBundle,
  ICommunityTemplate,
  CommunityTemplateCategory,
} from '@lumen/shared';

interface TemplateItem {
  key: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  questionCount?: number;
  optionCount?: number;
  isBundle?: boolean;
}

interface TemplatesResponse {
  categories: TemplateCategory[];
  quickActions: TemplateQuickAction[];
  conditionBundles: ConditionBundle[];
}

interface CommunityResponse {
  templates: ICommunityTemplate[];
  total: number;
}

const CONDITION_FILTERS = ['All', 'Long COVID', 'POTS', 'Migraine', 'IBS', 'Chronic Pain', 'Fatigue'];

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useStyles();
  const { config, invalidate, fetchConfig } = useConfigStore();

  // Navigation tab: 'curated' | 'community'
  const [activeTab, setActiveTab] = useState<'curated' | 'community'>('curated');

  // Curated templates state
  const [curatedTemplates, setCuratedTemplates] = useState<TemplateItem[]>([]);
  const [curatedApplied, setCuratedApplied] = useState<Set<string>>(new Set());
  const [curatedLoading, setCuratedLoading] = useState(true);
  const [curatedApplying, setCuratedApplying] = useState<string | null>(null);

  // Community templates state
  const [communityTemplates, setCommunityTemplates] = useState<ICommunityTemplate[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'likes'>('popular');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  // Preview Modal state
  const [previewTemplate, setPreviewTemplate] = useState<ICommunityTemplate | null>(null);

  // Publish Modal state
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [selectedCategoryToPublish, setSelectedCategoryToPublish] = useState<string>('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishTags, setPublishTags] = useState('');
  const [publishAnonymous, setPublishAnonymous] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Fetch curated library
  const loadCurated = useCallback(async () => {
    setCuratedLoading(true);
    try {
      const res = await api.get<TemplatesResponse>('/templates');
      const bundles: TemplateItem[] = (res.conditionBundles ?? []).map((b) => ({
        key: b.key,
        name: b.label,
        description: b.description,
        icon: b.icon,
        isBundle: true,
      }));

      const cats: TemplateItem[] = (res.categories ?? []).map((c) => ({
        key: c.templateKey,
        name: c.name,
        description: `${c.role === 'symptom' ? 'Symptoms' : c.role === 'trigger_candidate' ? 'Potential triggers' : 'Context'} · ${c.questions.length} question${c.questions.length !== 1 ? 's' : ''}`,
        icon: c.icon,
        color: c.color,
        questionCount: c.questions.length,
      }));

      setCuratedTemplates([...bundles, ...cats]);
    } catch (err: any) {
      console.warn('Failed to load curated templates', err);
    } finally {
      setCuratedLoading(false);
    }
  }, []);

  // Fetch community templates
  const loadCommunity = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const params = new URLSearchParams();
      if (communitySearch.trim()) params.append('q', communitySearch.trim());
      if (selectedCondition !== 'All') params.append('condition', selectedCondition);
      params.append('sort', sortBy);

      const res = await api.get<CommunityResponse>(`/templates/community?${params.toString()}`);
      setCommunityTemplates(res.templates ?? []);
    } catch (err: any) {
      console.warn('Failed to load community templates', err);
    } finally {
      setCommunityLoading(false);
    }
  }, [communitySearch, selectedCondition, sortBy]);

  useEffect(() => {
    loadCurated();
  }, [loadCurated]);

  useEffect(() => {
    if (activeTab === 'community') {
      loadCommunity();
    }
  }, [activeTab, loadCommunity]);

  // Apply curated item
  const applyCurated = async (item: TemplateItem) => {
    if (curatedApplied.has(item.key)) {
      Alert.alert('Already added', 'This template is already in your config. Any changes you made are preserved.');
      return;
    }
    Alert.alert(`Add "${item.name}"?`, item.description + '\n\nYou can edit or remove anything after adding it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add to My Log',
        style: 'default',
        onPress: async () => {
          setCuratedApplying(item.key);
          try {
            if (item.isBundle) {
              await api.post(`/templates/apply-bundle/${item.key}`, {});
            } else {
              await api.post('/templates/apply', { templateKeys: [item.key] });
            }
            setCuratedApplied((prev) => new Set([...prev, item.key]));
            invalidate();
            await fetchConfig();
            Alert.alert('Added Successfully', `"${item.name}" is now ready on your Today and Log screens.`);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not add template');
          } finally {
            setCuratedApplying(null);
          }
        },
      },
    ]);
  };

  // Install community template
  const installCommunity = async (tmpl: ICommunityTemplate) => {
    Alert.alert(
      `Install "${tmpl.title}"?`,
      `This will add ${tmpl.categories.length} category (${tmpl.categories.map((c) => c.name).join(', ')}) to your logging setup.\n\nYour existing logs and categories will remain untouched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Install Now',
          style: 'default',
          onPress: async () => {
            setInstallingId(tmpl._id);
            try {
              const res = await api.post<{ success: boolean; message?: string }>(
                `/templates/community/${tmpl._id}/install`,
                {},
              );
              invalidate();
              await fetchConfig();
              // Update local install count
              setCommunityTemplates((prev) =>
                prev.map((t) => (t._id === tmpl._id ? { ...t, installCount: t.installCount + 1 } : t)),
              );
              if (previewTemplate?._id === tmpl._id) {
                setPreviewTemplate(null);
              }
              Alert.alert('Template Installed! 🎉', res?.message || `"${tmpl.title}" was added to your logs.`);
            } catch (err: any) {
              Alert.alert('Installation failed', err?.message || 'Unable to install template');
            } finally {
              setInstallingId(null);
            }
          },
        },
      ],
    );
  };

  // Like community template
  const likeTemplate = async (tmpl: ICommunityTemplate) => {
    if (likedMap[tmpl._id]) return;
    setLikedMap((prev) => ({ ...prev, [tmpl._id]: true }));
    setCommunityTemplates((prev) =>
      prev.map((t) => (t._id === tmpl._id ? { ...t, likesCount: t.likesCount + 1 } : t)),
    );
    try {
      await api.post(`/templates/community/${tmpl._id}/like`, {});
    } catch {
      // Ignore background error
    }
  };

  // Report community template
  const reportTemplate = (tmpl: ICommunityTemplate) => {
    Alert.alert(
      'Report Template',
      `Are you sure you want to flag "${tmpl.title}" for review? Our moderation team investigates reported templates to maintain patient safety.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/templates/community/${tmpl._id}/report`, { reason: 'Inappropriate or harmful content' });
              Alert.alert('Report Received', 'Thank you. Our moderation team has flagged this template for safety review.');
            } catch (err: any) {
              Alert.alert('Report failed', err?.message || 'Error submitting report');
            }
          },
        },
      ],
    );
  };

  // Open Publish Modal
  const openPublishModal = (categoryId?: string) => {
    if (categoryId && config) {
      const cat = config.categories.find((c) => c._id === categoryId);
      if (cat) {
        setSelectedCategoryToPublish(cat._id);
        setPublishTitle(cat.name + ' Protocol');
        setPublishDescription(`Comprehensive logging questions and options for tracking ${cat.name.toLowerCase()}.`);
        setPublishTags(cat.name);
      }
    } else if (config?.categories && config.categories.length > 0) {
      const cat = config.categories[0];
      setSelectedCategoryToPublish(cat._id);
      setPublishTitle(cat.name + ' Protocol');
      setPublishDescription(`Comprehensive logging questions and options for tracking ${cat.name.toLowerCase()}.`);
      setPublishTags(cat.name);
    }
    setPublishModalVisible(true);
  };

  // Handle Publish Submit
  const handlePublishSubmit = async () => {
    if (!publishTitle.trim()) {
      Alert.alert('Title required', 'Please provide a clear title for your template.');
      return;
    }
    if (!publishDescription.trim()) {
      Alert.alert('Description required', 'Please describe how this template helps track health.');
      return;
    }
    if (!selectedCategoryToPublish || !config) {
      Alert.alert('Category required', 'Please select a category to publish.');
      return;
    }

    const cat = config.categories.find((c) => c._id === selectedCategoryToPublish);
    if (!cat) {
      Alert.alert('Error', 'Selected category not found.');
      return;
    }

    // Gather questions and options belonging to this category
    const catQuestions = config.questions.filter((q) => q.categoryId === cat._id && q.isActive);
    if (catQuestions.length === 0) {
      Alert.alert('No Questions Found', 'Please add questions to this category first before sharing it as a template.');
      return;
    }

    const compiledQuestions = catQuestions.map((q) => {
      const qOptions = config.options.filter((o) => o.questionId === q._id && o.isActive);
      return {
        title: q.title,
        helpText: q.helpText,
        icon: q.icon,
        selectionType: q.selectionType,
        allowOther: q.allowOther ?? false,
        required: q.required ?? false,
        frequency: q.frequency ?? 'anytime',
        options: qOptions.map((o) => ({
          label: o.label,
          icon: o.icon,
          color: o.color,
          allowComment: o.allowComment ?? false,
          captureTime: o.captureTime ?? 'none',
          fields: o.fields ?? [],
        })),
      };
    });

    const parsedTags = publishTags
      .split(/[,#]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (parsedTags.length === 0) {
      parsedTags.push(cat.name);
    }

    setIsPublishing(true);
    try {
      await api.post('/templates/community', {
        title: publishTitle.trim(),
        description: publishDescription.trim(),
        conditionTags: parsedTags.slice(0, 10),
        icon: cat.icon || '📋',
        color: cat.color || '#4A90E2',
        isAnonymous: publishAnonymous,
        categories: [
          {
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            role: cat.role,
            questions: compiledQuestions,
          },
        ],
      });

      setPublishModalVisible(false);
      setActiveTab('community');
      loadCommunity();
      Alert.alert('Published to Community! 🌍', `"${publishTitle.trim()}" is now publicly available for any user to add.`);
    } catch (err: any) {
      Alert.alert('Publish failed', err?.message || 'Could not publish template');
    } finally {
      setIsPublishing(false);
    }
  };

  // Render Curated Item
  const renderCuratedItem = ({ item }: { item: TemplateItem }) => {
    const isApplied = curatedApplied.has(item.key);
    const isApplying = curatedApplying === item.key;
    return (
      <TouchableOpacity
        style={[styles.card, isApplied && styles.cardApplied]}
        onPress={() => applyCurated(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} template`}
        disabled={isApplying}
      >
        <View style={[styles.iconWrap, { backgroundColor: (item.color ?? palette.primary) + '22' }]}>
          <Text style={styles.icon}>{item.icon}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardDesc}>{item.description}</Text>
          {(item.questionCount != null || item.optionCount != null) && (
            <Text style={styles.cardMeta}>
              {item.questionCount ? `${item.questionCount} questions` : ''}
              {item.questionCount && item.optionCount ? ' · ' : ''}
              {item.optionCount ? `${item.optionCount} options` : ''}
            </Text>
          )}
        </View>
        {isApplying ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : isApplied ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : (
          <Text style={styles.addBtn}>Add</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Render Community Card
  const renderCommunityCard = ({ item }: { item: ICommunityTemplate }) => {
    const isInstalling = installingId === item._id;
    const isLiked = !!likedMap[item._id];

    return (
      <View style={styles.communityCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: item.color + '22' }]}>
            <Text style={styles.icon}>{item.icon || '📋'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.title}
              </Text>
              {item.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.creatorText}>
              By {item.isAnonymous ? 'Anonymous Patient' : item.creatorDisplayName}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.cardDesc}>{item.description}</Text>

        {/* Tags */}
        <View style={styles.tagsRow}>
          {item.conditionTags.map((tag, idx) => (
            <View key={idx} style={styles.tagChip}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Text style={styles.statItem}>↓ {item.installCount.toLocaleString()} installs</Text>
          <Text style={styles.statDot}>·</Text>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={() => likeTemplate(item)}
            accessibilityRole="button"
          >
            <Text style={[styles.statItem, isLiked && styles.likedText]}>
              {isLiked ? '♥' : '♡'} {item.likesCount}
            </Text>
          </TouchableOpacity>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statItem}>
            {item.categories.length} category · {item.categories.reduce((acc, c) => acc + (c.questions?.length || 0), 0)} questions
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => reportTemplate(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.flagBtn}>⚐</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => setPreviewTemplate(item)}
            accessibilityRole="button"
          >
            <Text style={styles.previewBtnText}>👁️ Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.installBtn, isInstalling && styles.installBtnDisabled]}
            onPress={() => installCommunity(item)}
            disabled={isInstalling}
            accessibilityRole="button"
          >
            {isInstalling ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.installBtnText}>+ Add to My Log</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Templates & Protocols' }} />

      {/* Segmented Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'curated' && styles.tabButtonActive]}
          onPress={() => setActiveTab('curated')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'curated' }}
        >
          <Text style={[styles.tabText, activeTab === 'curated' && styles.tabTextActive]}>
            Curated Library
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'community' && styles.tabButtonActive]}
          onPress={() => setActiveTab('community')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'community' }}
        >
          <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>
            🌍 Community Hub
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: CURATED LIBRARY */}
      {activeTab === 'curated' && (
        <>
          {curatedLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={[styles.list, { paddingBottom: 60 + insets.bottom }]}
              ListHeaderComponent={
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>Clinically Designed Packs</Text>
                  <Text style={styles.headerSub}>
                    Ready-made categories vetted for chronic illness logging. Everything is fully customizable after adding.
                  </Text>

                  {curatedTemplates.filter((t) => t.isBundle).length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Condition starter packs</Text>
                      {curatedTemplates
                        .filter((t) => t.isBundle)
                        .map((b) => (
                          <TouchableOpacity
                            key={b.key}
                            style={[styles.bundleCard, curatedApplied.has(b.key) && styles.cardApplied]}
                            onPress={() => applyCurated(b)}
                            accessibilityRole="button"
                          >
                            <Text style={styles.bundleIcon}>{b.icon}</Text>
                            <View style={styles.cardText}>
                              <Text style={styles.bundleName}>{b.name}</Text>
                              <Text style={styles.cardDesc}>{b.description}</Text>
                            </View>
                            {curatedApplying === b.key ? (
                              <ActivityIndicator size="small" color={palette.primary} />
                            ) : curatedApplied.has(b.key) ? (
                              <Text style={styles.checkmark}>✓</Text>
                            ) : (
                              <Text style={styles.addBtn}>Add all</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                    </>
                  )}

                  {curatedTemplates.filter((t) => !t.isBundle).length > 0 && (
                    <Text style={styles.sectionLabel}>Individual symptom & trigger categories</Text>
                  )}
                </View>
              }
              data={curatedTemplates.filter((t) => !t.isBundle)}
              keyExtractor={(t) => t.key}
              renderItem={renderCuratedItem}
            />
          )}
        </>
      )}

      {/* TAB 2: COMMUNITY HUB */}
      {activeTab === 'community' && (
        <View style={{ flex: 1 }}>
          {/* Search Bar + Publish Header */}
          <View style={styles.communityHeader}>
            <View style={styles.searchBarContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search conditions (e.g. POTS, IBS)"
                placeholderTextColor={palette.textDisabled}
                value={communitySearch}
                onChangeText={setCommunitySearch}
                returnKeyType="search"
              />
              {communitySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCommunitySearch('')} style={styles.searchClearBtn}>
                  <Text style={styles.searchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Condition Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {CONDITION_FILTERS.map((cond) => {
                const isSelected = selectedCondition === cond;
                return (
                  <TouchableOpacity
                    key={cond}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                    onPress={() => setSelectedCondition(cond)}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>{cond}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sort & Share Bar */}
            <View style={styles.sortBar}>
              <View style={styles.sortOptions}>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === 'popular' && styles.sortBtnActive]}
                  onPress={() => setSortBy('popular')}
                >
                  <Text style={[styles.sortBtnText, sortBy === 'popular' && styles.sortBtnTextActive]}>Popular</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === 'recent' && styles.sortBtnActive]}
                  onPress={() => setSortBy('recent')}
                >
                  <Text style={[styles.sortBtnText, sortBy === 'recent' && styles.sortBtnTextActive]}>Recent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === 'likes' && styles.sortBtnActive]}
                  onPress={() => setSortBy('likes')}
                >
                  <Text style={[styles.sortBtnText, sortBy === 'likes' && styles.sortBtnTextActive]}>Most Liked</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.publishHeaderBtn}
                onPress={() => openPublishModal()}
                accessibilityRole="button"
              >
                <Text style={styles.publishHeaderBtnText}>+ Publish</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Community Template List */}
          {communityLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={[styles.communityList, { paddingBottom: 60 + insets.bottom }]}
              data={communityTemplates}
              keyExtractor={(t) => t._id}
              renderItem={renderCommunityCard}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>No templates found</Text>
                  <Text style={styles.emptySub}>
                    Try searching for another condition, or be the first patient to share your custom routine!
                  </Text>
                  <TouchableOpacity style={styles.emptyPublishBtn} onPress={() => openPublishModal()}>
                    <Text style={styles.emptyPublishBtnText}>+ Publish Your Routine</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ─────────────────────────────────────────────
          PREVIEW MODAL
      ───────────────────────────────────────────── */}
      <Modal
        visible={previewTemplate !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewTemplate(null)}
      >
        {previewTemplate && (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {previewTemplate.title}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Published by {previewTemplate.isAnonymous ? 'Anonymous Patient' : previewTemplate.creatorDisplayName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewTemplate(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Schema Details */}
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.previewDescription}>{previewTemplate.description}</Text>

              {/* Privacy / Safety Guarantee */}
              <View style={styles.safetyBanner}>
                <Text style={styles.safetyIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.safetyTitle}>Safe Installation Guarantee</Text>
                  <Text style={styles.safetyText}>
                    Installing this template will create new, standalone categories and questions. None of your existing logs or tracking history will ever be overwritten.
                  </Text>
                </View>
              </View>

              {/* Categories Preview */}
              <Text style={styles.previewSectionTitle}>Categories & Questions Included</Text>
              {previewTemplate.categories.map((cat: CommunityTemplateCategory, cIdx: number) => (
                <View key={cIdx} style={styles.previewCategoryCard}>
                  <View style={styles.previewCategoryHeader}>
                    <Text style={styles.previewCategoryIcon}>{cat.icon}</Text>
                    <Text style={styles.previewCategoryName}>{cat.name}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{cat.role}</Text>
                    </View>
                  </View>

                  {/* Questions */}
                  <View style={styles.previewQuestionsList}>
                    {cat.questions.map((q, qIdx) => (
                      <View key={qIdx} style={styles.previewQuestionItem}>
                        <Text style={styles.previewQuestionTitle}>
                          {qIdx + 1}. {q.title}
                        </Text>
                        {q.helpText ? <Text style={styles.previewQuestionHelp}>{q.helpText}</Text> : null}

                        {/* Options pills */}
                        <View style={styles.previewOptionsRow}>
                          {q.options.map((opt, oIdx) => (
                            <View key={oIdx} style={styles.previewOptionPill}>
                              {opt.icon ? <Text style={{ fontSize: 13, marginRight: 4 }}>{opt.icon}</Text> : null}
                              <Text style={styles.previewOptionText}>{opt.label}</Text>
                              {opt.fields && opt.fields.length > 0 && (
                                <Text style={styles.fieldBadge}>
                                  {' '}[{opt.fields.map((f) => f.label || f.key).join(', ')}]
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* Quick Actions Preview */}
              {previewTemplate.quickActions && previewTemplate.quickActions.length > 0 && (
                <>
                  <Text style={styles.previewSectionTitle}>Quick Actions Included</Text>
                  <View style={styles.previewQARow}>
                    {previewTemplate.quickActions.map((qa, qaIdx) => (
                      <View key={qaIdx} style={styles.previewQACard}>
                        <Text style={{ fontSize: 20 }}>{qa.icon}</Text>
                        <Text style={styles.previewQALabel}>{qa.label}</Text>
                        <Text style={styles.previewQAMode}>
                          {qa.mode} {qa.defaultValue ? `(${qa.defaultValue}${qa.unit ? ' ' + qa.unit : ''})` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Sticky Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalInstallBtn}
                onPress={() => installCommunity(previewTemplate)}
                accessibilityRole="button"
              >
                <Text style={styles.modalInstallBtnText}>+ Install Template into My Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────
          PUBLISH TEMPLATE MODAL
      ───────────────────────────────────────────── */}
      <Modal
        visible={publishModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPublishModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Publish Template</Text>
              <Text style={styles.modalSubtitle}>Share your custom logging questions with the Lumen community</Text>
            </View>
            <TouchableOpacity onPress={() => setPublishModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Select Category to Share *</Text>
            <View style={styles.categoryPickerList}>
              {config?.categories && config.categories.length > 0 ? (
                config.categories
                  .filter((c) => c.isActive)
                  .map((cat) => {
                    const isSelected = selectedCategoryToPublish === cat._id;
                    const questionCount = config.questions.filter((q) => q.categoryId === cat._id && q.isActive).length;
                    return (
                      <TouchableOpacity
                        key={cat._id}
                        style={[styles.categoryPickerItem, isSelected && styles.categoryPickerItemActive]}
                        onPress={() => {
                          setSelectedCategoryToPublish(cat._id);
                          setPublishTitle(cat.name + ' Routine');
                          setPublishDescription(`Custom questions and options for logging ${cat.name.toLowerCase()}.`);
                          setPublishTags(cat.name);
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.categoryPickerName, isSelected && styles.categoryPickerNameActive]}>
                            {cat.name}
                          </Text>
                          <Text style={styles.categoryPickerMeta}>{questionCount} questions ready to share</Text>
                        </View>
                        {isSelected ? <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })
              ) : (
                <Text style={styles.cardDesc}>No categories found in your setup.</Text>
              )}
            </View>

            {/* Template Title */}
            <Text style={styles.fieldLabel}>Template Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Long COVID & Brain Fog Pacing"
              placeholderTextColor={palette.textDisabled}
              value={publishTitle}
              onChangeText={setPublishTitle}
              maxLength={80}
            />

            {/* Template Description */}
            <Text style={styles.fieldLabel}>Description & Instructions *</Text>
            <TextInput
              style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Explain how this template helps, when to log, and what patterns to look for..."
              placeholderTextColor={palette.textDisabled}
              value={publishDescription}
              onChangeText={setPublishDescription}
              multiline
              maxLength={500}
            />

            {/* Condition Tags */}
            <Text style={styles.fieldLabel}>Condition Tags (comma separated)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Long COVID, POTS, Fatigue, Brain Fog"
              placeholderTextColor={palette.textDisabled}
              value={publishTags}
              onChangeText={setPublishTags}
            />

            {/* Privacy Switch */}
            <View style={styles.privacyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyLabel}>Publish Anonymously</Text>
                <Text style={styles.privacySub}>
                  {publishAnonymous ? 'Your account name will not be shown.' : 'Your profile name will appear as the creator.'}
                </Text>
              </View>
              <Switch
                value={publishAnonymous}
                onValueChange={setPublishAnonymous}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>

            {/* Privacy Guarantee Note */}
            <View style={styles.safetyBanner}>
              <Text style={styles.safetyIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyTitle}>Zero Health Data Is Shared</Text>
                <Text style={styles.safetyText}>
                  Lumen only exports the questions, option labels, and slider definitions. Your personal log entries, notes, photos, and health history remain 100% private on your device.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalInstallBtn, isPublishing && styles.installBtnDisabled]}
              onPress={handlePublishSubmit}
              disabled={isPublishing}
              accessibilityRole="button"
            >
              {isPublishing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalInstallBtnText}>🌍 Publish to Community</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  list: { padding: 16, paddingBottom: 40 },
  header: { gap: 8, marginBottom: 4 },
  headerTitle: { ...typography.h3, color: palette.text },
  headerSub: { ...typography.small, color: palette.textSecondary, marginBottom: 8 },
  sectionLabel: {
    ...typography.label,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },

  // Segmented Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: 6,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: palette.primary,
  },
  tabText: {
    ...typography.bodyBold,
    color: palette.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // Bundle & Curated Card
  bundleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.primary + '0E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.primary + '33',
    padding: 14,
    marginBottom: 8,
  },
  bundleIcon: { fontSize: 28 },
  bundleName: { ...typography.bodyBold, color: palette.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 8,
  },
  cardApplied: { borderColor: palette.success + '55', backgroundColor: palette.success + '08' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  cardText: { flex: 1 },
  cardName: { ...typography.bodyBold, color: palette.text, fontSize: 16, flexShrink: 1 },
  cardDesc: { ...typography.small, color: palette.textSecondary, marginTop: 3, lineHeight: 18 },
  cardMeta: { ...typography.caption, color: palette.textDisabled, marginTop: 4 },
  addBtn: { ...typography.bodyBold, color: palette.primary, paddingHorizontal: 4 },
  checkmark: { ...typography.h4, color: palette.success },

  // Community Hub Header & Search
  communityHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border + '60',
    paddingBottom: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: palette.text,
    height: '100%',
  },
  searchClearBtn: { padding: 4 },
  searchClearText: { color: palette.textDisabled, fontSize: 14 },

  // Condition Filter Pills
  filterScroll: { gap: 8, paddingVertical: 4 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterPillActive: {
    backgroundColor: palette.primary + '20',
    borderColor: palette.primary,
  },
  filterPillText: {
    ...typography.small,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },

  // Sort & Share Bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortOptions: { flexDirection: 'row', gap: 6 },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sortBtnActive: {
    backgroundColor: palette.border + '50',
  },
  sortBtnText: {
    ...typography.caption,
    color: palette.textDisabled,
  },
  sortBtnTextActive: {
    color: palette.text,
    fontWeight: '700',
  },
  publishHeaderBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  publishHeaderBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Community List & Cards
  communityList: { padding: 16, paddingBottom: 60, gap: 14 },
  communityCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  verifiedBadge: {
    flexShrink: 0,
    backgroundColor: '#059669' + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#059669' + '50',
  },
  verifiedText: { ...typography.caption, color: '#059669', fontWeight: '700', fontSize: 10 },
  creatorText: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: palette.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tagText: { ...typography.caption, color: palette.primary, fontSize: 11 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statItem: { ...typography.caption, color: palette.textSecondary, fontSize: 12 },
  statDot: { color: palette.textDisabled },
  likeBtn: { paddingVertical: 2 },
  likedText: { color: '#E11D48', fontWeight: '700' },
  flagBtn: { color: palette.textDisabled, fontSize: 13, paddingHorizontal: 4 },

  // Card Actions
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  previewBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  previewBtnText: { ...typography.small, color: palette.text, fontWeight: '600' },
  installBtn: {
    flex: 1.4,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  installBtnDisabled: { opacity: 0.6 },
  installBtnText: { ...typography.small, color: '#FFFFFF', fontWeight: '700' },

  // Empty State
  emptyContainer: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { ...typography.h4, color: palette.text },
  emptySub: { ...typography.small, color: palette.textSecondary, textAlign: 'center', maxWidth: 280 },
  emptyPublishBtn: {
    marginTop: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyPublishBtnText: { ...typography.bodyBold, color: '#FFFFFF' },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: palette.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  modalTitle: { ...typography.h4, color: palette.text },
  modalSubtitle: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: palette.textSecondary },
  modalScroll: { padding: 16, gap: 16, paddingBottom: 100 },
  previewDescription: { ...typography.body, color: palette.text, lineHeight: 22 },
  safetyBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: palette.primary + '12',
    borderWidth: 1,
    borderColor: palette.primary + '30',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  safetyIcon: { fontSize: 20 },
  safetyTitle: { ...typography.bodyBold, color: palette.text, fontSize: 13 },
  safetyText: { ...typography.caption, color: palette.textSecondary, marginTop: 2, lineHeight: 16 },
  previewSectionTitle: { ...typography.bodyBold, color: palette.text, marginTop: 6 },
  previewCategoryCard: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 10,
  },
  previewCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewCategoryIcon: { fontSize: 20 },
  previewCategoryName: { ...typography.bodyBold, color: palette.text, flex: 1 },
  roleBadge: {
    backgroundColor: palette.border + '60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: { ...typography.caption, color: palette.textSecondary, textTransform: 'capitalize' },
  previewQuestionsList: { gap: 10 },
  previewQuestionItem: {
    borderTopWidth: 1,
    borderTopColor: palette.border + '50',
    paddingTop: 8,
    gap: 4,
  },
  previewQuestionTitle: { ...typography.small, color: palette.text, fontWeight: '600' },
  previewQuestionHelp: { ...typography.caption, color: palette.textSecondary },
  previewOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  previewOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewOptionText: { ...typography.caption, color: palette.text },
  fieldBadge: { ...typography.caption, color: palette.primary, fontSize: 10 },
  previewQARow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewQACard: {
    backgroundColor: palette.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    minWidth: 90,
  },
  previewQALabel: { ...typography.caption, color: palette.text, fontWeight: '600', marginTop: 4 },
  previewQAMode: { ...typography.caption, color: palette.textSecondary, fontSize: 10 },

  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  modalInstallBtn: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalInstallBtnText: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 16 },

  // Publish Form Styles
  fieldLabel: { ...typography.small, color: palette.text, fontWeight: '600', marginTop: 4 },
  textInput: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
    color: palette.text,
  },
  categoryPickerList: { gap: 8 },
  categoryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 10,
  },
  categoryPickerItemActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary + '10',
  },
  categoryPickerName: { ...typography.bodyBold, color: palette.text },
  categoryPickerNameActive: { color: palette.primary },
  categoryPickerMeta: { ...typography.caption, color: palette.textSecondary },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  privacyLabel: { ...typography.bodyBold, color: palette.text },
  privacySub: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
}));

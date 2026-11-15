import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface BacklinkItem {
  _id: string;
  title: string;
  icon?: string;
  kind?: string;
}

interface BacklinksSectionProps {
  backlinks?: BacklinkItem[];
  onOpenPage: (id: string) => void;
}

export const BacklinksSection: React.FC<BacklinksSectionProps> = ({
  backlinks,
  onOpenPage,
}) => {
  const { palette } = useTheme();

  if (!backlinks || backlinks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { borderTopColor: palette.border }]}>
      <View style={styles.header}>
        <Link2 size={15} color={palette.textSecondary} />
        <Text style={[styles.headerTitle, { color: palette.textSecondary }]}>
          Linked from ({backlinks.length})
        </Text>
      </View>

      <View style={styles.linksGrid}>
        {backlinks.map((link) => (
          <TouchableOpacity
            key={link._id}
            style={[
              styles.card,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}
            onPress={() => onOpenPage(link._id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open note ${link.title}`}
          >
            <Text style={styles.icon}>{link.icon || '📄'}</Text>
            <Text
              style={[styles.title, { color: palette.text }]}
              numberOfLines={1}
            >
              {link.title || 'Untitled'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '48%',
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
});


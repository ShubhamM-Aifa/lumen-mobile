import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight, FileText, Home } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { INoteBreadcrumb } from '../../shared/types';

interface BreadcrumbsBarProps {
  breadcrumbs?: INoteBreadcrumb[];
  currentTitle: string;
  onNavigate: (id: string) => void;
  onHomePress: () => void;
}

export const BreadcrumbsBar: React.FC<BreadcrumbsBarProps> = ({
  breadcrumbs,
  currentTitle,
  onNavigate,
  onHomePress,
}) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: palette.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={styles.crumbItem}
          onPress={onHomePress}
          accessibilityRole="button"
          accessibilityLabel="Notes home"
        >
          <Home size={14} color={palette.textSecondary} />
          <Text style={[styles.crumbText, { color: palette.textSecondary }]}>Notes</Text>
        </TouchableOpacity>

        {(breadcrumbs || []).map((crumb) => (
          <React.Fragment key={crumb._id}>
            <ChevronRight size={12} color={palette.textSecondary} style={styles.separator} />
            <TouchableOpacity
              style={styles.crumbItem}
              onPress={() => onNavigate(crumb._id)}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${crumb.title}`}
            >
              <Text style={styles.crumbIcon}>{crumb.icon || '📄'}</Text>
              <Text
                style={[styles.crumbText, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {crumb.title || 'Untitled'}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}

        <ChevronRight size={12} color={palette.textSecondary} style={styles.separator} />
        <View style={styles.crumbItem}>
          <Text
            style={[styles.crumbText, { color: palette.text, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {currentTitle || 'Untitled'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 140,
  },
  crumbIcon: {
    fontSize: 12,
  },
  crumbText: {
    fontSize: 12,
  },
  separator: {
    opacity: 0.6,
  },
});


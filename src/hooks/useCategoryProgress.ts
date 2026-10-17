/**
 * Hook to calculate daily logging progress:
 * 1. Per-category progress: Percentage of active questions answered today in that category.
 * 2. Overall combined progress: Average completion percentage across all active categories.
 */
import { useMemo } from 'react';
import { useConfigStore } from '../store/configStore';
import { useTodayCategoryLogs, CategoryLogStatus } from './useTodayCategoryLogs';

export interface CategoryProgressInfo {
  categoryId: string;
  categoryName: string;
  totalQuestions: number;
  answeredQuestions: number;
  progress: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  isComplete: boolean;
  isLoggedToday: boolean;
  count: number;
  latestTimeStr?: string;
  status: CategoryLogStatus;
}

export interface DailyOverallProgress {
  overallProgress: number; // 0.0 to 1.0
  overallPercentage: number; // 0 to 100
  completedCategoriesCount: number;
  totalCategoriesCount: number;
  categoryProgressMap: Record<string, CategoryProgressInfo>;
  getCategoryProgress: (categoryId: string) => CategoryProgressInfo;
  refetch: () => void;
  isLoading: boolean;
}

export function useCategoryProgress(dateStr?: string): DailyOverallProgress {
  const { config, isLoading: isConfigLoading } = useConfigStore();
  const { todayLogs, getCategoryStatus, refetch, isLoading: isLogsLoading } = useTodayCategoryLogs(dateStr);

  const activeCategories = useMemo(() => {
    return (config?.categories ?? []).filter(c => c.isActive);
  }, [config?.categories]);

  const categoryProgressMap = useMemo(() => {
    const map: Record<string, CategoryProgressInfo> = {};
    if (!config) return map;

    const questions = config.questions ?? [];
    const options = config.options ?? [];

    for (const cat of activeCategories) {
      const catId = cat._id;
      const status = getCategoryStatus(catId);
      const catQuestions = questions.filter(q => q.categoryId === catId && q.isActive);
      const totalQuestions = catQuestions.length;

      let answeredQuestions = 0;

      if (totalQuestions > 0) {
        for (const q of catQuestions) {
          const validOptionIds = new Set(
            options.filter(o => o.questionId === q._id && o.isActive).map(o => o._id)
          );

          // Check if this question was answered in any of today's logs for this category
          const isAnswered = todayLogs.some(log => {
            const matchesCategory = !log.categoryId || log.categoryId === catId;
            if (!matchesCategory) return false;

            return (log.answers ?? []).some(ans => {
              if (validOptionIds.has(ans.optionId)) return true;
              if (ans.optionId === '__other__' && log.questionId === q._id) return true;
              return false;
            });
          });

          if (isAnswered) {
            answeredQuestions += 1;
          }
        }
      } else {
        // If category has no questions configured, treat having 1+ log today as complete
        answeredQuestions = status.isLoggedToday ? 1 : 0;
      }

      const effectiveTotal = totalQuestions > 0 ? totalQuestions : 1;
      const progress = Math.min(1, Math.max(0, answeredQuestions / effectiveTotal));
      const percentage = Math.round(progress * 100);
      const isComplete = progress >= 1;

      map[catId] = {
        categoryId: catId,
        categoryName: cat.name,
        totalQuestions,
        answeredQuestions,
        progress,
        percentage,
        isComplete,
        isLoggedToday: status.isLoggedToday,
        count: status.count,
        latestTimeStr: status.latestTimeStr,
        status,
      };
    }

    return map;
  }, [config, activeCategories, getCategoryStatus, todayLogs]);

  const { overallProgress, overallPercentage, completedCategoriesCount } = useMemo(() => {
    if (activeCategories.length === 0) {
      return { overallProgress: 0, overallPercentage: 0, completedCategoriesCount: 0 };
    }

    let sum = 0;
    let completedCount = 0;

    for (const cat of activeCategories) {
      const info = categoryProgressMap[cat._id];
      const prog = info?.progress ?? 0;
      sum += prog;
      if (info?.isComplete) {
        completedCount += 1;
      }
    }

    const avg = sum / activeCategories.length;
    const clampedAvg = Math.min(1, Math.max(0, avg));
    return {
      overallProgress: clampedAvg,
      overallPercentage: Math.round(clampedAvg * 100),
      completedCategoriesCount: completedCount,
    };
  }, [activeCategories, categoryProgressMap]);

  const getCategoryProgress = (categoryId: string): CategoryProgressInfo => {
    return (
      categoryProgressMap[categoryId] ?? {
        categoryId,
        categoryName: '',
        totalQuestions: 0,
        answeredQuestions: 0,
        progress: 0,
        percentage: 0,
        isComplete: false,
        isLoggedToday: false,
        count: 0,
        status: { isLoggedToday: false, count: 0 },
      }
    );
  };

  return {
    overallProgress,
    overallPercentage,
    completedCategoriesCount,
    totalCategoriesCount: activeCategories.length,
    categoryProgressMap,
    getCategoryProgress,
    refetch,
    isLoading: isConfigLoading || isLogsLoading,
  };
}

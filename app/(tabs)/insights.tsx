/**
 * Insights tab route: renders InsightsView.
 * Kept routable so existing deep links, push notifications and tests continue to work.
 */
import React from 'react';
import { InsightsView, HIDDEN_FINDINGS_KEY } from '../../src/components/insights/InsightsView';

export { HIDDEN_FINDINGS_KEY };
export default function InsightsScreen() {
  return <InsightsView />;
}

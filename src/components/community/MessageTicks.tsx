/**
 * Ticks on your own messages: clock = sending, one tick = sent, two grey = delivered, two blue = seen.
 * The number of ticks and the clock change too, so colour is never the only signal.
 */
import React from 'react';
import { View } from 'react-native';
import { Check, CheckCheck, Clock } from 'lucide-react-native';
import { TickStatus } from '../../utils/community/receipts';

const SEEN_BLUE = '#38BDF8';

export const MessageTicks: React.FC<{ status: TickStatus; muted?: string; size?: number }> = ({ status, muted = '#949BA4', size = 14 }) => {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ marginLeft: 4 }}>
      {status === 'sending' ? <Clock size={size - 2} color={muted} />
        : status === 'sent' ? <Check size={size} color={muted} />
        : status === 'delivered' ? <CheckCheck size={size} color={muted} />
        : <CheckCheck size={size} color={SEEN_BLUE} />}
    </View>
  );
};

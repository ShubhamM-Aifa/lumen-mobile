/**
 * Community Tab: Discord-style community directory with channels and direct messages.
 * Design spec: docs/design/Community.html, docs/design/Messages.html, docs/DESIGN_HANDOFF.md
 */
import React from 'react';
import { CommunityDirectoryView } from '../../src/components/community/CommunityDirectoryView';

export default function CommunityTabScreen() {
  return <CommunityDirectoryView isTab={true} />;
}

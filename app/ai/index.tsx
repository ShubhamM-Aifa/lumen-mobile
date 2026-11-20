/**
 * Redirect /ai to the new Lumen tab (/(tabs)/lumen).
 */
import React from 'react';
import { Redirect } from 'expo-router';

export default function AiScreenRedirect() {
  return <Redirect href="/(tabs)/lumen" />;
}

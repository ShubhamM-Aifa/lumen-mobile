/**
 * Redirect legacy /community route to the Community tab (/(tabs)/community).
 */
import React from 'react';
import { Redirect } from 'expo-router';

export default function CommunityIndexRedirect() {
  return <Redirect href="/(tabs)/community" />;
}

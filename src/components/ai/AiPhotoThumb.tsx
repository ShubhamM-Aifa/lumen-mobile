/**
 * A photo inside a Lumen AI chat. Blurred until the photo vault is unlocked, like everywhere else
 * health photos are shown; tapping asks for the PIN.
 */
import React, { useState } from 'react';
import { Image, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useResolvedMediaUrls } from '../../services/mediaService';
import { usePhotoVaultStore } from '../../store/photoVaultStore';
import { PhotoPinModal } from '../common/PhotoPinModal';

interface Props {
  /** A media id or a local uri (an attachment still uploading). */
  source: string;
  size?: number;
}

export function AiPhotoThumb({ source, size = 120 }: Props) {
  const { urls, isLoading } = useResolvedMediaUrls(source);
  const isUnlocked = usePhotoVaultStore(s => s.isUnlocked);
  const unlock = usePhotoVaultStore(s => s.unlock);
  const [askPin, setAskPin] = useState(false);
  const local = source.startsWith('file:') || source.startsWith('content:');
  const hidden = !isUnlocked && !local;

  return (
    <>
      <TouchableOpacity
        disabled={!hidden}
        onPress={() => setAskPin(true)}
        accessibilityRole={hidden ? 'button' : 'image'}
        accessibilityLabel={hidden ? 'Hidden health photo. Tap to unlock' : 'Health photo'}
        style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: '#8884' }}
      >
        {isLoading || !urls[0] ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>
        ) : (
          <Image source={{ uri: urls[0] }} style={{ width: size, height: size }} blurRadius={hidden ? 24 : 0} />
        )}
        {hidden ? (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={22} color="#fff" />
          </View>
        ) : null}
      </TouchableOpacity>
      <PhotoPinModal visible={askPin} onClose={() => setAskPin(false)} onSuccess={() => { unlock(); setAskPin(false); }} />
    </>
  );
}

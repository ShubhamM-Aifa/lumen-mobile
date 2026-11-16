import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../../theme/ThemeContext';
import { uploadMedia } from '../../../services/mediaUpload';
import { resolveMediaUrl } from '../../../services/mediaService';
import { useNoteStore } from '../../../store/noteStore';
import NoteEditorDom from './NoteEditor.dom';
import { NoteEditorNativeToolbar } from './NoteEditorNativeToolbar';

export interface NoteEditorWrapperProps {
  noteId: string;
  doc: Record<string, unknown> | null;
  placeholder?: string;
  onChange: (doc: Record<string, unknown>) => void;
  actionCommand?: {
    id: number;
    type: string;
    payload?: any;
  } | null;
  hideToolbar?: boolean;
}

export function NoteEditorWrapper({
  noteId,
  doc,
  placeholder,
  onChange,
  actionCommand,
  hideToolbar = false,
}: NoteEditorWrapperProps) {
  const router = useRouter();
  const { palette, colorScheme } = useTheme();

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        const uploadRes = await uploadMedia(asset.uri, mimeType);
        return {
          mediaId: uploadRes.mediaId,
          url: uploadRes.url || asset.uri,
          name: asset.fileName || 'image.jpg',
        };
      }
    } catch (err) {
      console.warn('[NoteEditor] Image pick/upload error:', err);
    }
    return null;
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const mimeType = file.mimeType || 'application/octet-stream';
        const uploadRes = await uploadMedia(file.uri, mimeType);
        return {
          mediaId: uploadRes.mediaId,
          name: file.name || 'document',
          size: file.size || 0,
          mimeType,
        };
      }
    } catch (err) {
      console.warn('[NoteEditor] Document pick/upload error:', err);
    }
    return null;
  }, []);

  const handleResolveMedia = useCallback(async (mediaId: string) => {
    try {
      return await resolveMediaUrl(mediaId);
    } catch {
      return null;
    }
  }, []);

  const handleSearchPages = useCallback(async (query: string) => {
    const tree = useNoteStore.getState().tree;
    const q = query.toLowerCase().trim();
    const matches = tree
      .filter((node) => node._id !== noteId && (!q || node.title.toLowerCase().includes(q)))
      .slice(0, 15)
      .map((node) => ({
        id: node._id,
        title: node.title,
        icon: node.icon || '📄',
      }));
    return matches;
  }, [noteId]);

  const handleOpenPage = useCallback(
    (pageId: string) => {
      router.push(`/notes/${pageId}`);
    },
    [router]
  );

  const handleCreateSubPage = useCallback(
    async (title: string) => {
      try {
        const newPage = await useNoteStore.getState().createNote({
          parentNoteId: noteId,
          title: title.trim() || 'Untitled Page',
          icon: '📄',
        });
        return {
          id: newPage._id,
          title: newPage.title,
          icon: newPage.icon || '📄',
        };
      } catch {
        return null;
      }
    },
    [noteId]
  );

  // Native toolbar bridge commands
  const runEditorCommand = (cmd: string) => {
    if (typeof window !== 'undefined' && (window as any).__lumenEditor?.[cmd]) {
      (window as any).__lumenEditor[cmd]();
    }
  };

  const themeTokens = {
    isDark: colorScheme === 'dark',
    background: palette.background,
    surface: palette.surface,
    text: palette.text,
    subtext: palette.textSecondary,
    primary: palette.primary,
    border: palette.border,
    card: palette.surfaceAlt,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.editorArea}>
        <NoteEditorDom
          initialDoc={doc}
          placeholder={placeholder}
          theme={themeTokens}
          actionCommand={actionCommand}
          onChange={onChange}
          onPickImage={handlePickImage}
          onPickFile={handlePickFile}
          onResolveMedia={handleResolveMedia}
          onSearchPages={handleSearchPages}
          onOpenPage={handleOpenPage}
          onCreateSubPage={handleCreateSubPage}
        />
      </View>

      {!hideToolbar && (
        <NoteEditorNativeToolbar
          onSlashPress={() => runEditorCommand('openSlashMenu')}
          onBoldPress={() => runEditorCommand('toggleBold')}
          onItalicPress={() => runEditorCommand('toggleItalic')}
          onTodoPress={() => runEditorCommand('toggleTaskList')}
          onBulletPress={() => runEditorCommand('toggleBulletList')}
          onCalloutPress={() => runEditorCommand('toggleCallout')}
          onUndoPress={() => runEditorCommand('undo')}
          onRedoPress={() => runEditorCommand('redo')}
          onImagePress={async () => {
            const res = await handlePickImage();
            if (res?.url && typeof window !== 'undefined' && (window as any).__lumenEditor?.insertImage) {
              (window as any).__lumenEditor.insertImage(res.url, res.name);
            }
          }}
          onFilePress={async () => {
            const res = await handlePickFile();
            if (res?.mediaId && typeof window !== 'undefined' && (window as any).__lumenEditor?.insertFile) {
              (window as any).__lumenEditor.insertFile(res);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editorArea: {
    flex: 1,
  },
});

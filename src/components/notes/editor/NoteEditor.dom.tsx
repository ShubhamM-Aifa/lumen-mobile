'use dom';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Suggestion from '@tiptap/suggestion';

import { Callout } from './extensions/Callout';
import { FileAttachment } from './extensions/FileAttachment';
import { PageLink } from './extensions/PageLink';
import { getEditorCSS } from './editorStyles';

export interface NoteEditorProps {
  initialDoc?: Record<string, unknown> | null;
  placeholder?: string;
  theme: {
    isDark: boolean;
    background: string;
    surface: string;
    text: string;
    subtext: string;
    primary: string;
    border: string;
    card: string;
  };
  onChange?: (doc: Record<string, unknown>) => void;
  onPickImage?: () => Promise<{ mediaId: string; url: string; name?: string } | null>;
  onPickFile?: () => Promise<{ mediaId: string; name: string; size?: number; mimeType?: string } | null>;
  onResolveMedia?: (mediaId: string) => Promise<string | null>;
  onSearchPages?: (query: string) => Promise<Array<{ id: string; title: string; icon?: string }>>;
  onOpenPage?: (pageId: string) => void;
  onCreateSubPage?: (title: string) => Promise<{ id: string; title: string; icon?: string } | null>;
}

interface SlashItem {
  title: string;
  icon: string;
  action: (editor: any) => void;
}

export default function NoteEditorDom({
  initialDoc,
  placeholder = 'Type / for commands, or @ to link a page...',
  theme,
  onChange,
  onPickImage,
  onPickFile,
  onResolveMedia,
  onSearchPages,
  onOpenPage,
  onCreateSubPage,
}: NoteEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slash suggestion state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashCoords, setSlashCoords] = useState<{ x: number; y: number } | null>(null);
  const slashRangeRef = useRef<any>(null);

  // Mention / Page Link suggestion state
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionPages, setMentionPages] = useState<Array<{ id: string; title: string; icon?: string }>>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState<{ x: number; y: number } | null>(null);
  const mentionRangeRef = useRef<any>(null);

  const slashItems: SlashItem[] = useMemo(
    () => [
      {
        title: 'Text',
        icon: '📝',
        action: (ed) => ed.chain().focus().setParagraph().run(),
      },
      {
        title: 'Heading 1',
        icon: 'H1',
        action: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: 'Heading 2',
        icon: 'H2',
        action: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: 'Heading 3',
        icon: 'H3',
        action: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        title: 'Bullet List',
        icon: '•',
        action: (ed) => ed.chain().focus().toggleBulletList().run(),
      },
      {
        title: 'Numbered List',
        icon: '1.',
        action: (ed) => ed.chain().focus().toggleOrderedList().run(),
      },
      {
        title: 'To-do List',
        icon: '☑️',
        action: (ed) => ed.chain().focus().toggleTaskList().run(),
      },
      {
        title: 'Toggle List',
        icon: '▶️',
        action: (ed) => ed.chain().focus().setDetails().run(),
      },
      {
        title: 'Callout',
        icon: '💡',
        action: (ed) => ed.chain().focus().setCallout({ icon: '💡', color: '#0284C7' }).run(),
      },
      {
        title: 'Quote',
        icon: '❝',
        action: (ed) => ed.chain().focus().toggleBlockquote().run(),
      },
      {
        title: 'Divider',
        icon: '―',
        action: (ed) => ed.chain().focus().setHorizontalRule().run(),
      },
      {
        title: 'Code Block',
        icon: '</>',
        action: (ed) => ed.chain().focus().toggleCodeBlock().run(),
      },
      {
        title: 'Table',
        icon: '▦',
        action: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        title: 'Upload Image',
        icon: '🖼️',
        action: async (ed) => {
          if (onPickImage) {
            const res = await onPickImage();
            if (res?.url) {
              ed.chain().focus().setImage({ src: res.url, alt: res.name || 'Image' }).run();
            }
          }
        },
      },
      {
        title: 'Attach File',
        icon: '📎',
        action: async (ed) => {
          if (onPickFile) {
            const res = await onPickFile();
            if (res?.mediaId) {
              ed.chain().focus().insertFile({
                mediaId: res.mediaId,
                name: res.name || 'Attachment',
                size: res.size,
                mimeType: res.mimeType,
              }).run();
            }
          }
        },
      },
      {
        title: 'Link Page',
        icon: '📄',
        action: async (ed) => {
          if (onSearchPages) {
            const pages = await onSearchPages('');
            if (pages.length > 0) {
              ed.chain().focus().insertPageLink({
                noteId: pages[0].id,
                title: pages[0].title,
                icon: pages[0].icon || '📄',
              }).run();
            }
          }
        },
      },
    ],
    [onPickImage, onPickFile, onSearchPages]
  );

  const filteredSlashItems = useMemo(() => {
    if (!slashQuery) return slashItems;
    const q = slashQuery.toLowerCase();
    return slashItems.filter((i) => i.title.toLowerCase().includes(q));
  }, [slashItems, slashQuery]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Details.configure({ persist: true }),
      DetailsSummary,
      DetailsContent,
      Callout,
      FileAttachment,
      PageLink,
      Placeholder.configure({ placeholder }),
      // Slash Command Suggestion Extension
      ExtensionSuggestionSlash({
        onStart: (props: any) => {
          slashRangeRef.current = props.range;
          setSlashCoords(props.clientRect ? props.clientRect() : null);
          setSlashQuery(props.query || '');
          setSlashIndex(0);
          setSlashMenuOpen(true);
        },
        onUpdate: (props: any) => {
          slashRangeRef.current = props.range;
          setSlashCoords(props.clientRect ? props.clientRect() : null);
          setSlashQuery(props.query || '');
          setSlashIndex(0);
        },
        onExit: () => {
          setSlashMenuOpen(false);
          slashRangeRef.current = null;
        },
      }),
      // Page Mention Suggestion Extension (@ and [[)
      ExtensionSuggestionMention({
        onStart: async (props: any) => {
          mentionRangeRef.current = props.range;
          setMentionCoords(props.clientRect ? props.clientRect() : null);
          setMentionIndex(0);
          if (onSearchPages) {
            const pages = await onSearchPages(props.query || '');
            setMentionPages(pages);
          }
          setMentionMenuOpen(true);
        },
        onUpdate: async (props: any) => {
          mentionRangeRef.current = props.range;
          setMentionCoords(props.clientRect ? props.clientRect() : null);
          setMentionIndex(0);
          if (onSearchPages) {
            const pages = await onSearchPages(props.query || '');
            setMentionPages(pages);
          }
        },
        onExit: () => {
          setMentionMenuOpen(false);
          mentionRangeRef.current = null;
        },
      }),
    ],
    content: initialDoc || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      if (!onChange) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChange(ed.getJSON());
      }, 600);
    },
  });

  // Handle page-link click delegation
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-type="page-link"]');
      if (target) {
        const noteId = target.getAttribute('data-note-id');
        if (noteId && onOpenPage) {
          e.preventDefault();
          onOpenPage(noteId);
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [onOpenPage]);

  // Expose bridge helper on window for Native Toolbar
  useEffect(() => {
    if (!editor) return;
    (window as any).__lumenEditor = {
      toggleBold: () => editor.chain().focus().toggleBold().run(),
      toggleItalic: () => editor.chain().focus().toggleItalic().run(),
      toggleUnderline: () => editor.chain().focus().toggleUnderline().run(),
      toggleStrike: () => editor.chain().focus().toggleStrike().run(),
      toggleTaskList: () => editor.chain().focus().toggleTaskList().run(),
      toggleBulletList: () => editor.chain().focus().toggleBulletList().run(),
      toggleOrderedList: () => editor.chain().focus().toggleOrderedList().run(),
      toggleCallout: () => editor.chain().focus().toggleCallout().run(),
      toggleDetails: () => editor.chain().focus().setDetails().run(),
      undo: () => editor.chain().focus().undo().run(),
      redo: () => editor.chain().focus().redo().run(),
      openSlashMenu: () => {
        editor.chain().focus().insertContent('/').run();
      },
    };
  }, [editor]);

  const selectSlashItem = (item: SlashItem) => {
    if (!editor || !slashRangeRef.current) return;
    editor.chain().focus().deleteRange(slashRangeRef.current).run();
    item.action(editor);
    setSlashMenuOpen(false);
  };

  const selectMentionPage = (page: { id: string; title: string; icon?: string }) => {
    if (!editor || !mentionRangeRef.current) return;
    editor.chain().focus().deleteRange(mentionRangeRef.current).run();
    editor.chain().focus().insertPageLink({
      noteId: page.id,
      title: page.title,
      icon: page.icon || '📄',
    }).run();
    setMentionMenuOpen(false);
  };

  return (
    <>
      <style>{getEditorCSS(theme)}</style>

      {editor && (
        <BubbleMenu editor={editor} className="lumen-bubble-menu">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`lumen-bubble-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`lumen-bubble-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`lumen-bubble-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          >
            U
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`lumen-bubble-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          >
            S
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`lumen-bubble-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
          >
            Highlight
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('URL:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
              else editor.chain().focus().unsetLink().run();
            }}
            className={`lumen-bubble-btn ${editor.isActive('link') ? 'is-active' : ''}`}
          >
            Link
          </button>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />

      {/* Slash Suggestions Menu */}
      {slashMenuOpen && slashCoords && filteredSlashItems.length > 0 && (
        <div
          className="lumen-suggestion-menu"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 240, Math.max(10, slashCoords.x))}px`,
            top: `${Math.min(window.innerHeight - 300, slashCoords.y + 24)}px`,
          }}
        >
          {filteredSlashItems.map((item, idx) => (
            <div
              key={item.title}
              className={`lumen-suggestion-item ${idx === slashIndex ? 'is-selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSlashItem(item);
              }}
            >
              <span className="lumen-suggestion-item-icon">{item.icon}</span>
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mention (@) Suggestions Menu */}
      {mentionMenuOpen && mentionCoords && (
        <div
          className="lumen-suggestion-menu"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 240, Math.max(10, mentionCoords.x))}px`,
            top: `${Math.min(window.innerHeight - 300, mentionCoords.y + 24)}px`,
          }}
        >
          {mentionPages.length === 0 ? (
            <div style={{ padding: '8px 12px', color: 'var(--subtext)', fontSize: '13px' }}>
              No matching pages found
            </div>
          ) : (
            mentionPages.map((page, idx) => (
              <div
                key={page.id}
                className={`lumen-suggestion-item ${idx === mentionIndex ? 'is-selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMentionPage(page);
                }}
              >
                <span className="lumen-suggestion-item-icon">{page.icon || '📄'}</span>
                <span>{page.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}

function ExtensionSuggestionSlash(callbacks: any) {
  return ExtensionSlashSuggestionPlugin(callbacks);
}

function ExtensionSuggestionMention(callbacks: any) {
  return ExtensionMentionSuggestionPlugin(callbacks);
}

function ExtensionSlashSuggestionPlugin(callbacks: any) {
  return {
    name: 'slashSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          command: ({ editor: ed, range, props }: any) => {
            props.command({ editor: ed, range });
          },
          render: () => ({
            onStart: (props) => callbacks.onStart(props),
            onUpdate: (props) => callbacks.onUpdate(props),
            onExit: () => callbacks.onExit(),
          }),
        }),
      ];
    },
  } as any;
}

function ExtensionMentionSuggestionPlugin(callbacks: any) {
  return {
    name: 'mentionSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '@',
          command: ({ editor: ed, range, props }: any) => {
            props.command({ editor: ed, range });
          },
          render: () => ({
            onStart: (props) => callbacks.onStart(props),
            onUpdate: (props) => callbacks.onUpdate(props),
            onExit: () => callbacks.onExit(),
          }),
        }),
      ];
    },
  } as any;
}

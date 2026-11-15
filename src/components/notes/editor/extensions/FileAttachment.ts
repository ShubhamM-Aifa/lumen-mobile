import { Node, mergeAttributes } from '@tiptap/react';

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFile: (attrs: { mediaId: string; name: string; size?: number; mimeType?: string }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'file',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      mediaId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-media-id') || '',
        renderHTML: (attrs) => ({ 'data-media-id': attrs.mediaId }),
      },
      name: {
        default: 'Attachment',
        parseHTML: (el) => el.getAttribute('data-name') || 'Attachment',
        renderHTML: (attrs) => ({ 'data-name': attrs.name }),
      },
      size: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-size') || 0),
        renderHTML: (attrs) => ({ 'data-size': attrs.size }),
      },
      mimeType: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime-type') || '',
        renderHTML: (attrs) => ({ 'data-mime-type': attrs.mimeType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = node.attrs.name || 'Attachment';
    const size = Number(node.attrs.size || 0);
    const sizeStr = size > 0 ? (size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`) : '';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'file',
        class: 'lumen-file-card',
        contenteditable: 'false',
      }),
      ['span', { class: 'lumen-file-icon' }, '📎'],
      [
        'div',
        { class: 'lumen-file-meta' },
        ['span', { class: 'lumen-file-name' }, name],
        sizeStr ? ['span', { class: 'lumen-file-size' }, sizeStr] : ['span', {}],
      ],
    ];
  },

  addCommands() {
    return {
      insertFile:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});


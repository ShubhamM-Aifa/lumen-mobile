import { Node, mergeAttributes } from '@tiptap/react';

export interface PageLinkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (attrs: { noteId: string; title: string; icon?: string }) => ReturnType;
    };
  }
}

export const PageLink = Node.create<PageLinkOptions>({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-note-id') || '',
        renderHTML: (attrs) => ({ 'data-note-id': attrs.noteId }),
      },
      title: {
        default: 'Untitled Page',
        parseHTML: (el) => el.getAttribute('data-title') || 'Untitled Page',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      icon: {
        default: '📄',
        parseHTML: (el) => el.getAttribute('data-icon') || '📄',
        renderHTML: (attrs) => ({ 'data-icon': attrs.icon }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="page-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const icon = node.attrs.icon || '📄';
    const title = node.attrs.title || 'Untitled Page';
    const noteId = node.attrs.noteId;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'page-link',
        'data-note-id': noteId,
        class: 'lumen-page-link-pill',
        contenteditable: 'false',
      }),
      ['span', { class: 'page-link-icon' }, icon],
      ['span', { class: 'page-link-title' }, title],
    ];
  },

  addCommands() {
    return {
      insertPageLink:
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


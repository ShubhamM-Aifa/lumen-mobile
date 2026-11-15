import { Node, mergeAttributes } from '@tiptap/react';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { icon?: string; color?: string }) => ReturnType;
      toggleCallout: (attrs?: { icon?: string; color?: string }) => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      icon: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-icon') || '💡',
        renderHTML: (attributes) => ({
          'data-icon': attributes.icon,
        }),
      },
      color: {
        default: '#0284C7',
        parseHTML: (element) => element.getAttribute('data-color') || '#0284C7',
        renderHTML: (attributes) => ({
          'data-color': attributes.color,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const icon = node.attrs.icon || '💡';
    const color = node.attrs.color || '#0284C7';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: 'lumen-callout-node',
        style: `border-left: 3px solid ${color}; background-color: ${color}15;`,
      }),
      [
        'div',
        { class: 'lumen-callout-icon', contenteditable: 'false' },
        icon,
      ],
      ['div', { class: 'lumen-callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
    };
  },
});


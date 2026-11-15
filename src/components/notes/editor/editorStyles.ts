export function getEditorCSS(theme: {
  isDark: boolean;
  background: string;
  surface: string;
  text: string;
  subtext: string;
  primary: string;
  border: string;
  card: string;
}): string {
  const { isDark, background, surface, text, subtext, primary, border, card } = theme;

  return `
    :root {
      --bg: ${background};
      --surface: ${surface};
      --text: ${text};
      --subtext: ${subtext};
      --primary: ${primary};
      --border: ${border};
      --card: ${card};
      --font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-family);
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      min-height: 100%;
      width: 100%;
      overflow-x: hidden;
      padding: 12px 16px 120px 16px;
    }

    .ProseMirror {
      outline: none;
      min-height: 350px;
    }

    .ProseMirror p {
      margin-bottom: 0.6em;
      min-height: 1.5em;
    }

    .ProseMirror h1 {
      font-size: 1.85em;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin-top: 1.2em;
      margin-bottom: 0.4em;
      color: var(--text);
    }

    .ProseMirror h2 {
      font-size: 1.45em;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-top: 1.0em;
      margin-bottom: 0.35em;
      color: var(--text);
    }

    .ProseMirror h3 {
      font-size: 1.2em;
      font-weight: 600;
      letter-spacing: -0.015em;
      margin-top: 0.8em;
      margin-bottom: 0.3em;
      color: var(--text);
    }

    .ProseMirror ul, .ProseMirror ol {
      padding-left: 1.5em;
      margin-bottom: 0.6em;
    }

    .ProseMirror li {
      margin-bottom: 0.25em;
    }

    /* Task Lists (To-Do) */
    ul[data-type="taskList"] {
      list-style: none;
      padding: 0;
      margin-bottom: 0.6em;
    }

    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      margin-bottom: 0.4em;
    }

    ul[data-type="taskList"] li > label {
      user-select: none;
      margin-right: 0.6em;
      margin-top: 0.2em;
    }

    ul[data-type="taskList"] li > label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      accent-color: var(--primary);
      cursor: pointer;
    }

    ul[data-type="taskList"] li > div {
      flex: 1 1 auto;
    }

    ul[data-type="taskList"] li[data-checked="true"] > div {
      text-decoration: line-through;
      color: var(--subtext);
    }

    /* Blockquote */
    blockquote {
      border-left: 3px solid var(--primary);
      padding-left: 1em;
      margin: 0.8em 0;
      color: var(--subtext);
      font-style: italic;
    }

    /* Callout */
    .lumen-callout-node {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      margin: 0.8em 0;
      background: var(--surface);
    }

    .lumen-callout-icon {
      font-size: 20px;
      line-height: 1.2;
      user-select: none;
    }

    .lumen-callout-content {
      flex: 1;
    }

    .lumen-callout-content p:last-child {
      margin-bottom: 0;
    }

    /* Details / Toggle */
    details {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 12px;
      margin: 0.8em 0;
      background-color: var(--surface);
    }

    details summary {
      cursor: pointer;
      font-weight: 600;
      outline: none;
      margin-bottom: 4px;
      user-select: none;
    }

    details > div {
      margin-top: 8px;
      padding-left: 14px;
      border-left: 2px solid var(--border);
    }

    /* Horizontal Rule */
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.4em 0;
    }

    /* Code block */
    pre {
      background: ${isDark ? '#18181B' : '#F4F4F5'};
      color: ${isDark ? '#FAFAFA' : '#18181B'};
      font-family: ui-monospace, Menlo, Monaco, "Cascadia Code", monospace;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.8em 0;
      font-size: 14px;
      line-height: 1.5;
    }

    code {
      background: ${isDark ? '#27272A' : '#E4E4E7'};
      color: ${isDark ? '#F43F5E' : '#E11D48'};
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: ui-monospace, Menlo, Monaco, monospace;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      margin: 1em 0;
      width: 100%;
      overflow-x: auto;
      display: block;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      min-width: 90px;
      text-align: left;
    }

    th {
      background: var(--surface);
      font-weight: 600;
    }

    /* Page Link Pill */
    .lumen-page-link-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: ${isDark ? '#27272A' : '#E4E4E7'};
      color: var(--primary);
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      margin: 0 2px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    /* File Attachment Card */
    .lumen-file-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      margin: 0.8em 0;
      cursor: pointer;
    }

    .lumen-file-icon {
      font-size: 22px;
    }

    .lumen-file-meta {
      display: flex;
      flex-direction: column;
    }

    .lumen-file-name {
      font-weight: 500;
      color: var(--text);
    }

    .lumen-file-size {
      font-size: 12px;
      color: var(--subtext);
    }

    /* Images */
    .ProseMirror img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      margin: 0.8em 0;
      display: block;
    }

    /* Placeholder */
    .ProseMirror p.is-editor-empty:first-child::before {
      color: var(--subtext);
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    /* Slash Suggestion Menu & Mentions Popup */
    .lumen-suggestion-menu {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, ${isDark ? '0.45' : '0.12'});
      padding: 6px;
      min-width: 230px;
      max-height: 320px;
      overflow-y: auto;
      z-index: 99999;
    }

    .lumen-suggestion-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text);
      font-size: 14px;
      font-weight: 500;
      transition: background 0.1s ease;
    }

    .lumen-suggestion-item.is-selected, .lumen-suggestion-item:hover {
      background: ${isDark ? '#3F3F46' : '#F4F4F5'};
      color: var(--primary);
    }

    .lumen-suggestion-item-icon {
      font-size: 17px;
      width: 22px;
      text-align: center;
    }

    /* Floating Bubble Menu */
    .lumen-bubble-menu {
      display: flex;
      align-items: center;
      gap: 4px;
      background: ${isDark ? '#27272A' : '#FFFFFF'};
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px 6px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, ${isDark ? '0.5' : '0.15'});
      z-index: 9999;
    }

    .lumen-bubble-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      padding: 5px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lumen-bubble-btn.is-active {
      background: var(--primary);
      color: #FFFFFF;
    }

    .lumen-bubble-btn:hover:not(.is-active) {
      background: ${isDark ? '#3F3F46' : '#F4F4F5'};
    }
  `;
}


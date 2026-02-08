// JSON Viewer
// 複雑にネストされたJSONデータをマークダウン形式で綺麗に表示するビューアー
// 📊
// v11
// 2026-02-08

(function() {
  try {
    const ID = 'json-viewer-widget';
    const old = document.getElementById(ID);
    if (old) {
      old._close ? old._close() : old.remove();
      return;
    }

    // Centralized z-index management
    const Z_INDEX = {
      BASE: 2147483647,
      MODAL_OVERLAY: 2147483647,
      DROPDOWN: 2147483647
    };

    // Centralized color constants with dark mode support
    const COLORS = {
      // Light mode
      LIGHT: {
        PRIMARY: '#1a73e8',
        PRIMARY_HOVER: '#1557b0',
        DANGER: '#dc3545',
        DANGER_HOVER: '#c82333',
        SUCCESS: '#28a745',
        BORDER: '#ddd',
        BACKGROUND: '#f8f9fa',
        CONTAINER_BG: '#ffffff',
        TEXT: '#333',
        TEXT_LIGHT: '#666',
        INPUT_BG: '#ffffff',
        CODE_BG: '#f8f9fa',
        ERROR_BG: '#fff5f5'
      },
      // Dark mode
      DARK: {
        PRIMARY: '#4a9eff',
        PRIMARY_HOVER: '#357ae8',
        DANGER: '#ff5555',
        DANGER_HOVER: '#ff3333',
        SUCCESS: '#50fa7b',
        BORDER: '#444',
        BACKGROUND: '#2d2d2d',
        CONTAINER_BG: '#1e1e1e',
        TEXT: '#e0e0e0',
        TEXT_LIGHT: '#999',
        INPUT_BG: '#2d2d2d',
        CODE_BG: '#2d2d2d',
        ERROR_BG: '#3d1f1f'
      }
    };

    // Centralized version management
    const VERSION_INFO = {
      CURRENT: 'v11',
      LAST_UPDATED: '2026-02-08',
      HISTORY: [
        {
          version: 'v11',
          date: '2026-02-08',
          features: [
            'JSON文字列の値を自動検出してJSONコードブロックで表示する機能を追加',
            'JSON.parseが可能な文字列（オブジェクトまたは配列）を```jsonコードブロックとして整形表示',
            'コードブロック処理の共通ロジックを実装し、可読性とメンテナンス性を向上',
            'ライトモードとダークモードの両方でコードブロックのスタイリングをサポート'
          ]
        },
        {
          version: 'v10',
          date: '2026-02-08',
          features: [
            'マークダウンのリスト形式に対応：順序なしリスト（-, *, +）と順序付きリスト（1., 2., ...）をサポート',
            'ネストされたリストの処理に対応し、インデントに基づいた階層構造を正確に再現',
            'リスト処理の共通ロジックをリファクタリングし、可読性とメンテナンス性を向上',
            'セキュリティを維持しながらDOM APIを使用した安全なリスト要素生成'
          ]
        },
        {
          version: 'v9',
          date: '2026-02-08',
          features: [
            'ヘディング表示を修正：マークダウン記号がそのまま表示される問題を解決',
            'ヘディングレベルをh6まで拡張（h1-h6をサポート）',
            'ヘディングにドット記法のパスのみを表示（例: sceneImages[0].instruction）',
            'マークダウン処理の順序を最適化し、可読性とメンテナンス性を向上'
          ]
        },
        {
          version: 'v8',
          date: '2026-02-08',
          features: [
            'ヘディングに完全なパス（例: scenePrompts[0].xxx）を常に表示',
            'h1, h2, h3の3階層のみ使用し、それ以降はbタグに切り替え',
            'ダークモードの可読性を向上（フォントサイズ拡大、コントラスト改善）',
            'コード構造のリファクタリングと保守性の向上'
          ]
        },
        {
          version: 'v7',
          date: '2026-02-08',
          features: [
            'クリップボード自動読み取り機能を削除し、不要な権限要求を回避',
            'ヘディングのパス表示をトップレベル（level 0）のみに統一',
            'マークダウンデータが大量でもJSON入力エリアが潰れない改善',
            'コード構造の改善と可読性向上'
          ]
        },
        {
          version: 'v6',
          date: '2026-02-08',
          features: [
            '入力欄フォーカス時に自動的に入力セクションを展開',
            '折りたたまれている場合でも入力スペースが確実に表示されるように改善'
          ]
        },
        {
          version: 'v5',
          date: '2026-02-08',
          features: [
            'JSON入力セクションを開閉可能に（解析後は自動で閉じる）',
            'ブラウザのダークモードに対応',
            'ヘディングから冗長なコードブロック表示を削除し、階層構造を改善',
            'カラーパレット管理の改善で保守性向上'
          ]
        },
        {
          version: 'v4',
          date: '2026-02-08',
          features: [
            'ESCキーでビューアーを閉じる機能を追加',
            'KeyHandlerオブジェクトによるキーボード操作の一元管理で保守性向上'
          ]
        },
        {
          version: 'v3',
          date: '2026-02-08',
          features: [
            '初回リリース（履歴管理システム導入前）'
          ]
        }
      ]
    };

    // Centralized keyboard handler for maintainability
    const KeyHandler = {
      ESC: 'Escape',
      handleDocumentKey: null
    };

    // Constants for heading depth
    const HEADING_CONFIG = {
      MAX_HEADING_LEVEL: 6,  // Use h1 through h6
      MAX_HTML_HEADING: 6    // Support HTML headings up to h6
    };

    // Check if a string value is valid JSON
    function isValidJSON(str) {
      if (typeof str !== 'string') return false;
      // Skip empty strings and simple values
      const trimmed = str.trim();
      if (!trimmed) return false;
      // Only consider strings that start with { or [ as potential JSON
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
      
      try {
        const parsed = JSON.parse(trimmed);
        // Only consider objects and arrays as JSON (not primitives)
        return typeof parsed === 'object' && parsed !== null;
      } catch (e) {
        return false;
      }
    }

    // Format JSON string for code block display
    function formatJSONForCodeBlock(str) {
      try {
        const parsed = JSON.parse(str);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        return str;
      }
    }

    // Build JSON path string for headings
    function buildPath(parentPath, key) {
      if (!parentPath) return key;
      // Handle array indices
      if (key.startsWith('[')) return `${parentPath}${key}`;
      return `${parentPath}.${key}`;
    }

    // Create heading markup based on level (h1-h6, then b tags for deeper levels)
    function createHeadingMarkup(level, text) {
      const effectiveLevel = level + 1;
      if (effectiveLevel <= HEADING_CONFIG.MAX_HEADING_LEVEL) {
        const prefix = '#'.repeat(effectiveLevel);
        return `${prefix} ${text}`;
      } else {
        // Use bold for levels deeper than h6
        return `**${text}**`;
      }
    }

    // JSON to Markdown converter with path tracking
    function jsonToMarkdown(data, level = 0, parentPath = '') {
      const indent = '  '.repeat(level);
      let markdown = '';

      if (data === null) {
        return `${indent}*null*\n`;
      }

      if (data === undefined) {
        return `${indent}*undefined*\n`;
      }

      if (typeof data === 'boolean') {
        return `${indent}**${data}**\n`;
      }

      if (typeof data === 'number') {
        return `${indent}\`${data}\`\n`;
      }

      if (typeof data === 'string') {
        // Check if the string is valid JSON - if so, display as JSON code block
        if (isValidJSON(data)) {
          const formattedJSON = formatJSONForCodeBlock(data);
          const jsonLines = formattedJSON.split('\n');
          const codeBlock = [
            `${indent}\`\`\`json`,
            ...jsonLines.map(line => `${indent}${line}`),
            `${indent}\`\`\``
          ].join('\n') + '\n';
          return codeBlock;
        }
        
        // Handle multiline strings with simple line breaks
        if (data.includes('\n')) {
          const lines = data.split('\n');
          lines.forEach(line => {
            markdown += `${indent}${escapeMarkdown(line)}\n`;
          });
          return markdown;
        }
        return `${indent}${escapeMarkdown(data)}\n`;
      }

      if (Array.isArray(data)) {
        if (data.length === 0) {
          return `${indent}*Empty Array*\n`;
        }
        
        data.forEach((item, index) => {
          const indexKey = `[${index}]`;
          const currentPath = buildPath(parentPath, indexKey);
          
          // Only display heading with path if it contains a dot (dot-notation)
          if (currentPath && currentPath.includes('.')) {
            const heading = createHeadingMarkup(level, currentPath);
            markdown += `${indent}${heading}\n`;
          }
          
          markdown += jsonToMarkdown(item, level + 1, currentPath);
        });
        return markdown;
      }

      if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length === 0) {
          return `${indent}*Empty Object*\n`;
        }

        keys.forEach(key => {
          const value = data[key];
          const currentPath = buildPath(parentPath, key);
          
          // Only display headings with paths that contain dots (dot-notation)
          const shouldShowHeading = currentPath && currentPath.includes('.');
          
          // For primitive values, show inline
          if (value === null || value === undefined || 
              typeof value === 'boolean' || typeof value === 'number') {
            if (shouldShowHeading) {
              const heading = createHeadingMarkup(level, currentPath);
              markdown += `${indent}${heading}: ${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
            } else {
              markdown += `${indent}${escapeMarkdown(key)}: ${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
            }
          } else if (typeof value === 'string' && !value.includes('\n')) {
            if (shouldShowHeading) {
              const heading = createHeadingMarkup(level, currentPath);
              markdown += `${indent}${heading}: ${escapeMarkdown(value)}\n`;
            } else {
              markdown += `${indent}${escapeMarkdown(key)}: ${escapeMarkdown(value)}\n`;
            }
          } else {
            // For complex values, show on new line
            if (shouldShowHeading) {
              const heading = createHeadingMarkup(level, currentPath);
              markdown += `${indent}${heading}\n`;
            }
            markdown += jsonToMarkdown(value, level + 1, currentPath);
          }
        });
        return markdown;
      }

      return `${indent}${String(data)}\n`;
    }

    // Escape special markdown characters
    function escapeMarkdown(text) {
      if (typeof text !== 'string') return String(text);
      return text
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/`/g, '\\`');
    }

    // Escape HTML (needed for code blocks)
    function escapeHtml(text) {
      if (typeof text !== 'string') return String(text);
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Process code blocks (```language ... ```)
    function processCodeBlocks(text) {
      // Match code blocks with optional language specifier and flexible newline handling
      // Pattern: ```[language][\n]?[content]```
      // Note: Non-greedy match works for single code blocks; nested blocks within blocks are not supported
      const codeBlockPattern = /```(\w*)\n?([\s\S]*?)```/g;
      
      return text.replace(codeBlockPattern, (match, language, code) => {
        const langClass = language ? ` class="language-${escapeHtml(language)}"` : '';
        // Trim removes markdown indentation while preserving internal code structure
        const escapedCode = escapeHtml(code.trim());
        return `<pre${langClass}><code>${escapedCode}</code></pre>`;
      });
    }

    // Markdown to HTML converter
    function markdownToHtml(markdown) {
      let html = markdown;

      // Process code blocks first (before inline code)
      html = processCodeBlocks(html);

      // Process lists before other inline elements
      html = processMarkdownLists(html);

      // Process headings (after lists, before line breaks) - handle indentation with \s*
      // Support h1 through h6 - process from longest to shortest to avoid conflicts
      html = html.replace(/^\s*###### (.*?)$/gm, '<h6>$1</h6>');
      html = html.replace(/^\s*##### (.*?)$/gm, '<h5>$1</h5>');
      html = html.replace(/^\s*#### (.*?)$/gm, '<h4>$1</h4>');
      html = html.replace(/^\s*### (.*?)$/gm, '<h3>$1</h3>');
      html = html.replace(/^\s*## (.*?)$/gm, '<h2>$1</h2>');
      html = html.replace(/^\s*# (.*?)$/gm, '<h1>$1</h1>');

      // Bold (non-greedy, don't cross line breaks, skip escaped)
      html = html.replace(/(?<!\\)\*\*([^\n*]+?)\*\*/g, '<strong>$1</strong>');

      // Italic (non-greedy, don't cross line breaks, skip escaped and bold markers)
      html = html.replace(/(?<!\\)\*([^\n*]+?)\*(?!\*)/g, '<em>$1</em>');

      // Inline code
      html = html.replace(/`(.*?)`/g, '<code>$1</code>');

      // Line breaks
      html = html.replace(/\n/g, '<br>');

      return html;
    }

    // Process markdown lists and convert to HTML list elements
    function processMarkdownLists(text) {
      const lines = text.split('\n');
      const result = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const listMatch = detectListItem(line);

        if (listMatch) {
          // Process a list block starting from this line
          const listBlock = extractListBlock(lines, i);
          const listHtml = convertListBlockToHtml(listBlock);
          result.push(listHtml);
          i += listBlock.length;
        } else {
          result.push(line);
          i++;
        }
      }

      return result.join('\n');
    }

    // Detect if a line is a list item and return its properties
    function detectListItem(line) {
      // Match unordered list: -, *, or + followed by space
      const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
      if (unorderedMatch) {
        return {
          type: 'unordered',
          indent: unorderedMatch[1].length,
          marker: unorderedMatch[2],
          content: unorderedMatch[3]
        };
      }

      // Match ordered list: number followed by . and space
      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        return {
          type: 'ordered',
          indent: orderedMatch[1].length,
          number: parseInt(orderedMatch[2]),
          content: orderedMatch[3]
        };
      }

      return null;
    }

    // Extract a complete list block (all consecutive list items)
    function extractListBlock(lines, startIndex) {
      const block = [];
      let i = startIndex;

      while (i < lines.length) {
        const line = lines[i];
        const listMatch = detectListItem(line);

        if (listMatch) {
          block.push({ line, match: listMatch });
          i++;
        } else if (line.trim() === '' && i + 1 < lines.length) {
          // Check if there's another list item after the empty line
          const nextMatch = detectListItem(lines[i + 1]);
          if (nextMatch) {
            // Empty line within list - keep it
            block.push({ line, match: null });
            i++;
          } else {
            // Empty line ends the list
            break;
          }
        } else {
          // Non-list line ends the list
          break;
        }
      }

      return block;
    }

    // Convert a list block to HTML with proper nesting
    function convertListBlockToHtml(listBlock) {
      if (listBlock.length === 0) return '';

      const root = { children: [], indent: -1, type: null };
      const stack = [root];

      listBlock.forEach(({ line, match }) => {
        if (!match) {
          // Empty line - skip in HTML output
          return;
        }

        const currentIndent = match.indent;
        
        // Find the correct parent based on indentation
        while (stack.length > 1 && stack[stack.length - 1].indent >= currentIndent) {
          stack.pop();
        }

        const parent = stack[stack.length - 1];
        const item = {
          type: match.type,
          content: match.content,
          indent: currentIndent,
          children: []
        };

        parent.children.push(item);
        stack.push(item);
      });

      // Build HTML from the tree structure
      return buildListHtml(root.children);
    }

    // Recursively build HTML list structure
    function buildListHtml(items) {
      if (items.length === 0) return '';

      // Group consecutive items of the same type
      const groups = [];
      let currentGroup = null;

      items.forEach(item => {
        if (!currentGroup || currentGroup.type !== item.type) {
          currentGroup = { type: item.type, items: [] };
          groups.push(currentGroup);
        }
        currentGroup.items.push(item);
      });

      // Convert each group to HTML
      let html = '';
      groups.forEach(group => {
        const tag = group.type === 'ordered' ? 'ol' : 'ul';
        html += `<${tag}>`;
        
        group.items.forEach(item => {
          html += '<li>';
          html += item.content;
          
          // Process nested lists
          if (item.children.length > 0) {
            html += buildListHtml(item.children);
          }
          
          html += '</li>';
        });
        
        html += `</${tag}>`;
      });

      return html;
    }

    // Create widget container
    const host = document.createElement('div');
    host.id = ID;
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      `z-index:${Z_INDEX.BASE}`,
      'border:none',
      'outline:none',
      'background:transparent'
    ].join(';');

    const root = host.attachShadow({ mode: 'open' });

    // Widget styles
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* Helper function to get color based on theme */
      :host {
        color-scheme: light dark;
      }

      @media (prefers-color-scheme: dark) {
        .container {
          background: ${COLORS.DARK.CONTAINER_BG} !important;
        }
        
        .header {
          background: ${COLORS.DARK.BACKGROUND} !important;
          border-bottom: 1px solid ${COLORS.DARK.BORDER} !important;
        }
        
        .title {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .input-section {
          background: ${COLORS.DARK.BACKGROUND} !important;
          border-bottom: 1px solid ${COLORS.DARK.BORDER} !important;
        }
        
        .json-input {
          background-color: ${COLORS.DARK.INPUT_BG} !important;
          border-color: ${COLORS.DARK.BORDER} !important;
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .json-input:focus {
          border-color: ${COLORS.DARK.PRIMARY} !important;
          box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.1) !important;
        }
        
        .btn-secondary {
          background: ${COLORS.DARK.BACKGROUND} !important;
          color: ${COLORS.DARK.TEXT} !important;
          border: 1px solid ${COLORS.DARK.BORDER} !important;
        }
        
        .btn-secondary:hover {
          background: #3d3d3d !important;
        }
        
        .btn-primary {
          background: ${COLORS.DARK.PRIMARY} !important;
        }
        
        .btn-primary:hover {
          background: ${COLORS.DARK.PRIMARY_HOVER} !important;
        }
        
        .close-btn {
          background: ${COLORS.DARK.DANGER} !important;
        }
        
        .close-btn:hover {
          background: ${COLORS.DARK.DANGER_HOVER} !important;
        }
        
        .markdown-output {
          color: ${COLORS.DARK.TEXT} !important;
          font-size: 16px !important;
        }
        
        .markdown-output h1,
        .markdown-output h2,
        .markdown-output h3,
        .markdown-output h4,
        .markdown-output h5,
        .markdown-output h6 {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .markdown-output h1 {
          border-bottom: 2px solid ${COLORS.DARK.BORDER} !important;
          font-size: 28px !important;
        }

        .markdown-output h2 {
          font-size: 24px !important;
        }

        .markdown-output h3 {
          font-size: 20px !important;
        }
        
        .markdown-output h4 {
          font-size: 18px !important;
        }
        
        .markdown-output h5 {
          font-size: 16px !important;
        }
        
        .markdown-output h6 {
          font-size: 14px !important;
        }
        
        .markdown-output strong {
          color: ${COLORS.DARK.TEXT} !important;
          font-size: 16px !important;
        }
        
        .markdown-output em {
          color: ${COLORS.DARK.TEXT_LIGHT} !important;
        }
        
        .markdown-output code {
          background: ${COLORS.DARK.CODE_BG} !important;
          color: #ff79c6 !important;
          font-size: 14px !important;
        }

        .markdown-output pre {
          background: ${COLORS.DARK.CODE_BG} !important;
          border: 1px solid ${COLORS.DARK.BORDER} !important;
        }

        .markdown-output pre code {
          background: none !important;
          color: ${COLORS.DARK.TEXT} !important;
        }

        .markdown-output ul,
        .markdown-output ol {
          color: ${COLORS.DARK.TEXT} !important;
        }

        .markdown-output li {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .error-message {
          color: ${COLORS.DARK.DANGER} !important;
          background: ${COLORS.DARK.ERROR_BG} !important;
          border: 1px solid ${COLORS.DARK.DANGER} !important;
        }
        
        .empty-state {
          color: ${COLORS.DARK.TEXT_LIGHT} !important;
        }
        
        .toggle-icon {
          color: ${COLORS.DARK.TEXT} !important;
        }
      }

      .container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 95%;
        max-width: 1200px;
        max-height: 95vh;
        background: ${COLORS.LIGHT.CONTAINER_BG};
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: ${Z_INDEX.BASE};
      }

      .header {
        padding: 20px;
        border-bottom: 1px solid ${COLORS.LIGHT.BORDER};
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${COLORS.LIGHT.BACKGROUND};
        border-radius: 12px 12px 0 0;
        flex-shrink: 0;
      }

      .title {
        font-size: 20px;
        font-weight: 600;
        color: ${COLORS.LIGHT.TEXT};
      }

      .close-btn {
        background: ${COLORS.LIGHT.DANGER};
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
      }

      .close-btn:hover {
        background: ${COLORS.LIGHT.DANGER_HOVER};
      }

      .input-section {
        border-bottom: 1px solid ${COLORS.LIGHT.BORDER};
        background: ${COLORS.LIGHT.BACKGROUND};
        overflow: hidden;
        transition: max-height 0.3s ease-out;
        flex-shrink: 0;
      }

      .input-section.collapsed {
        max-height: 60px;
      }

      .input-section.expanded {
        max-height: 500px;
      }

      .input-header {
        padding: 20px 20px 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
      }

      .input-header-title {
        font-size: 14px;
        font-weight: 600;
        color: ${COLORS.LIGHT.TEXT};
      }

      .toggle-icon {
        font-size: 16px;
        transition: transform 0.3s ease;
        color: ${COLORS.LIGHT.TEXT};
      }

      .toggle-icon.collapsed {
        transform: rotate(-90deg);
      }

      .input-body {
        padding: 12px 20px 20px 20px;
      }

      .textarea-wrapper {
        position: relative;
      }

      .json-input {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px solid ${COLORS.LIGHT.BORDER};
        border-radius: 6px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        resize: vertical;
        color: ${COLORS.LIGHT.TEXT};
        background-color: ${COLORS.LIGHT.INPUT_BG};
      }

      .json-input:focus {
        outline: none;
        border-color: ${COLORS.LIGHT.PRIMARY};
        box-shadow: 0 0 0 3px rgba(26,115,232,0.1);
      }

      .button-group {
        margin-top: 12px;
        display: flex;
        gap: 8px;
      }

      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .btn-primary {
        background: ${COLORS.LIGHT.PRIMARY};
        color: white;
      }

      .btn-primary:hover {
        background: ${COLORS.LIGHT.PRIMARY_HOVER};
      }

      .btn-secondary {
        background: white;
        color: ${COLORS.LIGHT.TEXT};
        border: 1px solid ${COLORS.LIGHT.BORDER};
      }

      .btn-secondary:hover {
        background: ${COLORS.LIGHT.BACKGROUND};
      }

      .content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .markdown-output {
        font-size: 16px;
        line-height: 1.6;
        color: ${COLORS.LIGHT.TEXT};
        word-wrap: break-word;
      }

      .markdown-output h1 {
        font-size: 28px;
        margin: 16px 0 12px 0;
        color: ${COLORS.LIGHT.TEXT};
        border-bottom: 2px solid ${COLORS.LIGHT.BORDER};
        padding-bottom: 8px;
      }

      .markdown-output h2 {
        font-size: 24px;
        margin: 14px 0 10px 0;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output h3 {
        font-size: 20px;
        margin: 12px 0 8px 0;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output h4 {
        font-size: 18px;
        margin: 10px 0 6px 0;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output h5 {
        font-size: 16px;
        margin: 8px 0 4px 0;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output h6 {
        font-size: 14px;
        margin: 6px 0 4px 0;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output strong {
        font-weight: 600;
        font-size: 16px;
        color: ${COLORS.LIGHT.TEXT};
      }

      .markdown-output em {
        font-style: italic;
        color: ${COLORS.LIGHT.TEXT_LIGHT};
      }

      .markdown-output code {
        background: ${COLORS.LIGHT.CODE_BG};
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 14px;
        color: #d63384;
      }

      .markdown-output pre {
        background: ${COLORS.LIGHT.CODE_BG};
        border: 1px solid ${COLORS.LIGHT.BORDER};
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
        margin: 12px 0;
      }

      .markdown-output pre code {
        background: none;
        padding: 0;
        border-radius: 0;
        color: ${COLORS.LIGHT.TEXT};
        font-size: 13px;
        line-height: 1.5;
        white-space: pre;
      }

      .markdown-output ul,
      .markdown-output ol {
        margin: 8px 0;
        padding-left: 24px;
      }

      .markdown-output li {
        margin: 4px 0;
        line-height: 1.6;
      }

      .markdown-output ul {
        list-style-type: disc;
      }

      .markdown-output ol {
        list-style-type: decimal;
      }

      .markdown-output ul ul {
        list-style-type: circle;
      }

      .markdown-output ul ul ul {
        list-style-type: square;
      }

      .error-message {
        color: ${COLORS.LIGHT.DANGER};
        padding: 12px;
        background: ${COLORS.LIGHT.ERROR_BG};
        border: 1px solid ${COLORS.LIGHT.DANGER};
        border-radius: 6px;
        margin-bottom: 12px;
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: ${COLORS.LIGHT.TEXT_LIGHT};
      }

      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .empty-state-text {
        font-size: 16px;
      }
    `;

    root.appendChild(style);

    // Create UI using safe DOM manipulation
    const container = createUIStructure();
    root.appendChild(container);

    // Get elements
    const closeBtn = root.querySelector('.close-btn');
    const inputSection = root.querySelector('.input-section');
    const inputHeader = root.querySelector('.input-header');
    const toggleIcon = root.querySelector('.toggle-icon');
    const jsonInput = root.querySelector('.json-input');
    const parseBtn = root.querySelector('.parse-btn');
    const clearBtn = root.querySelector('.clear-btn');
    const content = root.querySelector('.content');

    let currentMarkdown = '';
    let isInputExpanded = true;

    // Set input section expanded state
    const setInputSectionExpanded = (expanded) => {
      isInputExpanded = expanded;
      if (expanded) {
        inputSection.classList.remove('collapsed');
        inputSection.classList.add('expanded');
        toggleIcon.classList.remove('collapsed');
      } else {
        inputSection.classList.remove('expanded');
        inputSection.classList.add('collapsed');
        toggleIcon.classList.add('collapsed');
      }
    };

    // Toggle input section
    const toggleInputSection = () => {
      setInputSectionExpanded(!isInputExpanded);
    };

    // Close handler
    const close = () => {
      document.removeEventListener('keydown', KeyHandler.handleDocumentKey);
      host.remove();
    };
    host._close = close;

    // Set up document key handler
    KeyHandler.handleDocumentKey = (e) => {
      if (e.key === KeyHandler.ESC) {
        close();
      }
    };

    document.addEventListener('keydown', KeyHandler.handleDocumentKey);
    closeBtn.addEventListener('click', close);
    inputHeader.addEventListener('click', toggleInputSection);

    // Auto-expand input section when textarea is focused
    jsonInput.addEventListener('focus', () => {
      if (!isInputExpanded) {
        setInputSectionExpanded(true);
      }
    });

    // Parse and display JSON
    const parseAndDisplay = () => {
      const jsonText = jsonInput.value.trim();
      
      if (!jsonText) {
        setElementContent(content, createEmptyStateView());
        currentMarkdown = '';
        return;
      }

      try {
        const jsonData = JSON.parse(jsonText);
        currentMarkdown = jsonToMarkdown(jsonData);
        const html = markdownToHtml(currentMarkdown);
        
        const outputDiv = document.createElement('div');
        outputDiv.className = 'markdown-output';
        
        // Safely parse HTML and append to output div
        const htmlContent = createElementsFromHTML(html);
        outputDiv.appendChild(htmlContent);
        
        setElementContent(content, outputDiv);
        
        // Close input section after successful parsing
        if (isInputExpanded) {
          setInputSectionExpanded(false);
        }
      } catch (error) {
        setElementContent(content, createErrorView(escapeHtml(error.message)));
        currentMarkdown = '';
      }
    };

    // Clear input
    const clearInput = () => {
      jsonInput.value = '';
      setElementContent(content, createEmptyStateView());
      currentMarkdown = '';
    };

    // Helper function to safely create elements with text content
    function createElementWithText(tag, text, className = '') {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    }

    // Helper function to safely parse HTML string into DOM elements
    function createElementsFromHTML(htmlString) {
      const template = document.createElement('template');
      template.innerHTML = htmlString;
      return template.content;
    }

    // Helper function to safely set element content (text or HTML structure)
    function setElementContent(element, content) {
      // Clear existing content
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      
      if (typeof content === 'string') {
        // If content is a string, set as text content
        element.textContent = content;
      } else if (content instanceof DocumentFragment || content instanceof Node) {
        // If content is a DOM node or fragment, append it
        element.appendChild(content);
      }
    }

    // Create empty state view
    function createEmptyStateView() {
      const container = document.createElement('div');
      container.className = 'empty-state';
      
      const icon = createElementWithText('div', '📊', 'empty-state-icon');
      const text = createElementWithText('div', 'JSONデータを入力して「解析して表示」をクリックしてください', 'empty-state-text');
      
      container.appendChild(icon);
      container.appendChild(text);
      
      return container;
    }

    // Create error view
    function createErrorView(errorMessage) {
      const container = document.createElement('div');
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      
      const strong = document.createElement('strong');
      strong.textContent = 'エラー:';
      errorDiv.appendChild(strong);
      errorDiv.appendChild(document.createTextNode(' ' + errorMessage));
      
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      
      const icon = createElementWithText('div', '⚠️', 'empty-state-icon');
      const text = createElementWithText('div', '有効なJSONデータを入力してください', 'empty-state-text');
      
      emptyState.appendChild(icon);
      emptyState.appendChild(text);
      
      container.appendChild(errorDiv);
      container.appendChild(emptyState);
      
      return container;
    }

    // Create UI structure safely
    function createUIStructure() {
      const container = document.createElement('div');
      container.className = 'container';
      
      // Header
      const header = document.createElement('div');
      header.className = 'header';
      
      const title = createElementWithText('div', '📊 JSON Viewer', 'title');
      const closeBtn = createElementWithText('button', '閉じる', 'close-btn');
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      
      // Input section
      const inputSection = document.createElement('div');
      inputSection.className = 'input-section expanded';
      
      // Input header (collapsible)
      const inputHeader = document.createElement('div');
      inputHeader.className = 'input-header';
      
      const inputHeaderTitle = createElementWithText('div', 'JSON入力', 'input-header-title');
      const toggleIcon = createElementWithText('span', '▼', 'toggle-icon');
      
      inputHeader.appendChild(inputHeaderTitle);
      inputHeader.appendChild(toggleIcon);
      
      // Input body
      const inputBody = document.createElement('div');
      inputBody.className = 'input-body';
      
      const textareaWrapper = document.createElement('div');
      textareaWrapper.className = 'textarea-wrapper';
      
      const textarea = document.createElement('textarea');
      textarea.className = 'json-input';
      textarea.placeholder = 'JSONデータをここに貼り付けてください...';
      textareaWrapper.appendChild(textarea);
      
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'button-group';
      
      const parseBtn = createElementWithText('button', '解析して表示', 'btn btn-primary parse-btn');
      const clearBtn = createElementWithText('button', 'クリア', 'btn btn-secondary clear-btn');
      
      buttonGroup.appendChild(parseBtn);
      buttonGroup.appendChild(clearBtn);
      
      inputBody.appendChild(textareaWrapper);
      inputBody.appendChild(buttonGroup);
      
      inputSection.appendChild(inputHeader);
      inputSection.appendChild(inputBody);
      
      // Content section
      const content = document.createElement('div');
      content.className = 'content';
      content.appendChild(createEmptyStateView());
      
      // Assemble container
      container.appendChild(header);
      container.appendChild(inputSection);
      container.appendChild(content);
      
      return container;
    }

    // Event listeners
    parseBtn.addEventListener('click', parseAndDisplay);
    clearBtn.addEventListener('click', clearInput);

    // Parse on Ctrl+Enter / Cmd+Enter
    jsonInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        parseAndDisplay();
      }
    });

    document.body.appendChild(host);
  } catch (error) {
    alert('Error: ' + error.message);
  }
})();

// JSON Viewer
// 複雑にネストされたJSONデータをマークダウン形式で綺麗に表示するビューアー
// 📊
// v4
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

    // Centralized color constants
    const COLORS = {
      PRIMARY: '#1a73e8',
      PRIMARY_HOVER: '#1557b0',
      DANGER: '#dc3545',
      DANGER_HOVER: '#c82333',
      SUCCESS: '#28a745',
      BORDER: '#ddd',
      BACKGROUND: '#f8f9fa',
      TEXT: '#333',
      TEXT_LIGHT: '#666'
    };

    // Centralized version management
    const VERSION_INFO = {
      CURRENT: 'v4',
      LAST_UPDATED: '2026-02-08',
      HISTORY: [
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

    // Build JSON path string for headings
    function buildPath(parentPath, key) {
      if (!parentPath) return key;
      // Handle array indices
      if (key.startsWith('[')) return `${parentPath}${key}`;
      return `${parentPath}.${key}`;
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
          const prefix = level === 0 ? `## ` : '';
          const pathDisplay = currentPath ? ` \`${currentPath}\`` : '';
          markdown += `${indent}${prefix}**${indexKey}**${pathDisplay}\n`;
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
          const prefix = level === 0 ? `## ` : level === 1 ? `### ` : '';
          const pathDisplay = currentPath && level <= 1 ? ` \`${currentPath}\`` : '';
          
          // For primitive values, show inline
          if (value === null || value === undefined || 
              typeof value === 'boolean' || typeof value === 'number') {
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**${pathDisplay}: ${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
          } else if (typeof value === 'string' && !value.includes('\n')) {
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**${pathDisplay}: ${escapeMarkdown(value)}\n`;
          } else {
            // For complex values, show on new line
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**${pathDisplay}\n`;
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

    // Markdown to HTML converter
    function markdownToHtml(markdown) {
      let html = markdown;

      // Headers (process in reverse order to handle ### before ##)
      html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

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

      .container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 95%;
        max-width: 1200px;
        max-height: 95vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: ${Z_INDEX.BASE};
      }

      .header {
        padding: 20px;
        border-bottom: 1px solid ${COLORS.BORDER};
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: ${COLORS.BACKGROUND};
        border-radius: 12px 12px 0 0;
      }

      .title {
        font-size: 20px;
        font-weight: 600;
        color: ${COLORS.TEXT};
      }

      .close-btn {
        background: ${COLORS.DANGER};
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
        background: ${COLORS.DANGER_HOVER};
      }

      .input-section {
        padding: 20px;
        border-bottom: 1px solid ${COLORS.BORDER};
        background: ${COLORS.BACKGROUND};
      }

      .textarea-wrapper {
        position: relative;
      }

      .json-input {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px solid ${COLORS.BORDER};
        border-radius: 6px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        resize: vertical;
        color: ${COLORS.TEXT};
        background-color: white;
      }

      .json-input:focus {
        outline: none;
        border-color: ${COLORS.PRIMARY};
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
        background: ${COLORS.PRIMARY};
        color: white;
      }

      .btn-primary:hover {
        background: ${COLORS.PRIMARY_HOVER};
      }

      .btn-secondary {
        background: white;
        color: ${COLORS.TEXT};
        border: 1px solid ${COLORS.BORDER};
      }

      .btn-secondary:hover {
        background: ${COLORS.BACKGROUND};
      }

      .content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .markdown-output {
        font-size: 14px;
        line-height: 1.6;
        color: ${COLORS.TEXT};
        word-wrap: break-word;
      }

      .markdown-output h1 {
        font-size: 24px;
        margin: 16px 0 12px 0;
        color: ${COLORS.TEXT};
        border-bottom: 2px solid ${COLORS.BORDER};
        padding-bottom: 8px;
      }

      .markdown-output h2 {
        font-size: 20px;
        margin: 14px 0 10px 0;
        color: ${COLORS.TEXT};
      }

      .markdown-output h3 {
        font-size: 16px;
        margin: 12px 0 8px 0;
        color: ${COLORS.TEXT};
      }

      .markdown-output strong {
        font-weight: 600;
        color: ${COLORS.TEXT};
      }

      .markdown-output em {
        font-style: italic;
        color: ${COLORS.TEXT_LIGHT};
      }

      .markdown-output code {
        background: ${COLORS.BACKGROUND};
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        color: #d63384;
      }

      .error-message {
        color: ${COLORS.DANGER};
        padding: 12px;
        background: #fff5f5;
        border: 1px solid ${COLORS.DANGER};
        border-radius: 6px;
        margin-bottom: 12px;
      }

      .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: ${COLORS.TEXT_LIGHT};
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
    const jsonInput = root.querySelector('.json-input');
    const parseBtn = root.querySelector('.parse-btn');
    const clearBtn = root.querySelector('.clear-btn');
    const content = root.querySelector('.content');

    let currentMarkdown = '';

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

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

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
      inputSection.className = 'input-section';
      
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
      
      inputSection.appendChild(textareaWrapper);
      inputSection.appendChild(buttonGroup);
      
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

    // Try to get JSON from clipboard on load
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          jsonInput.value = text;
          parseAndDisplay();
        }
      } catch (error) {
        // Clipboard access denied or failed, ignore
      }
    })();

    document.body.appendChild(host);
  } catch (error) {
    alert('Error: ' + error.message);
  }
})();

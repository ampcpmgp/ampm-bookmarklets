// JSON Viewer
// 複雑にネストされたJSONデータをマークダウン形式で綺麗に表示するビューアー
// 📊
// v1
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

    // JSON to Markdown converter
    function jsonToMarkdown(data, level = 0, parentKey = '') {
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
        // Handle multiline strings
        if (data.includes('\n')) {
          const lines = data.split('\n');
          markdown += `${indent}>\n`;
          lines.forEach(line => {
            markdown += `${indent}> ${escapeMarkdown(line)}\n`;
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
          const prefix = level === 0 ? `## ` : '';
          markdown += `${indent}${prefix}**[${index}]**\n`;
          markdown += jsonToMarkdown(item, level + 1, `[${index}]`);
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
          const prefix = level === 0 ? `## ` : level === 1 ? `### ` : '';
          
          // For primitive values, show inline
          if (value === null || value === undefined || 
              typeof value === 'boolean' || typeof value === 'number') {
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**: ${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
          } else if (typeof value === 'string' && !value.includes('\n')) {
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**: ${escapeMarkdown(value)}\n`;
          } else {
            // For complex values, show on new line
            markdown += `${indent}${prefix}**${escapeMarkdown(key)}**\n`;
            markdown += jsonToMarkdown(value, level + 1, key);
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

      // Headers
      html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

      // Blockquotes
      html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

      // Bold
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Italic
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

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
        width: 90%;
        max-width: 900px;
        max-height: 90vh;
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

      .markdown-output blockquote {
        border-left: 4px solid ${COLORS.PRIMARY};
        padding-left: 12px;
        margin: 8px 0;
        color: ${COLORS.TEXT_LIGHT};
        background: ${COLORS.BACKGROUND};
        padding: 8px 12px;
        border-radius: 0 4px 4px 0;
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

    // Create UI
    const container = document.createElement('div');
    container.className = 'container';

    container.innerHTML = `
      <div class="header">
        <div class="title">📊 JSON Viewer</div>
        <button class="close-btn">閉じる</button>
      </div>
      <div class="input-section">
        <div class="textarea-wrapper">
          <textarea class="json-input" placeholder="JSONデータをここに貼り付けてください..."></textarea>
        </div>
        <div class="button-group">
          <button class="btn btn-primary parse-btn">解析して表示</button>
          <button class="btn btn-secondary clear-btn">クリア</button>
          <button class="btn btn-secondary copy-markdown-btn">Markdownをコピー</button>
        </div>
      </div>
      <div class="content">
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">JSONデータを入力して「解析して表示」をクリックしてください</div>
        </div>
      </div>
    `;

    root.appendChild(container);

    // Get elements
    const closeBtn = root.querySelector('.close-btn');
    const jsonInput = root.querySelector('.json-input');
    const parseBtn = root.querySelector('.parse-btn');
    const clearBtn = root.querySelector('.clear-btn');
    const copyMarkdownBtn = root.querySelector('.copy-markdown-btn');
    const content = root.querySelector('.content');

    let currentMarkdown = '';

    // Close handler
    const close = () => {
      host.remove();
    };
    host._close = close;
    closeBtn.addEventListener('click', close);

    // Parse and display JSON
    const parseAndDisplay = () => {
      const jsonText = jsonInput.value.trim();
      
      if (!jsonText) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <div class="empty-state-text">JSONデータを入力して「解析して表示」をクリックしてください</div>
          </div>
        `;
        currentMarkdown = '';
        return;
      }

      try {
        const jsonData = JSON.parse(jsonText);
        currentMarkdown = jsonToMarkdown(jsonData);
        const html = markdownToHtml(currentMarkdown);
        
        content.innerHTML = `<div class="markdown-output">${html}</div>`;
      } catch (error) {
        content.innerHTML = `
          <div class="error-message">
            <strong>エラー:</strong> ${escapeHtml(error.message)}
          </div>
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">有効なJSONデータを入力してください</div>
          </div>
        `;
        currentMarkdown = '';
      }
    };

    // Clear input
    const clearInput = () => {
      jsonInput.value = '';
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">JSONデータを入力して「解析して表示」をクリックしてください</div>
        </div>
      `;
      currentMarkdown = '';
    };

    // Copy markdown to clipboard
    const copyMarkdown = async () => {
      if (!currentMarkdown) {
        alert('まずJSONを解析してください');
        return;
      }

      try {
        await navigator.clipboard.writeText(currentMarkdown);
        const originalText = copyMarkdownBtn.textContent;
        copyMarkdownBtn.textContent = '✓ コピーしました';
        copyMarkdownBtn.style.background = COLORS.SUCCESS;
        setTimeout(() => {
          copyMarkdownBtn.textContent = originalText;
          copyMarkdownBtn.style.background = '';
        }, 2000);
      } catch (error) {
        alert('コピーに失敗しました: ' + error.message);
      }
    };

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Event listeners
    parseBtn.addEventListener('click', parseAndDisplay);
    clearBtn.addEventListener('click', clearInput);
    copyMarkdownBtn.addEventListener('click', copyMarkdown);

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

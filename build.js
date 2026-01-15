const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// HTML escape function to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Get last modified date from git
function getLastModifiedDate(filePath) {
  try {
    // Get the last commit date for the file in YYYY-MM-DD format
    const result = execSync(`git log -1 --format=%ci -- "${filePath}"`, { encoding: 'utf-8' });
    if (result.trim()) {
      // Extract just the date part (YYYY-MM-DD)
      return result.trim().split(' ')[0];
    }
  } catch (error) {
    // If git command fails, return empty string
  }
  return '';
}

// Read all bookmarklet files
const bookmarkletsDir = path.join(__dirname, 'bookmarklets');
const bookmarklets = [];

// Get all .js files from bookmarklets directory
const files = fs.readdirSync(bookmarkletsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(bookmarkletsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract title, description, emoji, and version from first four comment lines
  // Expected comment order: 1) title, 2) description, 3) emoji, 4) version
  const lines = content.split('\n');
  let title = file.replace('.js', '');
  let description = '';
  let emoji = '📎'; // Default emoji
  let version = ''; // Version information
  let commentCount = 0;
  const MAX_COMMENT_LINES = 4;
  
  for (let i = 0; i < lines.length && commentCount < MAX_COMMENT_LINES; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//')) {
      const text = line.substring(2).trim();
      if (commentCount === 0) {
        title = text;
      } else if (commentCount === 1) {
        description = text;
      } else if (commentCount === 2) {
        emoji = text;
      } else if (commentCount === 3) {
        version = text;
      }
      commentCount++;
    }
  }
  
  // Get last modified date from git
  const lastModified = getLastModifiedDate(filePath);
  
  // Remove single-line comments only, preserve code structure
  const code = content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//');
    })
    .join('\n')
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/\s+$/gm, '') // Remove trailing whitespace
    .trim();
  
  // Create bookmarklet URL
  const bookmarkletUrl = 'javascript:' + encodeURIComponent(code);
  
  bookmarklets.push({
    id: file.replace('.js', ''),
    title,
    description,
    emoji,
    version,
    lastModified,
    code: bookmarkletUrl
  });
});

// Generate index.html
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AMPM Bookmarklets</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 1rem;
      font-size: 2.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }
    .bookmarklet-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .bookmarklet-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }
    .bookmarklet-title {
      font-size: 1.5rem;
      color: #333;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .version-badge {
      display: inline-block;
      font-size: 0.75rem;
      color: #666;
      background: #f0f0f0;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: normal;
    }
    .bookmarklet-description {
      color: #666;
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    .bookmarklet-link {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.2s;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .bookmarklet-link:hover {
      opacity: 0.9;
    }
    .bookmarklet-link.emoji-only {
      padding: 0.75rem 1rem;
      font-size: 1.2rem;
    }
    .instructions {
      background: rgba(255,255,255,0.95);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .instructions h2 {
      color: #333;
      margin-bottom: 0.75rem;
      font-size: 1.3rem;
    }
    .instructions p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 0.5rem;
    }
    footer {
      text-align: center;
      color: rgba(255,255,255,0.8);
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255,255,255,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📚 AMPM Bookmarklets</h1>
    <p class="subtitle">便利なブックマークレット集</p>
    
    <div class="instructions">
      <h2>使い方</h2>
      <p>下のリンクをブックマークバーにドラッグ&ドロップして使用してください。</p>
      <p>ブラウザのブックマークバーが表示されていない場合は、Ctrl+Shift+B (Mac: Cmd+Shift+B) で表示できます。</p>
    </div>
    
${bookmarklets.map(bm => `    <div class="bookmarklet-card">
      <h3 class="bookmarklet-title">${escapeHtml(bm.title)}${bm.version ? `<span class="version-badge">${escapeHtml(bm.version)}${bm.lastModified ? ` (${escapeHtml(bm.lastModified)})` : ''}</span>` : ''}</h3>
      <p class="bookmarklet-description">${escapeHtml(bm.description)}</p>
      <a href="${escapeHtml(bm.code)}" class="bookmarklet-link" onclick="alert('このリンクをブックマークバーにドラッグしてください'); return false;">${escapeHtml(bm.emoji)} ${escapeHtml(bm.title)}${bm.version ? ` ${escapeHtml(bm.version)}` : ''}</a>
      <a href="${escapeHtml(bm.code)}" class="bookmarklet-link emoji-only" onclick="alert('このリンクをブックマークバーにドラッグしてください'); return false;">${escapeHtml(bm.emoji)}</a>
    </div>
`).join('\n')}
    
    <footer>
      <p>Generated: ${new Date().toISOString().split('T')[0]}</p>
      <p>© 2026 AMPM Bookmarklets</p>
    </footer>
  </div>
</body>
</html>
`;

// Write index.html
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

console.log(`✓ Generated index.html with ${bookmarklets.length} bookmarklet(s)`);
bookmarklets.forEach(bm => {
  console.log(`  - ${bm.title}`);
});

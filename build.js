const fs = require('fs');
const path = require('path');

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

// Read all bookmarklet files
const bookmarkletsDir = path.join(__dirname, 'bookmarklets');
const bookmarklets = [];

// Security check: Validate that bookmarklet code doesn't use innerHTML directly
// This check ensures compliance with Trusted Types API requirements
let hasInnerHTMLViolations = false;
const innerHTMLViolations = [];

// Get all .js files from bookmarklets directory
const files = fs.readdirSync(bookmarkletsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(bookmarkletsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract title, description, emoji, version, and update date from first five comment lines
  // Expected comment order: 1) title, 2) description, 3) emoji, 4) version, 5) update date
  const lines = content.split('\n');
  let title = file.replace('.js', '');
  let description = '';
  let emoji = '📎'; // Default emoji
  let version = ''; // Version information
  let updateDate = ''; // Update date information
  let commentCount = 0;
  const MAX_COMMENT_LINES = 5;
  
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
      } else if (commentCount === 4) {
        updateDate = text;
      }
      commentCount++;
    }
  }
  
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
  
  // Security check: Detect direct innerHTML usage (per CONTRIBUTING.md security guidelines)
  // Test each line individually for better accuracy
  const contentLines = content.split('\n');
  const violationLines = contentLines
    .map((line, index) => ({ line: line, number: index + 1 }))
    .filter(item => {
      const trimmed = item.line.trim();
      // Skip comment lines
      if (trimmed.startsWith('//')) return false;
      
      // Check if line has innerHTML assignment
      if (!/\.innerHTML\s*=/.test(item.line)) return false;
      
      // Check if it matches any safe pattern
      const safePatterns = [
        /dataTransfer\.setData\(['"]text\/html['"]/,  // Drag and drop data
        /template\.innerHTML/,                         // Template elements (safe)
        /return\s+\w+\.innerHTML(?!\s*=)/              // Reading innerHTML (safe), but not assignment
      ];
      
      return !safePatterns.some(p => p.test(item.line));
    })
    .map(item => `  Line ${item.number}: ${item.line.trim()}`);
  
  if (violationLines.length > 0) {
    hasInnerHTMLViolations = true;
    innerHTMLViolations.push({
      file,
      lines: violationLines
    });
  }
  
  // Create bookmarklet URL
  const bookmarkletUrl = 'javascript:' + encodeURIComponent(code);
  
  bookmarklets.push({
    id: file.replace('.js', ''),
    title,
    description,
    emoji,
    version,
    updateDate,
    code: bookmarkletUrl
  });
});

// Report innerHTML security violations
if (hasInnerHTMLViolations) {
  console.error('\n❌ SECURITY VIOLATION: Direct innerHTML usage detected!');
  console.error('\nThe following files contain unsafe innerHTML usage:');
  console.error('This violates the security guidelines in CONTRIBUTING.md');
  console.error('Modern browsers with Trusted Types will throw an error:');
  console.error('  "Failed to set the \'innerHTML\' property on \'Element\': This document requires \'TrustedHTML\' assignment."\n');
  
  innerHTMLViolations.forEach(violation => {
    console.error(`File: ${violation.file}`);
    violation.lines.forEach(line => console.error(line));
    console.error('');
  });
  
  console.error('Please use safe alternatives:');
  console.error('  • Use createElement() + textContent');
  console.error('  • Use appendChild() to build DOM');
  console.error('  • See CONTRIBUTING.md for detailed examples\n');
  
  // Exit with error code to fail CI/CD pipeline
  process.exit(1);
}

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
      <h3 class="bookmarklet-title">${escapeHtml(bm.title)}${bm.version ? `<span class="version-badge">${escapeHtml(bm.version)}${bm.updateDate ? ` (${escapeHtml(bm.updateDate)})` : ''}</span>` : ''}</h3>
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

// If PR_PREVIEW environment variable is set, also generate pr-preview.html
if (process.env.PR_PREVIEW === 'true') {
  fs.writeFileSync(path.join(__dirname, 'pr-preview.html'), html);
  console.log('✓ Generated pr-preview.html for PR preview');
}

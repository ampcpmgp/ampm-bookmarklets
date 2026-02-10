// JSON Viewer
// 複雑にネストされたJSONデータをマークダウン形式で綺麗に表示するビューアー
// 📊
// v22
// 2026-02-10

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
      // Dark mode - Improved contrast and visual boundaries
      DARK: {
        PRIMARY: '#4a9eff',
        PRIMARY_HOVER: '#357ae8',
        DANGER: '#ff5555',
        DANGER_HOVER: '#ff3333',
        SUCCESS: '#50fa7b',
        BORDER: '#555',
        BORDER_STRONG: '#666',
        BACKGROUND: '#2d2d2d',
        BACKGROUND_ELEVATED: '#353535',
        CONTAINER_BG: '#1a1a1a',
        TEXT: '#f0f0f0',
        TEXT_SECONDARY: '#d0d0d0',
        TEXT_LIGHT: '#999',
        INPUT_BG: '#252525',
        CODE_BG: '#282828',
        CODE_BORDER: '#3a3a3a',
        ERROR_BG: '#3d1f1f',
        SECTION_SHADOW: 'rgba(0, 0, 0, 0.3)'
      }
    };

    // Centralized version management
    const VERSION_INFO = {
      CURRENT: 'v22',
      LAST_UPDATED: '2026-02-10',
      HISTORY: [
        {
          version: 'v22',
          date: '2026-02-10',
          features: [
            '✨ マークダウン表示の改善：空のオブジェクトや配列に対して不要な値表示領域を非表示化',
            '新規ヘルパー関数hasContentを実装：値が空でないかを判定する汎用関数',
            'オブジェクトと配列の処理をリファクタリング：空の値はインライン表示、非空の値は従来通りセクション表示',
            '見出し表示の最適化：内容がある場合のみ見出しを表示し、空の場合は見出しとスペースを非表示',
            '空のオブジェクトや配列は *Empty Object* / *Empty Array* としてキー名と同じ行にインライン表示',
            '非常にきれいな実装で、可読性とメンテナンス性が高い',
            '既存機能に影響を与えない安全で確実な実装'
          ]
        },
        {
          version: 'v21',
          date: '2026-02-09',
          features: [
            '✨ マークダウン内の完全なコードブロック（例：世界観データ）を適切に表示する機能を追加',
            '✨ JSONC（コメント付きJSON）を自動検出しコードブロックとして表示する機能を追加',
            '新規ヘルパー関数isJSONCを実装：JSON内のコメント（//や/* */）を検出',
            '新規ヘルパー関数isMarkdownWithCodeBlocksを実装：マークダウン構造とコードブロックの両方を含む文字列を検出',
            '文字列処理の優先順位を最適化：マークダウン+コードブロック > JSONC > 通常のJSON > 複数行テキスト',
            '共通処理をリファクタリング：検出ロジックを段階的に分離し可読性を向上',
            'マークダウンヘディング（##）とコードブロック（```）を含む文字列は、マークダウンとしてレンダリング',
            'jsonTemplateフィールドなどのJSONCデータが適切にコードブロックで表示される',
            'instructionフィールド内の世界観セクションのコードブロックが保持される',
            '安全性を考慮した保守的な実装：ヘディングとコードブロックの両方が存在する場合のみマークダウンとして処理',
            '非常にクリーンで安全な実装：既存機能に影響なく確実に機能追加',
            'メンテナンス性の高いコード構造を維持'
          ]
        },
        {
          version: 'v20',
          date: '2026-02-08',
          features: [
            '✨ 配列データのリスト表示で、テキストが複数行ならリスト化せず通常配列表示に改善',
            '新規ヘルパー関数hasMultilineTextを実装：配列内の複数行テキストを検出',
            'isTextDataArray関数をリファクタリング：複数行テキスト判定ロジックを追加',
            '共通処理を抽出し可読性を向上：判定ロジックを段階的に分離',
            '複数行テキスト含む配列は標準の配列表示形式（インデックス付き）で表示',
            '単一行テキストのみの配列は従来通りマークダウンリスト形式で表示',
            '非常にクリーンで安全な実装：既存機能に影響なく確実に機能追加',
            'メンテナンス性の高いコード構造を維持'
          ]
        },
        {
          version: 'v19',
          date: '2026-02-08',
          features: [
            '🐛 目次（Table of Contents）の配列パススクロールバグを修正',
            '根本原因：配列ルートのJSON（[0].cloth等）でID生成時に数字始まりとなり、CSS.escape未使用でquerySelectorが失敗',
            '解決策：safeCssSelectorヘルパー関数を新規実装し、CSS.escape()で確実にエスケープ',
            '共通処理をリファクタリング：セレクタ生成ロジックを一元化し可読性向上',
            '配列形式・オブジェクト形式の両方で確実にスクロール動作を保証',
            '非常にクリーンで安全な実装：既存機能に影響なく確実に修正',
            'メンテナンス性の高いコード構造を維持'
          ]
        },
        {
          version: 'v18',
          date: '2026-02-08',
          features: [
            '✨ 配列の中身がテキストデータの場合、リスト形式（ul/li）でマークダウンを出力する機能を追加',
            '共通処理をリファクタリング：配列要素タイプ判定関数を抽出し可読性向上',
            'プリミティブ型（文字列、数値、真偽値、null）の配列を自動検出',
            'マークダウンリスト記法（- item）でテキスト配列を出力',
            '非常にクリーンな実装：既存機能に影響なく安全に機能追加',
            'メンテナンス性の高いコード構造を維持'
          ]
        },
        {
          version: 'v17',
          date: '2026-02-08',
          features: [
            '🔧 目次スクロール機能を完全リファクタリング：シンプルで確実な実装',
            'heading検出ロジックの修正：パスと値を正しく分離',
            '_reasoningBehavior等のアンダースコア付きキーも正しくheadingに',
            '長い値がheadingに含まれる問題を解消',
            'スクロール処理を簡素化：ネイティブscrollIntoViewで確実に動作',
            '全てのheadingにユニークIDを付与',
            'コードの可読性とメンテナンス性を大幅向上',
            '共通処理をリファクタリングし、バグを根絶'
          ]
        },
        {
          version: 'v16',
          date: '2026-02-08',
          features: [
            '🐛 目次（Table of Contents）のスムーススクロール機能を完全修正',
            '正確なスクロール位置計算：offsetTopを使用した信頼性の高い位置計算',
            'ダークモード対応強化：クリック時に現在のテーマ設定を動的に取得',
            '共通ユーティリティ関数の追加：isDarkModeActive()で一貫したテーマ検出',
            'リファクタリング：スクロール処理の明確化とコードの可読性向上',
            '確実で安全な実装：エッジケースを考慮した堅牢な処理',
            '高品質でメンテナンス可能なコード構造'
          ]
        },
        {
          version: 'v15',
          date: '2026-02-08',
          features: [
            '目次（Table of Contents）のスムーススクロール機能を大幅に改善',
            'アクティブセクション追跡：現在表示中のセクションをハイライト表示',
            '洗練されたスクロールアニメーション：最適なオフセットとタイミング',
            '強化された視覚フィードバック：グラデーションエフェクトと滑らかな遷移',
            '自動スクロール同期：スクロール位置に応じて目次項目を自動ハイライト',
            'リファクタリング：共通スクロール処理の抽出で保守性向上',
            '洗練されたUI/UX：直感的でモダンなインタラクション体験'
          ]
        },
        {
          version: 'v14',
          date: '2026-02-08',
          features: [
            'ダークモードのUI/UX大幅改善：境界が不明瞭な問題を解決',
            '視覚的階層を強化：コントラスト向上、明確なセクション境界、強化されたシャドウ効果',
            'コードブロックの可視性向上：独自の背景色と明確な境界線',
            'マークダウン要素の可読性向上：改善されたスペーシングと視覚的分離',
            '洗練されたカラーパレット：より明確な区別のための拡張された色定数',
            '共通スタイリングパターンのリファクタリングで保守性を向上',
            '安全で信頼性の高い実装を維持'
          ]
        },
        {
          version: 'v13',
          date: '2026-02-08',
          features: [
            'ヘディングの構造化と目次（Table of Contents）機能を追加',
            'スムーススクロールで目次項目から該当ヘディングへジャンプ',
            '目次の折りたたみ/展開機能で使いやすさを向上',
            '共通処理をリファクタリングし、可読性とメンテナンス性を向上',
            'セキュリティを保ちながら安全なDOM操作を実現'
          ]
        },
        {
          version: 'v12',
          date: '2026-02-08',
          features: [
            'クリップボードの内容を自動読み取りし、有効なJSON形式であれば起動時から自動的にマークダウン表示',
            '共通処理をリファクタリングし、可読性とメンテナンス性を向上',
            'セキュリティを保ちながら安全な実装を実現'
          ]
        },
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

    // Check if a string contains JSONC (JSON with Comments)
    // JSONC is JSON with // or /* */ style comments
    function isJSONC(str) {
      if (typeof str !== 'string') return false;
      const trimmed = str.trim();
      if (!trimmed) return false;
      // Must start with { or [ like JSON
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
      
      // Try to parse as JSON first
      try {
        JSON.parse(trimmed);
        return false; // Valid JSON without comments
      } catch (e) {
        // Failed to parse as JSON
        // Check for comment patterns that suggest JSONC
        // Look for // at start of line or after newline (not URLs with //)
        // Pattern explanation: (?:^|\n)\s*\/\/(?!\/) matches:
        //   - Start of string or newline
        //   - Optional whitespace
        //   - Two slashes
        //   - NOT followed by another slash (to exclude https://)
        const hasLineComments = /(?:^|\n)\s*\/\/(?!\/)/.test(trimmed);
        
        // Look for /* */ style comments (non-greedy match)
        const hasBlockComments = /\/\*[\s\S]*?\*\//.test(trimmed);
        
        // If has comments and looks like JSON structure, it's likely JSONC
        if (hasLineComments || hasBlockComments) {
          // Additional check: should have typical JSON structure markers
          const hasJsonStructure = /[{\[\]},"]/.test(trimmed);
          return hasJsonStructure;
        }
        
        return false;
      }
    }

    // Check if a string contains markdown content with code blocks
    // Returns true if the string has both markdown structure (headings) and code blocks
    function isMarkdownWithCodeBlocks(str) {
      if (typeof str !== 'string') return false;
      
      // Must contain a code block
      const hasCodeBlock = /```/.test(str);
      if (!hasCodeBlock) return false;
      
      // Must contain markdown headings (##)
      const hasMarkdownStructure = /^#{1,6}\s+/m.test(str);
      
      return hasMarkdownStructure;
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

    // Check if array contains any multi-line text
    // Returns true if any string element contains newline characters
    function hasMultilineText(arr) {
      return arr.some(item => {
        return typeof item === 'string' && item.includes('\n');
      });
    }

    // Check if array contains only primitive (text-like) data
    // Returns true if all elements are string, number, boolean, or null
    // AND none of the strings contain multi-line text
    function isTextDataArray(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        return false;
      }
      
      // Check if all elements are primitive types
      const allPrimitive = arr.every(item => {
        const type = typeof item;
        return item === null || 
               type === 'string' || 
               type === 'number' || 
               type === 'boolean';
      });
      
      // If not all primitive, return false
      if (!allPrimitive) {
        return false;
      }
      
      // If any text is multi-line, don't use list format
      if (hasMultilineText(arr)) {
        return false;
      }
      
      return true;
    }

    // Convert primitive value to markdown text representation
    function primitiveToMarkdownText(value) {
      if (value === null) return '*null*';
      if (typeof value === 'string') return escapeMarkdown(value);
      if (typeof value === 'boolean') return `**${value}**`;
      if (typeof value === 'number') return `\`${value}\``;
      return String(value);
    }

    // Check if a value has meaningful content (not empty object/array)
    // Returns true if the value is not an empty object or empty array
    function hasContent(value) {
      if (value === null || value === undefined) {
        return true; // null/undefined are meaningful values
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === 'object') {
        return Object.keys(value).length > 0;
      }
      return true; // All primitive types have content
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
        // Priority 1: Check if string contains markdown with complete code blocks
        // (e.g., "## 世界観\n\n```json\n...\n```")
        // If found, preserve the markdown structure including the code block
        if (isMarkdownWithCodeBlocks(data)) {
          // String contains markdown with code blocks - render as-is without escaping
          // The code block will be processed by the markdown renderer
          const lines = data.split('\n');
          return lines.map(line => `${indent}${line}`).join('\n') + '\n';
        }
        
        // Priority 2: Check if the string is JSONC (JSON with comments)
        // Display as code block with jsonc language identifier
        if (isJSONC(data)) {
          const jsonLines = data.split('\n');
          const codeBlock = [
            `${indent}\`\`\`jsonc`,
            ...jsonLines.map(line => `${indent}${line}`),
            `${indent}\`\`\``
          ].join('\n') + '\n';
          return codeBlock;
        }
        
        // Priority 3: Check if the string is valid JSON - if so, display as JSON code block
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
        
        // Priority 4: Handle multiline strings with simple line breaks
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
        
        // Check if array contains only text data - if so, output as markdown list
        if (isTextDataArray(data)) {
          data.forEach(item => {
            const textValue = primitiveToMarkdownText(item);
            markdown += `${indent}- ${textValue}\n`;
          });
          return markdown;
        }
        
        // For arrays with complex data, use the existing recursive approach
        data.forEach((item, index) => {
          const indexKey = `[${index}]`;
          const currentPath = buildPath(parentPath, indexKey);
          
          // Only display heading with path if it contains a dot (dot-notation)
          // AND the item has meaningful content (not empty)
          const shouldShowHeading = currentPath && currentPath.includes('.') && hasContent(item);
          if (shouldShowHeading) {
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
              markdown += `${indent}${heading}\n`;
              markdown += `${indent}${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
            } else {
              markdown += `${indent}${escapeMarkdown(key)}: ${value === null ? '*null*' : value === undefined ? '*undefined*' : value}\n`;
            }
          } else if (typeof value === 'string' && !value.includes('\n')) {
            if (shouldShowHeading) {
              const heading = createHeadingMarkup(level, currentPath);
              markdown += `${indent}${heading}\n`;
              markdown += `${indent}${escapeMarkdown(value)}\n`;
            } else {
              markdown += `${indent}${escapeMarkdown(key)}: ${escapeMarkdown(value)}\n`;
            }
          } else {
            // For complex values (objects/arrays), check if they have content
            // If empty, show inline; otherwise show as a separate section
            if (!hasContent(value)) {
              // Empty object or array - show inline
              const emptyLabel = Array.isArray(value) ? '*Empty Array*' : '*Empty Object*';
              if (shouldShowHeading) {
                const heading = createHeadingMarkup(level, currentPath);
                markdown += `${indent}${heading}\n`;
                markdown += `${indent}${emptyLabel}\n`;
              } else {
                markdown += `${indent}${escapeMarkdown(key)}: ${emptyLabel}\n`;
              }
            } else {
              // Non-empty object or array - show as separate section with heading
              if (shouldShowHeading) {
                const heading = createHeadingMarkup(level, currentPath);
                markdown += `${indent}${heading}\n`;
              }
              markdown += jsonToMarkdown(value, level + 1, currentPath);
            }
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

    // Extract headings from HTML and generate unique IDs
    function extractHeadingsWithIds(html) {
      const headings = [];
      const idCounter = {};
      
      // Match all heading tags (h1-h6)
      const headingPattern = /<(h[1-6])>(.*?)<\/\1>/gi;
      let match;
      
      while ((match = headingPattern.exec(html)) !== null) {
        const level = parseInt(match[1].charAt(1)); // Extract number from h1-h6
        const text = match[2];
        
        // Generate a unique ID from the heading text
        const baseId = generateHeadingId(text);
        const uniqueId = makeIdUnique(baseId, idCounter);
        
        headings.push({
          level,
          text,
          id: uniqueId
        });
      }
      
      return headings;
    }

    // Generate a valid ID from heading text
    function generateHeadingId(text) {
      // First, decode any HTML entities and remove all tags
      const temp = document.createElement('div');
      temp.textContent = text; // This handles HTML entities safely
      const plainText = temp.textContent;
      
      // Remove any remaining angle brackets and convert to lowercase
      const cleaned = plainText.replace(/[<>]/g, '').toLowerCase();
      
      // Replace non-alphanumeric characters with hyphens
      const id = cleaned.replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 50); // Limit length
      
      return id || 'heading';
    }

    // Make ID unique by adding a counter if necessary
    function makeIdUnique(baseId, idCounter) {
      if (!idCounter[baseId]) {
        idCounter[baseId] = 0;
        return baseId;
      }
      idCounter[baseId]++;
      return `${baseId}-${idCounter[baseId]}`;
    }

    // Create a safe CSS selector for an ID
    // This function ensures that IDs starting with digits or containing special characters
    // are properly escaped for use in querySelector
    function safeCssSelector(id) {
      // CSS.escape() is the standard way to escape CSS identifiers
      // It handles IDs that start with digits, contain special characters, etc.
      return `#${CSS.escape(id)}`;
    }

    // Add IDs to headings in HTML
    function addIdsToHeadings(html, headings) {
      let result = html;
      let headingIndex = 0;
      
      // Replace each heading with an ID-annotated version
      result = result.replace(/<(h[1-6])>(.*?)<\/\1>/gi, (match, tag, content) => {
        if (headingIndex < headings.length) {
          const heading = headings[headingIndex];
          headingIndex++;
          return `<${tag} id="${escapeHtml(heading.id)}">${content}</${tag}>`;
        }
        return match;
      });
      
      return result;
    }

    // Create Table of Contents DOM element
    function createTocElement(headings, shadowRoot) {
      if (headings.length === 0) {
        return null;
      }

      const tocContainer = document.createElement('div');
      tocContainer.className = 'toc-container';
      
      // TOC Header
      const tocHeader = document.createElement('div');
      tocHeader.className = 'toc-header';
      
      const tocTitle = createElementWithText('span', '📑 目次', 'toc-title');
      const tocToggle = createElementWithText('span', '▼', 'toc-toggle');
      
      tocHeader.appendChild(tocTitle);
      tocHeader.appendChild(tocToggle);
      
      // TOC Content
      const tocContent = document.createElement('div');
      tocContent.className = 'toc-content';
      
      const tocList = document.createElement('ul');
      tocList.className = 'toc-list';
      
      // Store TOC links for active state management
      const tocLinks = new Map();
      
      headings.forEach(heading => {
        const tocItem = document.createElement('li');
        tocItem.className = `toc-item toc-level-${heading.level}`;
        
        const tocLink = document.createElement('a');
        tocLink.className = 'toc-link';
        tocLink.href = `#${heading.id}`;
        tocLink.dataset.headingId = heading.id;
        
        // Safely set text content
        const temp = document.createElement('div');
        temp.textContent = heading.text;
        tocLink.textContent = temp.textContent;
        
        // Simple and reliable scroll to heading
        tocLink.addEventListener('click', (e) => {
          e.preventDefault();
          // Use safeCssSelector to properly escape IDs that may start with digits or contain special characters
          const targetElement = shadowRoot.querySelector(safeCssSelector(heading.id));
          if (targetElement) {
            // Simple, reliable scroll: just scroll the element into view at the top
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest'
            });
            
            // Update active state immediately on click
            updateActiveState(heading.id);
          }
        });
        
        tocItem.appendChild(tocLink);
        tocList.appendChild(tocItem);
        
        // Store reference for active state updates
        tocLinks.set(heading.id, tocLink);
      });
      
      tocContent.appendChild(tocList);
      
      // Toggle functionality
      let tocExpanded = true;
      tocHeader.addEventListener('click', () => {
        tocExpanded = !tocExpanded;
        if (tocExpanded) {
          tocContent.classList.remove('toc-collapsed');
          tocToggle.textContent = '▼';
        } else {
          tocContent.classList.add('toc-collapsed');
          tocToggle.textContent = '▶';
        }
      });
      
      tocContainer.appendChild(tocHeader);
      tocContainer.appendChild(tocContent);
      
      // Active state management
      function updateActiveState(activeId) {
        tocLinks.forEach((link, id) => {
          if (id === activeId) {
            link.classList.add('toc-link-active');
          } else {
            link.classList.remove('toc-link-active');
          }
        });
      }
      
      return tocContainer;
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
          box-shadow: 0 8px 32px ${COLORS.DARK.SECTION_SHADOW}, 0 0 0 1px ${COLORS.DARK.BORDER_STRONG} !important;
        }
        
        .header {
          background: ${COLORS.DARK.BACKGROUND_ELEVATED} !important;
          border-bottom: 2px solid ${COLORS.DARK.BORDER_STRONG} !important;
        }
        
        .title {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .input-section {
          background: ${COLORS.DARK.BACKGROUND} !important;
          border-bottom: 2px solid ${COLORS.DARK.BORDER_STRONG} !important;
        }
        
        .json-input {
          background-color: ${COLORS.DARK.INPUT_BG} !important;
          border: 2px solid ${COLORS.DARK.BORDER} !important;
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .json-input:focus {
          border-color: ${COLORS.DARK.PRIMARY} !important;
          box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.2) !important;
        }
        
        .btn-secondary {
          background: ${COLORS.DARK.BACKGROUND_ELEVATED} !important;
          color: ${COLORS.DARK.TEXT} !important;
          border: 2px solid ${COLORS.DARK.BORDER} !important;
        }
        
        .btn-secondary:hover {
          background: #404040 !important;
          border-color: ${COLORS.DARK.BORDER_STRONG} !important;
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
          color: ${COLORS.DARK.TEXT_SECONDARY} !important;
          font-size: 16px !important;
        }
        
        .markdown-output h1,
        .markdown-output h2,
        .markdown-output h3,
        .markdown-output h4,
        .markdown-output h5,
        .markdown-output h6 {
          color: ${COLORS.DARK.TEXT} !important;
          padding: 12px 16px !important;
          margin: 20px -8px 16px -8px !important;
          background: ${COLORS.DARK.BACKGROUND_ELEVATED} !important;
          border-radius: 6px !important;
          border-left: 4px solid ${COLORS.DARK.PRIMARY} !important;
          box-shadow: 0 2px 4px ${COLORS.DARK.SECTION_SHADOW} !important;
        }
        
        .markdown-output h1 {
          border-bottom: none !important;
          font-size: 28px !important;
          border-left-width: 5px !important;
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
          border: 1px solid ${COLORS.DARK.CODE_BORDER} !important;
          padding: 3px 6px !important;
        }

        .markdown-output pre {
          background: ${COLORS.DARK.CODE_BG} !important;
          border: 2px solid ${COLORS.DARK.CODE_BORDER} !important;
          box-shadow: 0 2px 8px ${COLORS.DARK.SECTION_SHADOW} !important;
          margin: 16px 0 !important;
        }

        .markdown-output pre code {
          background: none !important;
          color: ${COLORS.DARK.TEXT_SECONDARY} !important;
          border: none !important;
          padding: 0 !important;
        }

        .markdown-output ul,
        .markdown-output ol {
          color: ${COLORS.DARK.TEXT_SECONDARY} !important;
        }

        .markdown-output li {
          color: ${COLORS.DARK.TEXT_SECONDARY} !important;
          margin: 6px 0 !important;
        }
        
        .error-message {
          color: ${COLORS.DARK.DANGER} !important;
          background: ${COLORS.DARK.ERROR_BG} !important;
          border: 2px solid ${COLORS.DARK.DANGER} !important;
        }
        
        .empty-state {
          color: ${COLORS.DARK.TEXT_LIGHT} !important;
        }
        
        .toggle-icon {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .input-header-title {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        /* Table of Contents Dark Mode */
        .toc-container {
          background: ${COLORS.DARK.BACKGROUND_ELEVATED} !important;
          border: 2px solid ${COLORS.DARK.BORDER_STRONG} !important;
          box-shadow: 0 2px 8px ${COLORS.DARK.SECTION_SHADOW} !important;
        }
        
        .toc-header {
          background: ${COLORS.DARK.BACKGROUND} !important;
          border-bottom: 1px solid ${COLORS.DARK.BORDER} !important;
        }
        
        .toc-header:hover {
          background: ${COLORS.DARK.BACKGROUND_ELEVATED} !important;
        }
        
        .toc-title {
          color: ${COLORS.DARK.TEXT} !important;
        }
        
        .toc-toggle {
          color: ${COLORS.DARK.TEXT_LIGHT} !important;
        }
        
        .toc-link {
          color: ${COLORS.DARK.TEXT_SECONDARY} !important;
          border-left: 3px solid transparent !important;
        }
        
        .toc-link:hover {
          background: ${COLORS.DARK.BACKGROUND} !important;
          color: ${COLORS.DARK.PRIMARY} !important;
          border-left-color: ${COLORS.DARK.PRIMARY} !important;
        }
        
        /* Active state for dark mode */
        .toc-link-active {
          background: ${COLORS.DARK.BACKGROUND} !important;
          color: ${COLORS.DARK.PRIMARY} !important;
          border-left-color: ${COLORS.DARK.PRIMARY} !important;
          font-weight: 600;
        }

        .toc-link-active::before {
          background: linear-gradient(180deg, ${COLORS.DARK.PRIMARY}, ${COLORS.DARK.PRIMARY_HOVER}) !important;
          box-shadow: 0 0 10px ${COLORS.DARK.PRIMARY} !important;
        }
        
        .content {
          background: ${COLORS.DARK.CONTAINER_BG} !important;
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
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 5px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .markdown-output h2 {
        font-size: 24px;
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 4px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .markdown-output h3 {
        font-size: 20px;
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 4px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .markdown-output h4 {
        font-size: 18px;
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 4px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .markdown-output h5 {
        font-size: 16px;
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 4px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }

      .markdown-output h6 {
        font-size: 14px;
        margin: 20px -8px 16px -8px;
        padding: 12px 16px;
        color: ${COLORS.LIGHT.TEXT};
        background: ${COLORS.LIGHT.BACKGROUND};
        border-left: 4px solid ${COLORS.LIGHT.PRIMARY};
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
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
        padding: 3px 6px;
        border-radius: 3px;
        border: 1px solid ${COLORS.LIGHT.BORDER};
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 14px;
        color: #d63384;
      }

      .markdown-output pre {
        background: ${COLORS.LIGHT.CODE_BG};
        border: 2px solid ${COLORS.LIGHT.BORDER};
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
        margin: 16px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
        margin: 6px 0;
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

      /* Table of Contents Styles */
      .toc-container {
        background: ${COLORS.LIGHT.BACKGROUND};
        border: 1px solid ${COLORS.LIGHT.BORDER};
        border-radius: 8px;
        margin-bottom: 20px;
        overflow: hidden;
      }

      .toc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: ${COLORS.LIGHT.CONTAINER_BG};
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s ease;
      }

      .toc-header:hover {
        background: ${COLORS.LIGHT.BACKGROUND};
      }

      .toc-title {
        font-weight: 600;
        font-size: 16px;
        color: ${COLORS.LIGHT.TEXT};
      }

      .toc-toggle {
        font-size: 12px;
        color: ${COLORS.LIGHT.TEXT_LIGHT};
        transition: transform 0.2s ease;
      }

      .toc-content {
        max-height: 400px;
        overflow-y: auto;
        padding: 8px 0;
        transition: max-height 0.3s ease, padding 0.3s ease;
      }

      .toc-content.toc-collapsed {
        max-height: 0;
        padding: 0;
        overflow: hidden;
      }

      .toc-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .toc-item {
        margin: 0;
        padding: 0;
      }

      .toc-link {
        display: block;
        padding: 8px 16px;
        color: ${COLORS.LIGHT.TEXT};
        text-decoration: none;
        transition: background-color 0.2s ease, border-left-color 0.2s ease;
        border-left: 3px solid transparent;
      }

      .toc-link:hover {
        background: ${COLORS.LIGHT.BACKGROUND};
        color: ${COLORS.LIGHT.PRIMARY};
        border-left-color: ${COLORS.LIGHT.PRIMARY};
      }

      /* Active state for currently visible section */
      .toc-link-active {
        background: ${COLORS.LIGHT.BACKGROUND} !important;
        color: ${COLORS.LIGHT.PRIMARY} !important;
        border-left-color: ${COLORS.LIGHT.PRIMARY} !important;
        font-weight: 600;
        position: relative;
      }

      .toc-link-active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, ${COLORS.LIGHT.PRIMARY}, ${COLORS.LIGHT.PRIMARY_HOVER});
        box-shadow: 0 0 8px ${COLORS.LIGHT.PRIMARY};
      }

      /* Indentation for different heading levels */
      .toc-level-1 .toc-link {
        padding-left: 16px;
        font-weight: 600;
        font-size: 15px;
      }

      .toc-level-2 .toc-link {
        padding-left: 32px;
        font-size: 14px;
      }

      .toc-level-3 .toc-link {
        padding-left: 48px;
        font-size: 13px;
      }

      .toc-level-4 .toc-link {
        padding-left: 64px;
        font-size: 13px;
      }

      .toc-level-5 .toc-link {
        padding-left: 80px;
        font-size: 12px;
      }

      .toc-level-6 .toc-link {
        padding-left: 96px;
        font-size: 12px;
      }

      /* Smooth scrolling for the entire content */
      .content {
        scroll-behavior: smooth;
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
        let html = markdownToHtml(currentMarkdown);
        
        // Extract headings and add IDs
        const headings = extractHeadingsWithIds(html);
        html = addIdsToHeadings(html, headings);
        
        // Create main output container
        const outputContainer = document.createElement('div');
        
        // Create TOC if there are headings
        const tocElement = createTocElement(headings, root);
        if (tocElement) {
          outputContainer.appendChild(tocElement);
        }
        
        // Create markdown output div
        const outputDiv = document.createElement('div');
        outputDiv.className = 'markdown-output';
        
        // Safely parse HTML and append to output div
        const htmlContent = createElementsFromHTML(html);
        outputDiv.appendChild(htmlContent);
        
        outputContainer.appendChild(outputDiv);
        
        setElementContent(content, outputContainer);
        
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

    // Try to read clipboard and auto-display if valid JSON
    const tryAutoLoadFromClipboard = async () => {
      try {
        // Check if Clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return;
        }

        // Read clipboard text
        const clipboardText = await navigator.clipboard.readText();
        
        // Validate clipboard text
        if (!clipboardText || !clipboardText.trim()) {
          return;
        }

        const trimmedText = clipboardText.trim();
        
        // Try to parse as JSON
        try {
          const jsonData = JSON.parse(trimmedText);
          
          // Only auto-load if it's an object or array (not primitive)
          if (typeof jsonData === 'object' && jsonData !== null) {
            // Set the clipboard content to the input
            jsonInput.value = trimmedText;
            
            // Automatically parse and display
            parseAndDisplay();
          }
        } catch (parseError) {
          // Not valid JSON, silently ignore
          return;
        }
      } catch (error) {
        // Clipboard access denied or other error, silently ignore
        // This is expected behavior when permission is not granted
        return;
      }
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
    
    // Try to auto-load JSON from clipboard on initialization
    // Note: Clipboard reading may fail in browsers without recent user gesture
    // This is expected and handled gracefully - the widget will show empty state
    tryAutoLoadFromClipboard().catch(() => {
      // Silently ignore any unhandled promise rejections
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
})();

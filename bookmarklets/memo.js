// ローカルメモ
// localStorageにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット
// 📝
// v8
// 2026-01-31

(function() {
  try {
    const ID = 'ls-memo-final';
    const old = document.getElementById(ID);
    if (old) {
      old._close ? old._close() : old.remove();
      return;
    }

    const host = document.createElement('div');
    host.id = ID;
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      'z-index:2147483647',
      'border:none',
      'outline:none',
      'background:transparent',
      'isolation:isolate'
    ].join(';');
    document.body.appendChild(host);

    const close = () => {
      document.removeEventListener('keydown', docKey);
      host.remove();
    };
    
    host._close = close;

    const docKey = (e) => {
      if (e.key === 'Escape') close();
    };
    
    document.addEventListener('keydown', docKey);

    const shadow = host.attachShadow({ mode: 'open' });
    
    // Storage keys
    const KEY = 'my_local_storage_notes';
    const VIEW_MODE_KEY = 'my_local_storage_notes_view_mode';
    const MAX = 300;

    // Emoji collection for title decoration
    const EMOJIS = [
      '📝', '✅', '⭐', '🎯', '💡', '🔥', '🚀', '💪', '🎉', '📌',
      '🌟', '✨', '💎', '🎨', '📚', '🔔', '🎁', '🏆', '⚡', '🌈',
      '🍀', '🎪', '🎭', '🎸', '🎮', '📱', '💻', '🖥️', '⌚', '📷',
      '🔑', '🔒', '🔓', '🔍', '🔎', '💰', '💳', '📊', '📈', '📉',
      '🌍', '🌎', '🌏', '🗺️', '🧭', '⏰', '⏱️', '⏲️', '🕐', '📅'
    ];

    const load = () => {
      try {
        const data = JSON.parse(localStorage.getItem(KEY) || '[]');
        // Ensure backward compatibility: add pinned and title properties if missing
        return data.map(item => ({
          title: item.title || '',
          text: item.text,
          date: item.date,
          pinned: item.pinned || false
        }));
      } catch {
        return [];
      }
    };

    // Load saved view mode from localStorage
    const loadViewMode = () => {
      try {
        return localStorage.getItem(VIEW_MODE_KEY) === 'list';
      } catch {
        return false;
      }
    };

    // Save view mode to localStorage
    const saveViewMode = (isListMode) => {
      try {
        localStorage.setItem(VIEW_MODE_KEY, isListMode ? 'list' : 'full');
      } catch {
        // Silently fail if localStorage is not available
      }
    };

    const save = (data) => {
      localStorage.setItem(KEY, JSON.stringify(data));
      renderList(data);
    };

    const createElement = (tag, css = '', text = '', clickHandler) => {
      const element = document.createElement(tag);
      if (css) element.style.cssText = css;
      if (text) element.textContent = text;
      if (clickHandler) element.onclick = clickHandler;
      return element;
    };

    // Insert emoji at cursor position in input field
    const insertEmojiAtCursor = (inputElement, emoji) => {
      const start = inputElement.selectionStart;
      const end = inputElement.selectionEnd;
      const text = inputElement.value;
      
      inputElement.value = text.substring(0, start) + emoji + text.substring(end);
      
      // Set cursor position after inserted emoji
      const newPos = start + emoji.length;
      inputElement.setSelectionRange(newPos, newPos);
      inputElement.focus();
    };

    // Get random emoji from collection
    const getRandomEmoji = () => {
      return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    };

    const wrap = createElement('div', [
      'position:fixed',
      'z-index:2147483647',
      'top:20px',
      'right:20px',
      'width:360px',
      'max-height:85vh',
      'background:#fff',
      'color:#333',
      'border:1px solid #999',
      'box-shadow:0 8px 30px rgba(0,0,0,0.3)',
      'border-radius:8px',
      'display:flex',
      'flex-direction:column',
      'font-family:sans-serif',
      'font-size:14px',
      'box-sizing:border-box',
      'line-height:1.5'
    ].join(';'));

    const header = createElement('div', [
      'background:#f1f3f4',
      'padding:12px',
      'border-bottom:1px solid #ddd',
      'display:flex',
      'flex-direction:column',
      'font-weight:bold',
      'border-radius:8px 8px 0 0',
      'box-sizing:border-box',
      'gap:8px'
    ].join(';'));
    
    // First row: Title and close button
    const titleRow = createElement('div', [
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'width:100%'
    ].join(';'));
    
    const title = createElement('span', 'flex-shrink:0;white-space:nowrap', 'Memo');
    titleRow.appendChild(title);
    
    titleRow.appendChild(createElement('span', [
      'cursor:pointer',
      'font-size:24px',
      'line-height:1',
      'padding:0 8px',
      'color:#5f6368',
      'flex-shrink:0'
    ].join(';'), '×', close));
    
    header.appendChild(titleRow);
    
    // Second row: Action buttons
    const buttonRow = createElement('div', [
      'display:flex',
      'gap:8px',
      'flex-wrap:wrap',
      'align-items:center'
    ].join(';'));
    
    // Initialize view mode from localStorage
    let isTitleOnlyMode = loadViewMode();
    
    const titleOnlyButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'background:#34a853',
      'color:#fff',
      'white-space:nowrap',
      'font-weight:normal',
      'flex-shrink:0'
    ].join(';'), isTitleOnlyMode ? '📝 全表示' : '📋 一覧', () => {
      isTitleOnlyMode = !isTitleOnlyMode;
      titleOnlyButton.textContent = isTitleOnlyMode ? '📝 全表示' : '📋 一覧';
      titleOnlyButton.style.background = isTitleOnlyMode ? '#1a73e8' : '#34a853';
      
      // Save view mode to localStorage
      saveViewMode(isTitleOnlyMode);
      
      // Hide/show input fields based on mode
      if (isTitleOnlyMode) {
        titleInput.style.display = 'none';
        emojiControls.style.display = 'none';
        emojiPicker.style.display = 'none';
        input.style.display = 'none';
        saveButton.style.display = 'none';
      } else {
        titleInput.style.display = 'block';
        emojiControls.style.display = 'flex';
        // Keep emojiPicker hidden unless user explicitly expanded it
        if (!isEmojiPickerExpanded) {
          emojiPicker.style.display = 'none';
        }
        input.style.display = 'block';
        saveButton.style.display = 'block';
      }
      
      renderList(load());
    });
    titleOnlyButton.title = 'タイトル一覧表示を切り替えます';
    buttonRow.appendChild(titleOnlyButton);
    
    const settingsButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'background:#5f6368',
      'color:#fff',
      'white-space:nowrap',
      'font-weight:normal',
      'flex-shrink:0'
    ].join(';'), '⚙️ 設定', () => {
      alert('ローカルメモ\nバージョン: v8\n\nlocalStorageにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット\n\nv8の新機能:\n- タイトルに絵文字を追加できる機能を実装\n- ランダム絵文字ボタンでワンクリック挿入\n- よく使う絵文字をクイックアクセスボタンで配置\n- 50種類以上の絵文字から選択可能な絵文字ピッカー\n\nv7の機能:\n- ヘッダーを2行レイアウトに変更し、件数が見切れない洗練されたUIに改善\n\nv6の機能:\n- 表示モード（全表示/一覧）をlocalStorageに保存し、次回起動時に復元');
    });
    settingsButton.title = 'バージョン情報を表示';
    buttonRow.appendChild(settingsButton);
    
    const deleteAllButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'background:#ea4335',
      'color:#fff',
      'white-space:nowrap',
      'font-weight:normal',
      'flex-shrink:0'
    ].join(';'), '🗑️ 一括削除', () => {
      const data = load();
      const unpinnedCount = data.filter(item => !item.pinned).length;
      
      if (unpinnedCount === 0) {
        alert('削除するメモがありません');
        return;
      }
      
      if (confirm(`ピン留め以外の${unpinnedCount}件を削除しますか？`)) {
        const newData = data.filter(item => item.pinned);
        save(newData);
      }
    });
    deleteAllButton.title = 'ピンを除いて一括削除を行います';
    buttonRow.appendChild(deleteAllButton);
    
    header.appendChild(buttonRow);
    wrap.appendChild(header);

    const body = createElement('div', [
      'padding:12px',
      'overflow-y:auto',
      'display:flex',
      'flex-direction:column',
      'flex:1',
      'box-sizing:border-box'
    ].join(';'));

    const titleInput = createElement('input', [
      'width:100%',
      'flex-shrink:0',
      'padding:10px',
      'margin-bottom:4px',
      'border:1px solid #ccc',
      'border-radius:4px',
      'font-size:15px',
      'font-weight:600',
      'background:#fff',
      'color:#333',
      'font-family:sans-serif',
      'box-sizing:border-box'
    ].join(';'));
    titleInput.type = 'text';
    titleInput.placeholder = 'タイトル（省略可）';
    titleInput.onkeydown = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      e.stopPropagation();
    };
    body.appendChild(titleInput);

    // Emoji controls container
    const emojiControls = createElement('div', [
      'display:flex',
      'gap:4px',
      'margin-bottom:8px',
      'flex-wrap:wrap',
      'align-items:center'
    ].join(';'));

    // Random emoji button
    const randomEmojiButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'background:#f59e0b',
      'color:#fff',
      'white-space:nowrap',
      'font-weight:500',
      'transition:background 0.2s'
    ].join(';'), '🎲 ランダム', () => {
      insertEmojiAtCursor(titleInput, getRandomEmoji());
    });
    randomEmojiButton.title = 'ランダムに絵文字を挿入';
    randomEmojiButton.onmouseover = () => {
      randomEmojiButton.style.background = '#d97706';
    };
    randomEmojiButton.onmouseout = () => {
      randomEmojiButton.style.background = '#f59e0b';
    };
    emojiControls.appendChild(randomEmojiButton);

    // Quick emoji buttons (frequently used)
    const quickEmojis = ['📝', '✅', '⭐', '🎯', '💡', '🔥', '🚀', '💪'];
    quickEmojis.forEach(emoji => {
      const emojiBtn = createElement('button', [
        'padding:4px 8px',
        'font-size:14px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'cursor:pointer',
        'background:#fff',
        'transition:all 0.2s',
        'line-height:1'
      ].join(';'), emoji, () => {
        insertEmojiAtCursor(titleInput, emoji);
      });
      emojiBtn.title = `${emoji}を挿入`;
      emojiBtn.onmouseover = () => {
        emojiBtn.style.background = '#f0f0f0';
        emojiBtn.style.transform = 'scale(1.1)';
      };
      emojiBtn.onmouseout = () => {
        emojiBtn.style.background = '#fff';
        emojiBtn.style.transform = 'scale(1)';
      };
      emojiControls.appendChild(emojiBtn);
    });

    // More emojis button (expander)
    let isEmojiPickerExpanded = false;
    const moreEmojisButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:1px solid #ddd',
      'border-radius:4px',
      'cursor:pointer',
      'background:#fff',
      'color:#666',
      'white-space:nowrap',
      'font-weight:500',
      'transition:background 0.2s'
    ].join(';'), '➕ もっと', () => {
      isEmojiPickerExpanded = !isEmojiPickerExpanded;
      if (isEmojiPickerExpanded) {
        emojiPicker.style.display = 'grid';
        moreEmojisButton.textContent = '➖ 閉じる';
      } else {
        emojiPicker.style.display = 'none';
        moreEmojisButton.textContent = '➕ もっと';
      }
    });
    moreEmojisButton.title = '絵文字一覧を表示';
    moreEmojisButton.onmouseover = () => {
      moreEmojisButton.style.background = '#f0f0f0';
    };
    moreEmojisButton.onmouseout = () => {
      moreEmojisButton.style.background = '#fff';
    };
    emojiControls.appendChild(moreEmojisButton);

    body.appendChild(emojiControls);

    // Emoji picker (hidden by default)
    const emojiPicker = createElement('div', [
      'display:none',
      'grid-template-columns:repeat(10, 1fr)',
      'gap:4px',
      'padding:8px',
      'margin-bottom:8px',
      'background:#f9fafb',
      'border:1px solid #ddd',
      'border-radius:4px',
      'max-height:120px',
      'overflow-y:auto',
      'box-sizing:border-box'
    ].join(';'));

    EMOJIS.forEach(emoji => {
      const emojiBtn = createElement('button', [
        'padding:6px',
        'font-size:18px',
        'border:1px solid transparent',
        'border-radius:4px',
        'cursor:pointer',
        'background:transparent',
        'transition:all 0.2s',
        'line-height:1'
      ].join(';'), emoji, () => {
        insertEmojiAtCursor(titleInput, emoji);
      });
      emojiBtn.title = `${emoji}を挿入`;
      emojiBtn.onmouseover = () => {
        emojiBtn.style.background = '#e5e7eb';
        emojiBtn.style.borderColor = '#9ca3af';
        emojiBtn.style.transform = 'scale(1.2)';
      };
      emojiBtn.onmouseout = () => {
        emojiBtn.style.background = 'transparent';
        emojiBtn.style.borderColor = 'transparent';
        emojiBtn.style.transform = 'scale(1)';
      };
      emojiPicker.appendChild(emojiBtn);
    });

    body.appendChild(emojiPicker);

    const input = createElement('textarea', [
      'width:100%',
      'height:80px',
      'min-height:80px',
      'flex-shrink:0',
      'padding:10px',
      'margin-bottom:10px',
      'border:1px solid #ccc',
      'border-radius:4px',
      'resize:vertical',
      'font-size:14px',
      'background:#fff',
      'color:#333',
      'font-family:sans-serif',
      'box-sizing:border-box'
    ].join(';'));
    input.placeholder = 'テキストを入力...';
    input.onkeydown = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      e.stopPropagation();
    };
    body.appendChild(input);

    const saveButton = createElement('button', [
      'flex-shrink:0',
      'width:100%',
      'padding:8px',
      'background:#1a73e8',
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'font-weight:bold',
      'font-size:13px',
      'box-sizing:border-box'
    ].join(';'), '保存', () => {
      const title = titleInput.value.trim();
      const value = input.value.trim();
      if (!value) return;

      const data = load();
      if (data.length >= MAX) {
        alert(`最大${MAX}件です`);
        return;
      }

      data.unshift({ title: title, text: value, date: new Date().toISOString(), pinned: false });
      save(data);
      titleInput.value = '';
      input.value = '';
    });
    body.appendChild(saveButton);

    const listContainer = createElement('ul', [
      'list-style:none',
      'margin-top:15px',
      'padding:0',
      'box-sizing:border-box'
    ].join(';'));
    body.appendChild(listContainer);
    wrap.appendChild(body);

    shadow.appendChild(wrap);

    // Helper function to create action buttons
    const createActionButtons = (item, originalIndex, data, isCompactMode = false) => {
      const actions = createElement('div', [
        'display:flex',
        'gap:4px',
        'justify-content:flex-start',
        'flex-wrap:wrap',
        isCompactMode ? 'flex-shrink:0' : ''
      ].join(';'));

      const buttonStyle = isCompactMode ? [
        'padding:4px 8px',
        'font-size:11px',
        'border:none',
        'border-radius:3px',
        'cursor:pointer',
        'min-width:auto',
        'white-space:nowrap',
        'transition:all 0.2s',
        'font-weight:500'
      ] : [
        'padding:6px 12px',
        'font-size:12px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'min-width:50px',
        'white-space:nowrap',
        'transition:all 0.2s',
        'font-weight:500'
      ];

      const pinButton = createElement('button', [
        ...buttonStyle,
        'background:' + (item.pinned ? '#fbbf24' : '#e5e7eb'),
        'color:' + (item.pinned ? '#fff' : '#374151')
      ].join(';'), item.pinned ? (isCompactMode ? '📌' : '📌 Pin') : (isCompactMode ? 'Pin' : 'Pin'), () => {
        const currentData = load();
        if (currentData[originalIndex]) {
          currentData[originalIndex].pinned = !currentData[originalIndex].pinned;
          save(currentData);
        }
      });
      pinButton.title = item.pinned ? 'ピン留めを解除' : 'ピン留めする';

      const editButton = createElement('button', [
        ...buttonStyle,
        'background:#1a73e8',
        'color:#fff'
      ].join(';'), isCompactMode ? '✏️' : 'Edit', () => {
        // Switch to full mode if in compact mode
        if (isCompactMode) {
          isTitleOnlyMode = false;
          titleOnlyButton.textContent = '📋 一覧';
          titleOnlyButton.style.background = '#34a853';
          titleInput.style.display = 'block';
          emojiControls.style.display = 'flex';
          emojiPicker.style.display = 'none';
          isEmojiPickerExpanded = false;
          moreEmojisButton.textContent = '➕ もっと';
          input.style.display = 'block';
          saveButton.style.display = 'block';
          renderList(data);
          
          // Wait for render, then find and trigger edit by index
          setTimeout(() => {
            const allItems = listContainer.querySelectorAll('li');
            // Find the item at the same original index
            const sortedData = [...data].sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return data.indexOf(a) - data.indexOf(b);
            });
            const targetIndex = sortedData.indexOf(item);
            if (targetIndex >= 0 && targetIndex < allItems.length) {
              const targetItem = allItems[targetIndex];
              const editBtn = Array.from(targetItem.querySelectorAll('button')).find(btn => 
                btn.textContent === 'Edit' || btn.textContent === '✏️'
              );
              if (editBtn) editBtn.click();
            }
          }, 100);
          return;
        }
        
        // Full mode edit (existing logic)
        const listItem = actions.parentElement;
        const textWrapper = listItem.querySelector('div');
        
        const editTitleInput = createElement('input', [
          'width:100%',
          'padding:10px',
          'margin-bottom:8px',
          'border:1px solid #1a73e8',
          'border-radius:4px',
          'font-size:15px',
          'font-weight:600',
          'background:#fff',
          'color:#333',
          'font-family:sans-serif',
          'box-sizing:border-box'
        ].join(';'));
        editTitleInput.type = 'text';
        editTitleInput.placeholder = 'タイトル（省略可）';
        editTitleInput.value = item.title || '';
        
        const editArea = createElement('textarea', [
          'width:100%',
          'min-height:80px',
          'padding:10px',
          'margin-bottom:8px',
          'border:1px solid #1a73e8',
          'border-radius:4px',
          'resize:vertical',
          'font-size:13px',
          'background:#fff',
          'color:#333',
          'font-family:sans-serif',
          'box-sizing:border-box'
        ].join(';'));
        editArea.value = item.text;
        
        const editActions = createElement('div', [
          'display:flex',
          'gap:6px',
          'margin-bottom:8px'
        ].join(';'));
        
        const saveEditButton = createElement('button', [
          'padding:6px 12px',
          'font-size:12px',
          'border:none',
          'border-radius:4px',
          'cursor:pointer',
          'background:#34a853',
          'color:#fff',
          'white-space:nowrap',
          'font-weight:500'
        ].join(';'), '✓ 保存', () => {
          const newTitle = editTitleInput.value.trim();
          const newText = editArea.value.trim();
          if (!newText) return;
          const currentData = load();
          if (currentData[originalIndex]) {
            currentData[originalIndex].title = newTitle;
            currentData[originalIndex].text = newText;
            currentData[originalIndex].date = new Date().toISOString();
            save(currentData);
          }
        });
        
        const cancelEditButton = createElement('button', [
          'padding:6px 12px',
          'font-size:12px',
          'border:none',
          'border-radius:4px',
          'cursor:pointer',
          'background:#ea4335',
          'color:#fff',
          'white-space:nowrap',
          'font-weight:500'
        ].join(';'), '✗ キャンセル', () => {
          renderList(load());
        });
        
        editActions.appendChild(saveEditButton);
        editActions.appendChild(cancelEditButton);
        
        // Replace content with edit mode
        const editContainer = createElement('div');
        editContainer.appendChild(editTitleInput);
        editContainer.appendChild(editArea);
        textWrapper.replaceChildren(editContainer);
        actions.replaceChildren(editActions);
      });
      editButton.title = '編集する';

      const copyButton = createElement('button', [
        ...buttonStyle,
        'background:#34a853',
        'color:#fff'
      ].join(';'), isCompactMode ? '📋' : 'Copy', () => {
        const copyText = item.title ? `${item.title}\n\n${item.text}` : item.text;
        navigator.clipboard.writeText(copyText).then(() => {
          if (isCompactMode) {
            copyButton.textContent = '✓';
            setTimeout(() => {
              copyButton.textContent = '📋';
            }, 1000);
          } else {
            close();
          }
        });
      });
      copyButton.title = 'コピーする';

      const deleteButton = createElement('button', [
        ...buttonStyle,
        'background:#ea4335',
        'color:#fff'
      ].join(';'), isCompactMode ? '🗑️' : 'Del', () => {
        if (confirm('このメモを削除しますか？')) {
          const currentData = load();
          if (originalIndex < currentData.length) {
            currentData.splice(originalIndex, 1);
            save(currentData);
          }
        }
      });
      deleteButton.title = '削除する';

      actions.appendChild(pinButton);
      actions.appendChild(editButton);
      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);
      
      return actions;
    };

    const renderList = (data) => {
      title.textContent = `Memo (${data.length}/${MAX})`;
      listContainer.replaceChildren();

      // Sort: pinned items first, then by original order
      const sortedData = [...data].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return data.indexOf(a) - data.indexOf(b);
      });

      if (isTitleOnlyMode) {
        // Title-only mode: show titles with compact action buttons
        sortedData.forEach((item) => {
          const originalIndex = data.indexOf(item);
          
          const listItem = createElement('li', [
            'background:#fff',
            'border:1px solid #eee',
            'margin-bottom:6px',
            'padding:8px 10px',
            'border-radius:6px',
            'display:flex',
            'justify-content:space-between',
            'align-items:center',
            'gap:8px',
            'box-sizing:border-box',
            'transition:background 0.2s',
            item.pinned ? 'background:#fffbf0;border-color:#ffd700' : ''
          ].join(';'));
          
          // Content area (clickable to expand)
          const contentArea = createElement('div', [
            'flex:1',
            'display:flex',
            'align-items:center',
            'gap:8px',
            'cursor:pointer',
            'min-width:0',
            'overflow:hidden'
          ].join(';'));
          
          contentArea.onmouseover = () => {
            listItem.style.background = item.pinned ? '#fff9e6' : '#f5f5f5';
          };
          contentArea.onmouseout = () => {
            listItem.style.background = item.pinned ? '#fffbf0' : '#fff';
          };
          
          const titleText = createElement('div', [
            'flex:1',
            'overflow:hidden',
            'text-overflow:ellipsis',
            'white-space:nowrap',
            'min-width:0'
          ].join(';'));
          
          if (item.title) {
            const titleSpan = createElement('span', [
              'font-weight:600',
              'color:#1a73e8'
            ].join(';'), item.title);
            titleText.appendChild(titleSpan);
          } else {
            const previewText = item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '');
            const previewSpan = createElement('span', [
              'color:#666',
              'font-style:italic'
            ].join(';'), previewText);
            titleText.appendChild(previewSpan);
          }
          
          const dateText = createElement('span', [
            'font-size:11px',
            'color:#999',
            'white-space:nowrap',
            'flex-shrink:0'
          ].join(';'), new Date(item.date).toLocaleDateString('ja-JP'));
          
          contentArea.appendChild(titleText);
          contentArea.appendChild(dateText);
          
          contentArea.onclick = () => {
            isTitleOnlyMode = false;
            titleOnlyButton.textContent = '📋 一覧';
            titleOnlyButton.style.background = '#34a853';
            
            // Show input fields
            titleInput.style.display = 'block';
            emojiControls.style.display = 'flex';
            // Keep emojiPicker closed when switching modes
            emojiPicker.style.display = 'none';
            isEmojiPickerExpanded = false;
            moreEmojisButton.textContent = '➕ もっと';
            input.style.display = 'block';
            saveButton.style.display = 'block';
            
            renderList(data);
          };
          
          listItem.appendChild(contentArea);
          
          // Add compact action buttons
          const actionsContainer = createActionButtons(item, originalIndex, data, true);
          listItem.appendChild(actionsContainer);
          
          listContainer.appendChild(listItem);
        });
        
        return;
      }

      sortedData.forEach((item) => {
        const originalIndex = data.indexOf(item);
        
        const listItem = createElement('li', [
          'background:#fff',
          'border:1px solid #eee',
          'margin-bottom:8px',
          'padding:12px',
          'border-radius:6px',
          'display:flex',
          'flex-direction:column',
          'gap:10px',
          'box-sizing:border-box',
          item.pinned ? 'background:#fffbf0;border-color:#ffd700' : ''
        ].join(';'));

        const textWrapper = createElement('div', [
          'position:relative'
        ].join(';'));

        // Display title if it exists
        if (item.title) {
          const titleElement = createElement('div', [
            'font-size:16px',
            'font-weight:700',
            'color:#1a73e8',
            'margin-bottom:8px',
            'line-height:1.4',
            'letter-spacing:0.3px',
            'word-break:break-word'
          ].join(';'), item.title);
          textWrapper.appendChild(titleElement);
        }

        const textElement = createElement('div', [
          'word-break:break-all',
          'font-size:13px',
          'color:#333',
          'line-height:1.6',
          'display:-webkit-box',
          '-webkit-line-clamp:5',
          '-webkit-box-orient:vertical',
          'overflow:hidden'
        ].join(';'), item.text);
        
        textWrapper.appendChild(textElement);

        // Check if the text element is truncated by comparing scroll and client heights
        const checkTruncation = () => {
          return textElement.scrollHeight > textElement.clientHeight;
        };

        // Add "Show more" button if text is truncated (setTimeout ensures proper height calculation after render)
        setTimeout(() => {
          if (checkTruncation()) {
            const toggleButton = createElement('button', [
              'margin-top:6px',
              'padding:4px 10px',
              'font-size:11px',
              'border:none',
              'border-radius:4px',
              'cursor:pointer',
              'background:#f0f0f0',
              'color:#666',
              'transition:all 0.2s',
              'font-weight:500'
            ].join(';'), '▼ もっと見る');
            
            let isExpanded = false;
            toggleButton.onclick = () => {
              isExpanded = !isExpanded;
              if (isExpanded) {
                textElement.style.cssText = [
                  'word-break:break-all',
                  'font-size:13px',
                  'color:#333',
                  'line-height:1.6',
                  'white-space:pre-wrap'
                ].join(';');
                toggleButton.textContent = '▲ 閉じる';
              } else {
                textElement.style.cssText = [
                  'word-break:break-all',
                  'font-size:13px',
                  'color:#333',
                  'line-height:1.6',
                  'display:-webkit-box',
                  '-webkit-line-clamp:5',
                  '-webkit-box-orient:vertical',
                  'overflow:hidden'
                ].join(';');
                toggleButton.textContent = '▼ もっと見る';
              }
            };
            
            textWrapper.appendChild(toggleButton);
          }
        }, 0);

        listItem.appendChild(textWrapper);

        const actions = createActionButtons(item, originalIndex, data, false);
        listItem.appendChild(actions);
        listContainer.appendChild(listItem);
      });
    };

    renderList(load());
    
    // Apply saved view mode on initial load
    if (isTitleOnlyMode) {
      titleInput.style.display = 'none';
      emojiControls.style.display = 'none';
      emojiPicker.style.display = 'none';
      input.style.display = 'none';
      saveButton.style.display = 'none';
    }
  } catch (error) {
    console.error(error);
    alert('Error: ' + error);
  }
})();

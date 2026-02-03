// ローカルメモ
// localStorageにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット
// 📝
// v19
// 2026-02-03
// v19: Fixed z-index issue - all elements now use centralized Z_INDEX constants to ensure they always appear above page dialogs
// v18: Refactored edit mode UI - simplified layout with emoji, title, body, and save/cancel buttons in a single container
// v17: Fixed edit mode layout - buttons no longer overlap edit area

(function() {
  try {
    const ID = 'ls-memo-final';
    const old = document.getElementById(ID);
    if (old) {
      old._close ? old._close() : old.remove();
      return;
    }

    // Centralized z-index management for maintaining proper layering
    // Ensures bookmarklet elements always appear above page dialogs (even those with z-index: 1000)
    const Z_INDEX = {
      // Maximum safe z-index value (2^31 - 1)
      MAX: 2147483647,
      // Base level for all bookmarklet elements
      BASE: 2147483647,
      // Modal overlay must be higher than base to cover everything
      MODAL_OVERLAY: 2147483647,
      // Dropdowns inherit base level - no need for separate lower value
      DROPDOWN: 2147483647
    };

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
      'background:transparent',
      'isolation:isolate'
    ].join(';');
    document.body.appendChild(host);

    // Centralized keyboard handler for maintainability
    const KeyHandler = {
      ESC: 'Escape',
      
      // Track edit mode state to prevent ESC from closing popup during edit
      isEditMode: false,
      
      // Track if settings/modal dialog is open
      isModalOpen: false,
      
      // Check if Ctrl+Enter was pressed
      isCtrlEnter: (e) => {
        return (e.ctrlKey || e.metaKey) && e.key === 'Enter';
      },
      
      // Main document-level key handler (defined after close() is declared)
      handleDocumentKey: null
    };

    const close = () => {
      document.removeEventListener('keydown', KeyHandler.handleDocumentKey);
      host.remove();
    };
    
    host._close = close;

    // Set up document key handler now that close() is defined
    KeyHandler.handleDocumentKey = (e) => {
      if (e.key === KeyHandler.ESC) {
        // Don't close popup if in edit mode or if modal dialog is open
        // Let edit field handlers and modal handlers handle it
        if (!KeyHandler.isEditMode && !KeyHandler.isModalOpen) {
          close();
        }
      }
    };
    
    document.addEventListener('keydown', KeyHandler.handleDocumentKey);

    const shadow = host.attachShadow({ mode: 'open' });
    
    // Storage keys
    const KEY = 'my_local_storage_notes';
    const VIEW_MODE_KEY = 'my_local_storage_notes_view_mode';
    const MAX = 300;

    // Comprehensive emoji collection for title decoration
    // Organized by category for better UX
    const EMOJIS = [
      // Productivity & Tasks (20)
      '📝', '✅', '⭐', '🎯', '💡', '🔥', '🚀', '💪', '🎉', '📌',
      '✏️', '📋', '✔️', '⚠️', '❗', '❓', '💯', '🏁', '🎬', '🔔',
      
      // Objects & Tools (30)
      '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📄',
      '📃', '📑', '🗂️', '📂', '📁', '🗃️', '🗄️', '📇', '🗓️', '📅',
      '📆', '📊', '📈', '📉', '🗒️', '📰', '🗞️', '🏷️', '🔖', '📜',
      
      // Technology (30)
      '💻', '🖥️', '⌨️', '🖱️', '🖨️', '💾', '💿', '📀', '🎮', '🕹️',
      '📱', '📲', '☎️', '📞', '📟', '📠', '📡', '🔋', '🔌', '🔬',
      '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💰', '💎', '💶', '💷',
      
      // Nature & Weather (30)
      '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑',
      '🌒', '🌓', '🌔', '🌙', '🌈', '☀️', '✨', '⚡', '☄️', '🌤️',
      '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻',
      
      // Time & Calendar (15)
      '⏰', '⏱️', '⏲️', '⏳', '⌛', '🕐', '🕑', '🕒', '🕓', '🕔',
      '🕕', '🕖', '🕗', '🕘', '🕙',
      
      // Symbols & Shapes (30)
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔴', '🟠',
      '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸',
      
      // Food & Drink (20)
      '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
      '🍸', '🍹', '🍾', '🍴', '🍽️', '🥄', '🔪', '🍕', '🍔', '🍟',
      
      // Activities & Sports (15)
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🏓', '🏸', '🏒', '🏑', '🥍',
      
      // Transport & Places (15)
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🚚', '🚛', '🚜', '✈️', '🛸',
      
      // Decorative & Fun (20)
      '🎨', '🎭', '🎪', '🎥', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷',
      '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎳', '🃏', '🎰', '🧩',
      
      // Misc (35)
      '🔑', '🔒', '🔓', '🔐', '🔏', '🔗', '⛓️', '💼', '🎒', '👜',
      '💳', '🎁', '🎀', '🎊', '🎗️', '🎈', '🏆', '🥇', '🥈', '🥉',
      '🌺', '🌸', '🌼', '🌻', '🌷', '🌹', '🥀', '💐', '🍂', '🍁',
      '🔮', '🌟', '🌠', '🎇', '🎆'
    ];

    const load = () => {
      try {
        const data = JSON.parse(localStorage.getItem(KEY) || '[]');
        // Ensure backward compatibility: add pinned, title, emoji, createdDate and updatedDate properties if missing
        return data.map(item => ({
          title: item.title || '',
          text: item.text,
          // Migrate old 'date' field to createdDate and updatedDate
          createdDate: item.createdDate || item.date || new Date().toISOString(),
          updatedDate: item.updatedDate || item.date || new Date().toISOString(),
          pinned: item.pinned || false,
          emoji: item.emoji || ''
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

    // Get random emoji from collection
    const getRandomEmoji = () => {
      return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    };

    // Track current emoji (initialize as empty to show "no emoji" state)
    let currentEmoji = '';

    // Create a button with hover effect
    const createButtonWithHover = (style, text, clickHandler, hoverBg, normalBg) => {
      const button = createElement('button', style, text, clickHandler);
      if (hoverBg && normalBg) {
        button.onmouseover = () => {
          button.style.background = hoverBg;
        };
        button.onmouseout = () => {
          button.style.background = normalBg;
        };
      }
      return button;
    };

    /**
     * Apply hover transform effect to an element with proper centering
     * @param {HTMLElement} element - The element to apply hover effect to
     * @param {number} scale - The scale factor on hover (e.g., 1.15)
     * @param {string} hoverBgColor - Optional background color on hover
     * @param {string} hoverBorderColor - Optional border color on hover
     */
    const applyHoverEffect = (element, scale = 1.15, hoverBgColor = null, hoverBorderColor = null) => {
      // Set transform-origin to ensure centered scaling
      element.style.transformOrigin = 'center center';
      
      // Store original values before applying hover effects
      const originalBg = element.style.background || '';
      const originalBorder = element.style.borderColor || '';
      
      element.onmouseover = () => {
        element.style.transform = `scale(${scale})`;
        if (hoverBgColor) element.style.background = hoverBgColor;
        if (hoverBorderColor) element.style.borderColor = hoverBorderColor;
      };
      
      element.onmouseout = () => {
        element.style.transform = 'scale(1)';
        if (hoverBgColor) element.style.background = originalBg;
        if (hoverBorderColor) element.style.borderColor = originalBorder;
      };
    };

    /**
     * Create a reusable emoji picker UI component
     * @param {string} initialEmoji - The initial emoji to display (empty string for none)
     * @param {Function} onEmojiChange - Optional callback function called when emoji changes
     * @returns {Object} - Object containing:
     *   - container: DOM element with the picker UI
     *   - titleInput: Input element for title text
     *   - getEmoji: Function to get currently selected emoji
     *   - setEmoji: Function to set emoji programmatically
     */
    const createEmojiPicker = (initialEmoji, onEmojiChange) => {
      let selectedEmoji = initialEmoji || '';
      
      // Container for emoji row and dropdown
      const container = createElement('div', [
        'position:relative',
        'margin-bottom:8px'
      ].join(';'));
      
      // Emoji button row with title input
      const emojiTitleRow = createElement('div', [
        'display:flex',
        'gap:6px',
        'align-items:center'
      ].join(';'));
      
      // Emoji button
      const emojiButton = createElement('button', [
        'width:42px',
        'height:42px',
        'border:1px solid #1a73e8',
        'border-radius:4px',
        'cursor:pointer',
        'background:#fff',
        'font-size:24px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'transition:all 0.2s',
        'flex-shrink:0',
        'padding:0'
      ].join(';'), selectedEmoji || '➕', () => {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
      
      // Apply centered hover effect
      applyHoverEffect(emojiButton, 1.05, '#f5f5f5');
      
      // Title input
      const titleInput = createElement('input', [
        'flex:1',
        'padding:10px',
        'border:1px solid #1a73e8',
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
      
      emojiTitleRow.appendChild(emojiButton);
      emojiTitleRow.appendChild(titleInput);
      
      // Emoji dropdown
      const dropdown = createElement('div', [
        'display:none',
        'position:absolute',
        'top:48px',
        'left:0',
        'right:0',
        'background:#fff',
        'border:1px solid #ccc',
        'border-radius:6px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'padding:8px',
        `z-index:${Z_INDEX.DROPDOWN}`,
        'box-sizing:border-box'
      ].join(';'));
      
      // Random button
      const randomButton = createButtonWithHover([
        'width:100%',
        'padding:8px',
        'margin-bottom:8px',
        'font-size:13px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'cursor:pointer',
        'background:#f59e0b',
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), '🎲 ランダム選択', () => {
        selectedEmoji = getRandomEmoji();
        emojiButton.textContent = selectedEmoji;
        dropdown.style.display = 'none';
        if (onEmojiChange) onEmojiChange(selectedEmoji);
      }, '#d97706', '#f59e0b');
      dropdown.appendChild(randomButton);
      
      // Clear button
      const clearButton = createButtonWithHover([
        'width:100%',
        'padding:8px',
        'margin-bottom:8px',
        'font-size:13px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'cursor:pointer',
        'background:#ef4444',
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), '🗑️ 削除', () => {
        selectedEmoji = '';
        emojiButton.textContent = '➕';
        dropdown.style.display = 'none';
        if (onEmojiChange) onEmojiChange(selectedEmoji);
      }, '#dc2626', '#ef4444');
      dropdown.appendChild(clearButton);
      
      // Emoji grid
      const emojiGrid = createElement('div', [
        'display:grid',
        'grid-template-columns:repeat(7, 1fr)',
        'gap:4px',
        'max-height:200px',
        'overflow-y:auto',
        'overflow-x:hidden',
        'padding:4px'
      ].join(';'));
      
      EMOJIS.forEach(emoji => {
        const emojiBtn = createElement('button', [
          'padding:8px',
          'font-size:20px',
          'border:1px solid transparent',
          'border-radius:4px',
          'cursor:pointer',
          'background:transparent',
          'transition:all 0.2s',
          'line-height:1',
          'min-width:0',
          'box-sizing:border-box'
        ].join(';'), emoji, () => {
          selectedEmoji = emoji;
          emojiButton.textContent = emoji;
          dropdown.style.display = 'none';
          if (onEmojiChange) onEmojiChange(selectedEmoji);
        });
        
        // Apply centered hover effect with background and border
        applyHoverEffect(emojiBtn, 1.15, '#f0f0f0', '#ccc');
        
        emojiGrid.appendChild(emojiBtn);
      });
      
      dropdown.appendChild(emojiGrid);
      container.appendChild(emojiTitleRow);
      container.appendChild(dropdown);
      
      return {
        container,
        titleInput,
        getEmoji: () => selectedEmoji,
        setEmoji: (emoji) => {
          selectedEmoji = emoji;
          emojiButton.textContent = emoji || '➕';
        }
      };
    };

    /**
     * Create edit UI components for inline memo editing with improved layout
     * @param {Object} item - The memo item to edit with properties: title, text, emoji
     * @param {Function} onSave - Callback function called when save is clicked, receives updated data object
     * @param {Function} onCancel - Callback function called when cancel is clicked or ESC is pressed
     * @returns {Object} - Object containing:
     *   - container: DOM element with complete edit UI (emoji picker, textarea, and buttons)
     *   - titleInput: Input element for title
     *   - textArea: Textarea element for memo content
     */
    const createEditUI = (item, onSave, onCancel) => {
      // Create emoji picker
      const emojiPicker = createEmojiPicker(item.emoji);
      
      // Text area
      const textArea = createElement('textarea', [
        'width:100%',
        'min-height:100px',
        'padding:10px',
        'border:1px solid #1a73e8',
        'border-radius:4px',
        'resize:vertical',
        'font-size:13px',
        'background:#fff',
        'color:#333',
        'font-family:sans-serif',
        'box-sizing:border-box',
        'margin-bottom:12px'
      ].join(';'));
      textArea.value = item.text;
      textArea.placeholder = 'メモ内容を入力...';
      
      // Set initial title
      emojiPicker.titleInput.value = item.title || '';
      
      // Create button container with proper styling
      const buttonContainer = createElement('div', [
        'display:flex',
        'gap:8px',
        'justify-content:flex-start',
        'flex-wrap:wrap'
      ].join(';'));
      
      // Save button
      const saveButton = createElement('button', [
        'padding:8px 16px',
        'font-size:13px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'background:#34a853',
        'color:#fff',
        'white-space:nowrap',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), '✓ 保存 (Ctrl+Enter)', () => {
        const newTitle = emojiPicker.titleInput.value.trim();
        const newText = textArea.value.trim();
        if (!newText) return;
        onSave({
          title: newTitle,
          text: newText,
          emoji: emojiPicker.getEmoji()
        });
      });
      
      // Add hover effect to save button
      saveButton.onmouseover = () => saveButton.style.background = '#2d8f47';
      saveButton.onmouseout = () => saveButton.style.background = '#34a853';
      
      // Cancel button
      const cancelButton = createElement('button', [
        'padding:8px 16px',
        'font-size:13px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'background:#ea4335',
        'color:#fff',
        'white-space:nowrap',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), '✗ キャンセル (ESC)', onCancel);
      
      // Add hover effect to cancel button
      cancelButton.onmouseover = () => cancelButton.style.background = '#d33828';
      cancelButton.onmouseout = () => cancelButton.style.background = '#ea4335';
      
      buttonContainer.appendChild(saveButton);
      buttonContainer.appendChild(cancelButton);
      
      // Keyboard handlers
      const handleKeyDown = (e) => {
        if (e.key === KeyHandler.ESC) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          return;
        }
        if (KeyHandler.isCtrlEnter(e)) {
          e.preventDefault();
          saveButton.click();
          return;
        }
        e.stopPropagation();
      };
      
      emojiPicker.titleInput.onkeydown = (e) => {
        if (e.key === KeyHandler.ESC) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
          return;
        }
        if (KeyHandler.isCtrlEnter(e)) {
          e.preventDefault();
          textArea.focus();
          return;
        }
        e.stopPropagation();
      };
      
      textArea.onkeydown = handleKeyDown;
      
      // Assemble container with proper layout styling
      // Container now includes emoji picker, textarea, AND buttons in a clean vertical layout
      const container = createElement('div', [
        'display:flex',
        'flex-direction:column',
        'width:100%',
        'gap:8px',
        'box-sizing:border-box'
      ].join(';'));
      container.appendChild(emojiPicker.container);
      container.appendChild(textArea);
      container.appendChild(buttonContainer);
      
      return {
        container,
        titleInput: emojiPicker.titleInput,
        textArea
      };
    };

    // Popup Modal System - Reusable component for displaying modal dialogs with tabs
    const PopupModal = {
      activeModal: null,
      
      // Create and display a modal with tabs
      create: function(options) {
        const { title, tabs, onClose } = options;
        
        // Close any existing modal
        if (this.activeModal) {
          this.close();
        }
        
        // Set modal open flag to prevent ESC from closing main popup
        KeyHandler.isModalOpen = true;
        
        // Create overlay
        const overlay = createElement('div', [
          'position:fixed',
          'top:0',
          'left:0',
          'width:100%',
          'height:100%',
          'background:rgba(0,0,0,0.5)',
          `z-index:${Z_INDEX.MODAL_OVERLAY}`,
          'display:flex',
          'align-items:center',
          'justify-content:center'
        ].join(';'));
        
        // Create modal container
        const modal = createElement('div', [
          'background:#fff',
          'border-radius:8px',
          'box-shadow:0 8px 30px rgba(0,0,0,0.3)',
          'width:90%',
          'max-width:600px',
          'max-height:80vh',
          'display:flex',
          'flex-direction:column',
          'overflow:hidden'
        ].join(';'));
        
        // Create header
        const header = createElement('div', [
          'background:#f1f3f4',
          'padding:16px 20px',
          'border-bottom:1px solid #ddd',
          'display:flex',
          'justify-content:space-between',
          'align-items:center'
        ].join(';'));
        
        const headerTitle = createElement('h2', [
          'margin:0',
          'font-size:18px',
          'font-weight:600',
          'color:#333'
        ].join(';'), title);
        
        const closeButton = createElement('button', [
          'background:transparent',
          'border:none',
          'font-size:28px',
          'cursor:pointer',
          'color:#5f6368',
          'padding:0',
          'line-height:1',
          'width:32px',
          'height:32px',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'border-radius:4px'
        ].join(';'), '×', () => {
          this.close();
          if (onClose) onClose();
        });
        closeButton.onmouseover = () => {
          closeButton.style.background = '#e8eaed';
        };
        closeButton.onmouseout = () => {
          closeButton.style.background = 'transparent';
        };
        
        header.appendChild(headerTitle);
        header.appendChild(closeButton);
        modal.appendChild(header);
        
        // Create tab navigation
        if (tabs && tabs.length > 1) {
          const tabNav = createElement('div', [
            'display:flex',
            'background:#fff',
            'border-bottom:1px solid #ddd',
            'padding:0 20px'
          ].join(';'));
          
          const tabContents = [];
          let activeTabIndex = 0;
          
          // Create tab buttons and content areas
          tabs.forEach((tab, index) => {
            // Tab button
            const tabButton = createElement('button', [
              'padding:12px 20px',
              'border:none',
              'background:transparent',
              'cursor:pointer',
              'font-size:14px',
              'font-weight:500',
              'color:#5f6368',
              'border-bottom:2px solid transparent',
              'transition:all 0.2s'
            ].join(';'), tab.label, () => {
              // Switch to this tab
              activeTabIndex = index;
              updateTabs();
            });
            
            if (index === 0) {
              tabButton.style.color = '#1a73e8';
              tabButton.style.borderBottomColor = '#1a73e8';
            }
            
            tabButton.onmouseover = () => {
              if (index !== activeTabIndex) {
                tabButton.style.background = '#f8f9fa';
              }
            };
            tabButton.onmouseout = () => {
              if (index !== activeTabIndex) {
                tabButton.style.background = 'transparent';
              }
            };
            
            tabNav.appendChild(tabButton);
            
            // Tab content
            const tabContent = createElement('div', [
              'padding:20px',
              'overflow-y:auto',
              'flex:1',
              'display:' + (index === 0 ? 'block' : 'none')
            ].join(';'));
            
            // Add content from tab configuration
            if (typeof tab.content === 'function') {
              tab.content(tabContent);
            } else if (typeof tab.content === 'string') {
              tabContent.innerHTML = tab.content;
            }
            
            tabContents.push({ button: tabButton, content: tabContent });
          });
          
          // Function to update active tab
          const updateTabs = () => {
            tabContents.forEach((item, index) => {
              if (index === activeTabIndex) {
                item.button.style.color = '#1a73e8';
                item.button.style.borderBottomColor = '#1a73e8';
                item.content.style.display = 'block';
              } else {
                item.button.style.color = '#5f6368';
                item.button.style.borderBottomColor = 'transparent';
                item.content.style.display = 'none';
              }
            });
          };
          
          modal.appendChild(tabNav);
          
          // Add all tab contents
          tabContents.forEach(item => {
            modal.appendChild(item.content);
          });
        } else if (tabs && tabs.length === 1) {
          // Single tab, just show content without tabs
          const content = createElement('div', [
            'padding:20px',
            'overflow-y:auto',
            'flex:1'
          ].join(';'));
          
          if (typeof tabs[0].content === 'function') {
            tabs[0].content(content);
          } else if (typeof tabs[0].content === 'string') {
            content.innerHTML = tabs[0].content;
          }
          
          modal.appendChild(content);
        }
        
        overlay.appendChild(modal);
        
        // Click overlay to close
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            this.close();
            if (onClose) onClose();
          }
        };
        
        // ESC key to close
        const escHandler = (e) => {
          if (e.key === KeyHandler.ESC) {
            // Prevent event from bubbling to document-level handler
            e.stopPropagation();
            e.preventDefault();
            this.close();
            if (onClose) onClose();
          }
        };
        document.addEventListener('keydown', escHandler);
        
        // Prevent background scrolling by saving and setting body overflow
        const originalOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
        
        shadow.appendChild(overlay);
        this.activeModal = { overlay, escHandler, originalOverflow };
      },
      
      // Close the active modal
      close: function() {
        if (this.activeModal) {
          document.removeEventListener('keydown', this.activeModal.escHandler);
          this.activeModal.overlay.remove();
          // Restore original body overflow to re-enable scrolling
          if (this.activeModal.originalOverflow !== '') {
            document.body.style.overflow = this.activeModal.originalOverflow;
          } else {
            // Remove the inline style to restore default behavior
            document.body.style.removeProperty('overflow');
          }
          this.activeModal = null;
          // Clear modal open flag
          KeyHandler.isModalOpen = false;
        }
      }
    };

    const wrap = createElement('div', [
      'position:fixed',
      `z-index:${Z_INDEX.BASE}`,
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
        emojiTitleRowContainer.style.display = 'none';
        input.style.display = 'none';
        saveButton.style.display = 'none';
      } else {
        emojiTitleRowContainer.style.display = 'block';
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
      // Open settings popup with tabs
      PopupModal.create({
        title: '設定',
        tabs: [
          {
            label: '⚙️ 設定',
            content: (container) => {
              // Settings tab content (placeholder for future settings)
              const settingsContent = createElement('div', [
                'font-size:14px',
                'line-height:1.8',
                'color:#333'
              ].join(';'));
              
              const settingsTitle = createElement('h3', [
                'margin:0 0 16px 0',
                'font-size:16px',
                'font-weight:600',
                'color:#333'
              ].join(';'), '設定項目');
              
              const settingsText = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:14px'
              ].join(';'), '今後の設定項目がここに追加されます。');
              
              settingsContent.appendChild(settingsTitle);
              settingsContent.appendChild(settingsText);
              container.appendChild(settingsContent);
            }
          },
          {
            label: '📋 更新履歴',
            content: (container) => {
              // Update history tab content
              const historyContent = createElement('div', [
                'font-size:14px',
                'line-height:1.8',
                'color:#333'
              ].join(';'));
              
              const appTitle = createElement('h3', [
                'margin:0 0 8px 0',
                'font-size:18px',
                'font-weight:600',
                'color:#333'
              ].join(';'), 'ローカルメモ');
              
              const appDescription = createElement('p', [
                'margin:0 0 20px 0',
                'color:#5f6368',
                'font-size:14px'
              ].join(';'), 'localStorageにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット');
              
              historyContent.appendChild(appTitle);
              historyContent.appendChild(appDescription);
              
              // Version history
              const versions = [
                {
                  version: 'v17',
                  features: [
                    '編集モード時のレイアウト修正：ボタンが編集エリアに重ならず綺麗に表示されるよう改善',
                    'createEditUI関数のリファクタリング：コンテナとボタンを明確に分離',
                    'テキストエリアとアクションボタンの適切な配置で編集性向上'
                  ]
                },
                {
                  version: 'v16',
                  features: [
                    '設定ダイアログ表示中にESCキーを押してもポップアップが閉じないよう修正',
                    '編集ボタンを押した際、テキストエリアに自動フォーカス（カーソルは文末に配置）',
                    '編集時の表示崩れを修正（適切なレイアウトスタイル適用）',
                    'requestAnimationFrame使用でフォーカスタイミングを改善',
                    'コード品質とメンテナンス性の向上'
                  ]
                },
                {
                  version: 'v14',
                  features: [
                    '設定のポップアップ化（設定タブ・更新履歴タブ）',
                    'ESCキーでポップアップを閉じる機能を追加',
                    'タブシステムによる拡張可能な設定UI'
                  ]
                },
                {
                  version: 'v13',
                  features: [
                    '既存機能の安定性向上'
                  ]
                },
                {
                  version: 'v12',
                  features: [
                    'Ctrl+Enter で保存できるように改善（見やすいヒント付き）',
                    'ESC キーで編集モードをキャンセル可能',
                    'キーボードショートカットの集中管理で拡張性向上'
                  ]
                },
                {
                  version: 'v11',
                  features: [
                    '一覧表示時、編集ボタンを押すとスクロール位置をその対象まで連れていく',
                    '一覧表示時、更新日を表示しない（シンプルなUI）',
                    '全表示時、作成日・更新日を表示（洗練されたUXで情報過多を防止）',
                    '作成日と更新日が同じ場合は更新日を非表示にしてすっきり表示'
                  ]
                }
              ];
              
              versions.forEach(versionInfo => {
                const versionSection = createElement('div', [
                  'margin-bottom:20px',
                  'padding-bottom:20px',
                  'border-bottom:1px solid #e8eaed'
                ].join(';'));
                
                const versionTitle = createElement('h4', [
                  'margin:0 0 10px 0',
                  'font-size:16px',
                  'font-weight:600',
                  'color:#1a73e8'
                ].join(';'), versionInfo.version);
                
                const featureList = createElement('ul', [
                  'margin:0',
                  'padding-left:20px',
                  'list-style-type:disc'
                ].join(';'));
                
                versionInfo.features.forEach(feature => {
                  const listItem = createElement('li', [
                    'margin-bottom:6px',
                    'color:#333'
                  ].join(';'), feature);
                  featureList.appendChild(listItem);
                });
                
                versionSection.appendChild(versionTitle);
                versionSection.appendChild(featureList);
                historyContent.appendChild(versionSection);
              });
              
              container.appendChild(historyContent);
            }
          }
        ]
      });
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

    // Emoji + Title Row Container (for proper dropdown containment)
    const emojiTitleRowContainer = createElement('div', [
      'position:relative',
      'margin-bottom:8px'
    ].join(';'));

    // Emoji + Title Row
    const emojiTitleRow = createElement('div', [
      'display:flex',
      'gap:6px',
      'align-items:center'
    ].join(';'));

    // Emoji button (show ➕ when empty, otherwise show the emoji)
    const emojiButton = createElement('button', [
      'width:42px',
      'height:42px',
      'border:1px solid #ccc',
      'border-radius:4px',
      'cursor:pointer',
      'background:#fff',
      'font-size:24px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'transition:all 0.2s',
      'flex-shrink:0',
      'padding:0'
    ].join(';'), currentEmoji || '➕', () => {
      emojiDropdown.style.display = emojiDropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    // Apply centered hover effect
    applyHoverEffect(emojiButton, 1.05, '#f5f5f5');
    
    emojiTitleRow.appendChild(emojiButton);

    // Title input
    const titleInput = createElement('input', [
      'flex:1',
      'padding:10px',
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
      if (e.key === KeyHandler.ESC) {
        close();
        return;
      }
      if (KeyHandler.isCtrlEnter(e)) {
        e.preventDefault();
        input.focus();
        return;
      }
      e.stopPropagation();
    };
    emojiTitleRow.appendChild(titleInput);

    // Emoji dropdown picker
    const emojiDropdown = createElement('div', [
      'display:none',
      'position:absolute',
      'top:48px',
      'left:0',
      'right:0',
      'background:#fff',
      'border:1px solid #ccc',
      'border-radius:6px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
      'padding:8px',
      `z-index:${Z_INDEX.DROPDOWN}`,
      'box-sizing:border-box'
    ].join(';'));

    // Random button in picker
    const randomPickerButton = createElement('button', [
      'width:100%',
      'padding:8px',
      'margin-bottom:8px',
      'font-size:13px',
      'border:1px solid #ddd',
      'border-radius:4px',
      'cursor:pointer',
      'background:#f59e0b',
      'color:#fff',
      'font-weight:500',
      'transition:background 0.2s'
    ].join(';'), '🎲 ランダム選択', () => {
      const emoji = getRandomEmoji();
      currentEmoji = emoji;
      emojiButton.textContent = emoji;
      emojiDropdown.style.display = 'none';
    });
    randomPickerButton.onmouseover = () => {
      randomPickerButton.style.background = '#d97706';
    };
    randomPickerButton.onmouseout = () => {
      randomPickerButton.style.background = '#f59e0b';
    };
    emojiDropdown.appendChild(randomPickerButton);

    // Clear button in picker
    const clearPickerButton = createElement('button', [
      'width:100%',
      'padding:8px',
      'margin-bottom:8px',
      'font-size:13px',
      'border:1px solid #ddd',
      'border-radius:4px',
      'cursor:pointer',
      'background:#ef4444',
      'color:#fff',
      'font-weight:500',
      'transition:background 0.2s'
    ].join(';'), '🗑️ 削除', () => {
      currentEmoji = '';
      emojiButton.textContent = '➕';
      emojiDropdown.style.display = 'none';
    });
    clearPickerButton.onmouseover = () => {
      clearPickerButton.style.background = '#dc2626';
    };
    clearPickerButton.onmouseout = () => {
      clearPickerButton.style.background = '#ef4444';
    };
    emojiDropdown.appendChild(clearPickerButton);

    // Emoji grid
    const emojiGrid = createElement('div', [
      'display:grid',
      'grid-template-columns:repeat(7, 1fr)',
      'gap:4px',
      'max-height:200px',
      'overflow-y:auto',
      'overflow-x:hidden',
      'padding:4px'
    ].join(';'));

    EMOJIS.forEach(emoji => {
      const emojiBtn = createElement('button', [
        'padding:8px',
        'font-size:20px',
        'border:1px solid transparent',
        'border-radius:4px',
        'cursor:pointer',
        'background:transparent',
        'transition:all 0.2s',
        'line-height:1',
        'min-width:0',
        'box-sizing:border-box'
      ].join(';'), emoji, () => {
        currentEmoji = emoji;
        emojiButton.textContent = emoji;
        emojiDropdown.style.display = 'none';
      });
      
      // Apply centered hover effect with background and border
      applyHoverEffect(emojiBtn, 1.15, '#f0f0f0', '#ccc');
      
      emojiGrid.appendChild(emojiBtn);
    });

    emojiDropdown.appendChild(emojiGrid);
    emojiTitleRowContainer.appendChild(emojiTitleRow);
    emojiTitleRowContainer.appendChild(emojiDropdown);

    body.appendChild(emojiTitleRowContainer);

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
      if (e.key === KeyHandler.ESC) {
        close();
        return;
      }
      if (KeyHandler.isCtrlEnter(e)) {
        e.preventDefault();
        saveButton.click();
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
    ].join(';'), '💾 保存 (Ctrl+Enter)', () => {
      const title = titleInput.value.trim();
      const value = input.value.trim();
      if (!value) return;

      const data = load();
      if (data.length >= MAX) {
        alert(`最大${MAX}件です`);
        return;
      }

      const now = new Date().toISOString();
      data.unshift({ title: title, text: value, createdDate: now, updatedDate: now, pinned: false, emoji: currentEmoji });
      save(data);
      titleInput.value = '';
      input.value = '';
      // Reset to empty state after saving
      currentEmoji = '';
      emojiButton.textContent = '➕';
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
        // Enter edit mode
        KeyHandler.isEditMode = true;
        
        const listItem = actions.parentElement;
        
        // Create edit UI using refactored helper
        const editUI = createEditUI(item, (updatedData) => {
          // Save handler
          const currentData = load();
          if (currentData[originalIndex]) {
            currentData[originalIndex].title = updatedData.title;
            currentData[originalIndex].text = updatedData.text;
            currentData[originalIndex].emoji = updatedData.emoji;
            currentData[originalIndex].updatedDate = new Date().toISOString();
            save(currentData);
            KeyHandler.isEditMode = false;
          }
        }, () => {
          // Cancel handler
          KeyHandler.isEditMode = false;
          renderList(load());
        });
        
        // Replace entire list item content with edit UI
        // The new edit UI is self-contained with emoji picker, textarea, and buttons all in one container
        listItem.replaceChildren(editUI.container);
        
        // Focus on textarea using requestAnimationFrame for reliable DOM update timing
        requestAnimationFrame(() => {
          editUI.textArea.focus();
          // Move cursor to end of text
          editUI.textArea.setSelectionRange(editUI.textArea.value.length, editUI.textArea.value.length);
        });
      });
      editButton.title = '編集する';

      const copyButton = createElement('button', [
        ...buttonStyle,
        'background:#34a853',
        'color:#fff'
      ].join(';'), isCompactMode ? '📋' : 'Copy', () => {
        const copyText = item.text;
        navigator.clipboard.writeText(copyText).then(() => {
          close();
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
          
          // Emoji display
          if (item.emoji) {
            const emojiSpan = createElement('span', [
              'font-size:18px',
              'flex-shrink:0'
            ].join(';'), item.emoji);
            contentArea.appendChild(emojiSpan);
          }
          
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
          
          contentArea.appendChild(titleText);
          
          contentArea.onclick = () => {
            isTitleOnlyMode = false;
            titleOnlyButton.textContent = '📋 一覧';
            titleOnlyButton.style.background = '#34a853';
            
            // Show input fields
            emojiTitleRowContainer.style.display = 'block';
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
          'width:100%',
          'box-sizing:border-box'
        ].join(';'));

        // Display title and/or emoji if they exist
        if (item.title || item.emoji) {
          const titleRow = createElement('div', [
            'display:flex',
            'align-items:center',
            'gap:8px',
            'margin-bottom:8px'
          ].join(';'));
          
          if (item.emoji) {
            const emojiSpan = createElement('span', [
              'font-size:22px',
              'flex-shrink:0'
            ].join(';'), item.emoji);
            titleRow.appendChild(emojiSpan);
          }
          
          if (item.title) {
            const titleElement = createElement('div', [
              'font-size:16px',
              'font-weight:700',
              'color:#1a73e8',
              'line-height:1.4',
              'letter-spacing:0.3px',
              'word-break:break-word',
              'flex:1'
            ].join(';'), item.title);
            titleRow.appendChild(titleElement);
          }
          
          textWrapper.appendChild(titleRow);
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
        
        // Add timestamp information with refined UX
        const timestampContainer = createElement('div', [
          'display:flex',
          'gap:8px',
          'flex-wrap:wrap',
          'margin-top:8px',
          'font-size:11px',
          'color:#888',
          'opacity:0.8'
        ].join(';'));
        
        const createdDate = new Date(item.createdDate);
        const updatedDate = new Date(item.updatedDate);
        const createdDateStr = createdDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
        const updatedDateStr = updatedDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
        
        // Show creation date
        const createdSpan = createElement('span', [
          'display:inline-flex',
          'align-items:center',
          'gap:3px'
        ].join(';'));
        const createdLabel = createElement('span', 'opacity:0.7', '作成:');
        createdSpan.appendChild(createdLabel);
        createdSpan.appendChild(document.createTextNode(' ' + createdDateStr));
        timestampContainer.appendChild(createdSpan);
        
        // Show update date only if different from creation date
        if (updatedDateStr !== createdDateStr) {
          const separator = createElement('span', 'opacity:0.5', '•');
          timestampContainer.appendChild(separator);
          
          const updatedSpan = createElement('span', [
            'display:inline-flex',
            'align-items:center',
            'gap:3px'
          ].join(';'));
          const updatedLabel = createElement('span', 'opacity:0.7', '更新:');
          updatedSpan.appendChild(updatedLabel);
          updatedSpan.appendChild(document.createTextNode(' ' + updatedDateStr));
          timestampContainer.appendChild(updatedSpan);
        }
        
        textWrapper.appendChild(timestampContainer);

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
      emojiTitleRowContainer.style.display = 'none';
      input.style.display = 'none';
      saveButton.style.display = 'none';
    }
  } catch (error) {
    console.error(error);
    alert('Error: ' + error);
  }
})();

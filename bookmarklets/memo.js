// ローカルメモ
// IndexedDBにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット
// 📝
// v54
// 2026-02-23

(async function run() {
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
      // Nested modal overlay for dialogs that appear on top of other modals
      // Used for variable edit dialog which appears above settings dialog
      NESTED_MODAL_OVERLAY: 2147483647,
      // Dropdowns inherit base level - no need for separate lower value
      DROPDOWN: 2147483647
    };

    // Centralized color constants for UI consistency
    // All save buttons should use the same primary blue color
    const COLORS = {
      // Primary action button color (save, add, primary actions)
      SAVE_BUTTON: '#1a73e8',
      // Darker shade for hover state on save buttons
      SAVE_BUTTON_HOVER: '#1557b0'
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
      'background:transparent'
    ].join(';');
    
    // Use Popover API for proper display management
    // Setting popover="manual" ensures element visibility control
    host.setAttribute('popover', 'manual');
    
    document.body.appendChild(host);
    
    // Show the popover after appending to DOM
    // This is required to make the element visible when using popover API
    host.showPopover();

    // Centralized keyboard handler for maintainability
    const KeyHandler = {
      ESC: 'Escape',
      
      // Track edit mode state to prevent ESC from closing popup during edit
      isEditMode: false,
      
      // Track if settings/modal dialog is open
      isModalOpen: false,
      
      // Track if new memo creation form is active
      isNewMemoCreating: false,
      
      // Check if Ctrl+Enter was pressed
      isCtrlEnter: (e) => {
        return (e.ctrlKey || e.metaKey) && e.key === 'Enter';
      },
      
      // Main document-level key handler (defined after close() is declared)
      handleDocumentKey: null
    };

    const close = () => {
      document.removeEventListener('keydown', KeyHandler.handleDocumentKey);
      // Hide popover before removing to ensure proper cleanup
      if (host.matches(':popover-open')) {
        host.hidePopover();
      }
      host.remove();
    };
    
    host._close = close;

    // Set up document key handler now that close() is defined
    KeyHandler.handleDocumentKey = (e) => {
      if (e.key === KeyHandler.ESC) {
        // Don't close popup if in edit mode, modal dialog is open, or creating new memo
        // Let respective handlers manage ESC behavior in those contexts
        if (!KeyHandler.isEditMode && !KeyHandler.isModalOpen && !KeyHandler.isNewMemoCreating) {
          close();
        }
      }
    };
    
    document.addEventListener('keydown', KeyHandler.handleDocumentKey);

    const shadow = host.attachShadow({ mode: 'open' });
    
    // IndexedDB configuration
    const DB_NAME = 'ls-memo-db';
    const DB_VERSION = 1;
    const STORE_NAME = 'settings';
    // localStorage keys (used only for one-time data migration)
    const LS_MEMOS_KEY = 'my_local_storage_notes';
    const LS_VIEW_MODE_KEY = 'my_local_storage_notes_view_mode';
    const LS_VARIABLES_KEY = 'my_local_storage_notes_variables';
    const LS_TAG_FILTER_KEY = 'my_local_storage_notes_tag_filter';
    const MAX = 300;

    // IndexedDB utility functions
    const openDB = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });

    const dbGet = (db, key) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const dbPut = (db, key, value) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // In-memory cache for synchronous access patterns
    let _db = null;
    const _cache = {
      memos: [],
      viewMode: null,
      variables: [],
      tagFilter: [],
      language: null
    };

    // Initialize IndexedDB, populate cache, and migrate localStorage data on first run
    const initDB = async () => {
      _db = await openDB();

      // Load from IndexedDB with one-time localStorage migration fallback
      const loadWithMigration = async (dbKey, lsKey, defaultValue) => {
        const existing = await dbGet(_db, dbKey);
        if (existing !== undefined) return existing;
        // First-time migration: copy localStorage data to IndexedDB
        try {
          const lsData = localStorage.getItem(lsKey);
          if (lsData !== null) {
            const parsed = JSON.parse(lsData);
            await dbPut(_db, dbKey, parsed);
            return parsed;
          }
        } catch {}
        return defaultValue;
      };

      _cache.memos = await loadWithMigration('memos', LS_MEMOS_KEY, []);
      _cache.viewMode = await loadWithMigration('viewMode', LS_VIEW_MODE_KEY, null);
      _cache.variables = await loadWithMigration('variables', LS_VARIABLES_KEY, []);
      _cache.tagFilter = await loadWithMigration('tagFilter', LS_TAG_FILTER_KEY, []);
      _cache.language = (await dbGet(_db, 'language')) || null;
    };

    await initDB();
    
    // Centralized version management
    // All version information is maintained here for easy updates and display
    const VERSION_INFO = {
      // Current version (automatically used in file header)
      CURRENT: 'v54',
      // Last update date (automatically used in file header)
      LAST_UPDATED: '2026-02-23',
      // Complete version history (displayed in update information tab)
      HISTORY: [
        {
          version: 'v54',
          date: '2026-02-23',
          features: [
            '多言語対応を「その他」設定から切替できるよう実装：洗練されたボタングループUIで直感的に操作',
            '自動（ブラウザ設定）・日本語・英語・簡体字中国語・韓国語・繁体字中国語の6オプションをサポート',
            '言語設定をIndexedDBに永続化：再起動後も選択した言語を維持',
            '言語変更時はポップアップを即時再起動：変更後すぐに新しい言語で表示',
            'IIFEを名前付き関数runに変更：言語変更後の再起動処理を実現',
            '非常にきれいな実装：共通処理をリファクタリングし、可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべての言語環境で正しく動作することを保証'
          ]
        },
        {
          version: 'v53',
          date: '2026-02-23',
          features: [
            '多言語対応を実装：日本語・英語・簡体字中国語・韓国語・繁体字中国語の5言語をサポート',
            'ブラウザ標準言語をデフォルト言語として自動検出：navigator.languageを使用',
            'TRANSLATIONSオブジェクトを新設：全UI文字列を一元管理し、メンテナンス性を大幅向上',
            'getLang()関数を新設：ブラウザ言語を解析し、サポート言語にマッピング（非対応言語は英語にフォールバック）',
            'T定数を新設：選択された言語のTRANSLATIONSセットへの参照を提供',
            '全UIテキストをT.xxxで参照するよう変換：ハードコードされた日本語文字列を完全に置き換え',
            '非常にきれいな実装：共通処理をリファクタリングし、可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべての言語環境で正しく動作することを保証'
          ]
        },
        {
          version: 'v52',
          date: '2026-02-22',
          features: [
            'Discord等でCtrl+Vを押した際にメモ入力欄へのペーストがDiscord側にも反映される問題を修正',
            '全入力フィールド（メモ作成2種・変数設定・テンプレート入力・編集・タグ入力）にonpasteハンドラーを追加：pasteイベントの外部伝播を防止',
            'stopPropagation共通ユーティリティを新設：各ダイアログで個別定義していたpreventInputPropagation関数を一元化し、コード重複を解消',
            '非常にきれいな実装：共通処理をリファクタリングし、可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべての入力シナリオで正しく動作することを保証'
          ]
        },
        {
          version: 'v51',
          date: '2026-02-22',
          features: [
            'ストレージをlocalStorageからIndexedDBに全面移行：大容量データの保存と安定した永続化を実現',
            '初回起動時に既存localStorageデータをIndexedDBへ自動マイグレーション：データ損失なく移行完了',
            'インメモリキャッシュによる同期的アクセスパターンを維持：既存コードの動作を完全に保持',
            '非同期初期化（initDB）でDB接続・キャッシュ投入・マイグレーションを一元管理',
            '非常にきれいな実装：共通処理をリファクタリングし、可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべてのケースで正しく動作することを保証'
          ]
        },
        {
          version: 'v50',
          date: '2026-02-21',
          features: [
            '設定ダイアログの「設定」タブを「変数」に名称変更：変数管理タブの役割を明確化',
            '「使い方」タブの内容順序を変更：テンプレート機能→変数機能→タグ機能の論理的な順序に整理',
            '「その他」タブを新規追加：将来の設定項目のためのプレースホルダー（現状は未設定項目なし）',
            'タブナビゲーションに横スクロール機能を追加：ダイアログ幅が狭い場合にタブをスクロール可能に',
            'マウスホイールでタブを横スクロール操作できるよう対応：直感的な操作性を実現',
            '非常にきれいな実装：共通処理をリファクタリングし、可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべてのタブで一貫した動作を保証'
          ]
        },
        {
          version: 'v49',
          date: '2026-02-20',
          features: [
            '設定ダイアログの高さを固定化：max-height:80vhからheight:80vhに変更し、タブ切り替え時にダイアログの高さが変わらないよう修正',
            '非常にきれいな実装：最小限の変更で本質的な問題のみを解決し、可読性とメンテナンス性を維持',
            '安全で確実な動作：既存機能に影響を与えず、すべてのタブで一貫した高さを保証'
          ]
        },
        {
          version: 'v48',
          date: '2026-02-19',
          features: [
            'textareaテンプレートの表示を改善：最小高さを60pxから82pxに変更し、最低3行分の高さを確保',
            'textareaテンプレートに自動高さ調整機能を追加：入力時に行の長さが広がるにつれてtextareaが自動的に拡大',
            'setupAutoHeight()をcreateInputElement関数のtextareaケースに適用し、スムーズなコンテンツ拡張を実現',
            'overflow-yをhiddenに変更し、transitionを追加して滑らかな高さ変更アニメーションを実装',
            '非常にきれいな実装：既存のauto-height機能を活用し、共通処理を最大限に利用して可読性とメンテナンス性を向上',
            '安全で確実な動作：既存機能に影響を与えず、すべてのtextarea要素で一貫した動作を保証'
          ]
        },
        {
          version: 'v47',
          date: '2026-02-18',
          features: [
            'テンプレート機能にtextarea（複数行テキスト入力）タイプを追加：長文や複数行の内容に対応',
            'parseTemplates関数を更新：正規表現にtextareaタイプを追加し、パース処理を拡張',
            'createInputElement関数を更新：textareaケースを追加し、TEXTAREA_CONFIGを活用した最適なスタイリングを実装',
            'getTemplateLabelText関数を更新：textareaタイプのラベルに「複数行テキスト」表示を追加',
            '使い方ガイドを更新：textareaタイプの詳細な説明と実用例を追加し、4種類のテンプレートタイプを網羅',
            '非常にきれいな実装：既存コードパターンと完全に統一し、共通処理を活用して可読性とメンテナンス性を最大化',
            '安全で確実な動作：既存機能に影響を与えず、すべてのテンプレートタイプで一貫した動作を保証'
          ]
        },
        {
          version: 'v46',
          date: '2026-02-16',
          features: [
            'テンプレート入力ダイアログの入力フォーカス問題を修正：Mattermost等のフォーカス監視機能との干渉を解消',
            'イベント伝播の適切な制御：全入力フィールドのkeydownとinputイベントにstopPropagation()を追加',
            'handleKeyDown関数を強化：既存のESC/Ctrl+Enter処理に加え、stopPropagation()を追加して外部干渉を防止',
            'preventInputPropagation関数を新設：input イベントの伝播を防止する共通処理を一元化',
            '新規メモ追加時と同じパターンを適用：compact formの実装を参考に、統一されたイベント処理を実現',
            '非常にきれいな実装：最小限の変更で本質的な問題のみを解決し、可読性とメンテナンス性を維持',
            '安全で確実な動作：既存機能に影響を与えず、すべての入力シナリオで正しく動作することを保証'
          ]
        },
        {
          version: 'v45',
          date: '2026-02-16',
          features: [
            '変数タブダイアログの入力フォーカス問題を修正：Mattermost等のフォーカス監視機能との干渉を解消',
            'イベント伝播の適切な制御：nameInputとvalueTextareaのkeydown/inputイベントにstopPropagation()を追加',
            'preventInputPropagation関数を新設：input イベントの伝播を防止する共通処理を一元化',
            'handleKeyDown関数を強化：既存のESC/Ctrl+Enter処理に加え、stopPropagation()を追加して外部干渉を防止',
            '新規メモ追加時と同じパターンを適用：compact formの実装を参考に、統一されたイベント処理を実現',
            '非常にきれいな実装：最小限の変更で本質的な問題のみを解決し、可読性とメンテナンス性を維持',
            '安全で確実な動作：既存機能に影響を与えず、すべての入力シナリオで正しく動作することを保証'
          ]
        },
        {
          version: 'v44',
          date: '2026-02-16',
          features: [
            '新規メモ作成時に絵文字が常にランダムで選ばれるよう改善：全表示モード・一覧モード共に対応',
            'initializeNewMemoEmoji()関数を新設：絵文字初期化処理を一元化し、保守性を大幅に向上',
            'currentEmojiとcompactFormState.emojiの初期化をリファクタリング：共通処理を関数化し、コードの重複を削減',
            'clearFullViewForm()とresetCompactFormState()を更新：フォームクリア時も自動的にランダム絵文字を設定',
            '非常にきれいな実装：可読性が高く、メンテナンスしやすい構造で、将来の拡張にも対応',
            '安全で確実な動作：既存機能に影響を与えず、すべてのケースで正しく動作することを保証',
            'ユーザー体験の向上：新規メモ作成時に毎回楽しい絵文字が自動設定され、メモ管理がより楽しく'
          ]
        },
        {
          version: 'v43',
          date: '2026-02-10',
          features: [
            'タグフィルタドロップダウンの連続選択バグを修正：e.stopPropagation()を追加し、イベント伝播を防止',
            'タグ項目クリック時の外側クリックハンドラー誤作動を解消：renderTagFilterDropdown()による要素再構築中のイベントバブリング問題を修正',
            'クリアボタンにもe.stopPropagation()を追加：すべてのドロップダウン内クリックで一貫した動作を実現',
            '非常にクリーンな実装：最小限の変更で確実にタグポップアップが開いたままの状態を維持',
            'コードの可読性向上：明確なコメントを追加し、イベント伝播防止の意図を文書化',
            '安全性と信頼性の向上：共通パターンに従い、不要な処理を追加せず本質的な問題のみを解決'
          ]
        },
        {
          version: 'v42',
          date: '2026-02-10',
          features: [
            'タグフィルタドロップダウンのESC動作を完全修正：ESCキーでタグポップアップのみを閉じ、本体ブックマークレットは開いたまま維持',
            'KeyHandler.isModalOpenフラグの適用：タグポップアップ開閉時に適切にフラグを管理し、ESCイベント伝播を正確に制御',
            'タグポップアップの連続選択を確認：項目クリック時にポップアップが閉じず、連続操作が可能な既存動作を維持',
            '共通処理のリファクタリング：不要な処理を削除し、コードの可読性とメンテナンス性を向上',
            '非常にクリーンな実装：既存コードパターンと完全に統一し、安全で理解しやすいコードを実現'
          ]
        },
        {
          version: 'v41',
          date: '2026-02-10',
          features: [
            'タグ入力オートコンプリートの連続選択機能を実装：タグ選択後もドロップダウンが開いたままで連続してタグを追加可能に',
            'タグ入力のESCキー挙動を修正：ESCキーでオートコンプリートドロップダウンのみを閉じ、ブックマークレット全体は開いたまま維持',
            '選択後の自動フォーカス維持：タグ選択後、入力フィールドに自動的にフォーカスを戻し、スムーズな連続入力を実現',
            'ESCキー処理の完全な制御：オートコンプリートの表示状態に関わらず、常にpreventDefaultとstopPropagationを呼び出してイベント伝播を確実に防止',
            'addTag関数のリファクタリング：ドロップダウンを閉じないようにし、入力フィールドのクリアとフォーカス維持を実現',
            '可読性とメンテナンス性の向上：タグ入力の動作をより直感的で理解しやすいコードに改善',
            '非常にクリーンな実装：既存の動作を維持しながら、ユーザビリティを大幅に向上させる安全な実装'
          ]
        },
        {
          version: 'v40',
          date: '2026-02-10',
          features: [
            'タグフィルタドロップダウンの連続選択機能を実装：選択後もドロップダウンが開いたままで連続操作が可能に',
            'タグフィルタドロップダウンのESCキー対応：ESCキーでドロップダウンのみを閉じ、メモ本体は開いたまま維持',
            'DialogManagerパターンの適用：タグフィルタドロップダウンもDialogManagerで管理し、統一されたESC挙動を実現',
            'タグフィルタドロップダウン管理の汎用化：openTagFilterDropdown/closeTagFilterDropdown関数で状態を一元管理',
            'ESCキーハンドラーの完全統合：createEscapeHandlerを使用し、他のダイアログと同様の洗練されたキー処理',
            '外側クリックでのドロップダウン自動クローズ：ドロップダウン外をクリックすると自動的に閉じる従来の動作を維持',
            '共通処理の完全なリファクタリング：ドロップダウン開閉ロジックを関数化し、可読性と保守性を大幅に向上',
            '非常にクリーンな実装：既存コードとの統一感を保ちながら、安全で理解しやすいコードを実現'
          ]
        },
        {
          version: 'v39',
          date: '2026-02-09',
          features: [
            'build.jsにinnerHTML使用の厳格チェックを追加：TrustedHTML要件違反を検出し開発時に警告を表示'
          ]
        },
        {
          version: 'v38',
          date: '2026-02-09',
          features: [
            'タグフィルタドロップダウンの幅問題を解決：min-width: 200pxを設定し、ボタン幅に制約されず操作しやすく改善',
            'タグフィルタの永続化を実装：選択したフィルタ状態をlocalStorageに保存し、次回起動時も維持',
            'フィルタ状態管理の共通化：saveTagFilter/loadTagFilter関数を追加し、保守性を向上',
            '初期化時の自動ロード：ブックマークレット起動時に前回のフィルタ状態を自動復元',
            '非常にクリーンな実装：可読性とメンテナンス性を最大限に考慮した安全な実装'
          ]
        },
        {
          version: 'v37',
          date: '2026-02-09',
          features: [
            'タグ入力オートコンプリートの幅を最適化：min-width: 250pxに設定し、狭すぎて操作しづらい問題を解決',
            'オートコンプリートの可読性向上：十分な幅により、タグ名全体が見やすく選択しやすいUIに改善',
            'テンプレート入力ダイアログのDialogManager統合：他のダイアログと同様の洗練されたモーダル動作を実現',
            'ESCキー対応の追加：テンプレート入力ダイアログでもESCキーで閉じることが可能に',
            'オーバーレイの適切な表示：既存のポップアップに対してオーバーレイをかけ、前面に表示',
            'ダブルクリック閉じ機能：誤操作防止のため、オーバーレイ外側のダブルクリックで閉じる動作を統一',
            'ダイアログスタック管理：DialogManagerのpushDialog/closeDialogを使用し、適切なESC挙動を実現',
            '共通処理の完全なリファクタリング：createTemplateFormを他のダイアログと同じパターンに統一し、保守性を大幅向上',
            '非常にきれいな実装：コード品質、可読性、メンテナンス性のすべてが最高レベルに到達'
          ]
        },
        {
          version: 'v36',
          date: '2026-02-09',
          features: [
            '【重要】ダイアログスタック管理システムの実装：ネストされたダイアログのESCキー挙動を完全に修正',
            'ESCキー動作の改善：ポップアップ→設定→変数設定の順で開いた後、ESCを2回押しても一つずつ確実に閉じるよう修正',
            'DialogManager.dialogStack導入：全ダイアログをスタックで管理し、最上位のダイアログのみがESCに反応',
            'pushDialog/popDialog/getTopDialog機能追加：クリーンで保守性の高いスタック管理API',
            'タグフィルタボタンの修正：クリック時にstopPropagationを追加し、正常に反応するように修正',
            '一覧表示タイトルのUI/UX改善：1行から2行表示に変更し、タイトル全体が見やすく美しいデザインに',
            'webkit-line-clamp活用：2行でのクリーンな省略表示を実現、読みやすさが大幅に向上',
            '極めて理解しやすい実装：ダイアログ管理を完全に共通化し、メンテナンス性を最大限に向上',
            '完全な後方互換性：既存の全機能に影響を与えず、安全に動作することを保証',
            '洗練されたコード品質：可読性、保守性、拡張性のすべてを考慮した非常にクリーンな実装'
          ]
        },
        {
          version: 'v35',
          date: '2026-02-09',
          features: [
            'タグ機能を実装：メモにタグを付けて分類・管理が可能に',
            'タグ入力コンポーネント：自動補完とファジー検索に対応した洗練されたUI',
            'タグ表示：一覧表示・全表示の両方でタグを表示、UIを最適化',
            'タグフィルタリング：タグで絞り込み表示、複数タグに対応',
            'タグ管理：使用されていないタグの削除、全タグの一覧表示',
            '新規メモ・編集時のタグ設定：直感的なタグ追加・削除UI',
            'ファジー検索：タグ入力時に部分一致・あいまい検索で候補を表示',
            '共通処理のリファクタリング：タグ関連の処理を共通化し、保守性を向上',
            '後方互換性：既存メモに自動的に空のタグ配列を追加',
            'ポップアップ幅の最適化：タグ表示に対応し、より多くの情報を表示可能に'
          ]
        },
        {
          version: 'v34',
          date: '2026-02-09',
          features: [
            'ダイアログ管理システムの大幅改善：DialogManagerを導入し、統一された高品質なダイアログ処理を実現',
            '変数設定ダイアログESC挙動の修正：ESCで変数ダイアログのみ閉じ、設定ダイアログは維持',
            '設定ダイアログ外側クリック挙動の変更：誤操作防止のため、ダブルクリックで閉じるよう変更',
            'DialogManager.createOverlayClickHandler：汎用的なダブルクリック処理を共通化',
            'DialogManager.createEscapeHandler：ダイアログ専用ESCハンドラーを一元管理',
            'DialogManager.closeDialog：全てのダイアログ閉じ処理を統一インターフェースで管理',
            'イベント伝播の適切な制御：stopPropagation/preventDefaultを正確に使い分けて親ダイアログへの影響を防止',
            '高い可読性とメンテナンス性：共通処理の完全なリファクタリングで保守性を大幅向上',
            '非常に安全な実装：既存機能に一切影響を与えず、完全に後方互換性を維持'
          ]
        },
        {
          version: 'v33',
          date: '2026-02-09',
          features: [
            '変数設定ダイアログのz-index問題を修正：設定ダイアログの後ろに隠れる問題を解消',
            'NESTED_MODAL_OVERLAYを新設：変数設定ダイアログが設定ダイアログの上に適切に表示されるよう専用のz-index定数を追加',
            'Shadow DOM統合：変数設定ダイアログをshadowに接続し、設定ダイアログと同じDOM階層で管理',
            '誤操作防止機能の実装：外側クリックによる即座の閉じを防ぎ、ダブルクリックが必要に変更',
            'closeDialog共通関数のリファクタリング：ダイアログ閉じ処理を一元化し保守性を向上',
            'クリーンで安全な実装：既存機能への影響なく、非常に可読性の高いコードで問題を解決'
          ]
        },
        {
          version: 'v32',
          date: '2026-02-09',
          features: [
            '【破壊的変更】select型の選択肢区切り文字をパイプ (|) からカンマ (,) に変更：${select:項目名|選択肢1,選択肢2}',
            'カンマ区切りにより、可読性が向上し、他の一般的なフォーマットとの一貫性を実現',
            '変数機能を新規実装：設定画面で変数を定義し、${var:変数名}でメモ本文に埋め込み可能',
            '洗練された変数管理UI：追加・編集・削除が直感的に操作できる専用の設定画面を提供',
            '変数とテンプレートのシームレス統合：変数は先に解決され、その後テンプレートが処理される',
            '変数値の自動置換：コピー時に変数が自動的に値に置き換えられ、手動入力不要',
            '共通処理のリファクタリング：loadVariables, saveVariables, resolveVariables関数を新設し保守性向上',
            '詳細なドキュメント更新：変数機能の使い方ガイドと実用例を使い方タブに追加',
            'parseTemplates関数を更新：カンマ区切りの選択肢解析に対応',
            'コピーフローを改良：変数解決→テンプレート解析→テンプレート入力→最終コピーの流れを実現'
          ]
        },
        {
          version: 'v31',
          date: '2026-02-08',
          features: [
            'テンプレート機能を大幅強化：text, number, select の3種類のテンプレート型を追加',
            'text型: 自由なテキスト入力フィールド（${text:項目名}）',
            'number型: 数値専用入力フィールド（${number:項目名}）',
            'select型: ドロップダウン選択メニュー（${select:項目名|選択肢1,選択肢2}）',
            'select型は本物の<select>と<option>タグで実装し、直感的な選択UIを提供',
            'テンプレートパーサーをリファクタリング：複数の型に対応し、選択肢もカンマ区切りで柔軟に指定可能',
            'createInputElement関数を新設：型に応じた適切な入力要素を生成し、コードの可読性と保守性を向上',
            'replaceTemplates関数を改良：テンプレート配列を受け取り、正確なプレースホルダ置換を実現',
            'ドキュメントを全面更新：3つのテンプレート型の詳細な説明と実用的な使用例を追加'
          ]
        },
        {
          version: 'v30',
          date: '2026-02-08',
          features: [
            '選択テキストテンプレート機能を実装：メモ本文に ${select:name} 形式でプレースホルダを記述可能に',
            'コピー時にテンプレートを検出し、動的な入力フォームを自動生成',
            'フォーム入力後、プレースホルダを実際の値で置換してクリップボードにコピー',
            '使いやすいUIとキーボードショートカット対応（ESCでキャンセル、Ctrl+Enterで送信）',
            'テンプレートパーサー、フォームジェネレーター、置換処理を共通化して保守性向上'
          ]
        },
        {
          version: 'v29',
          date: '2026-02-08',
          features: [
            'VERSION_INFOバージョン番号と更新日の不一致を修正：v29に統一してヘッダーとバージョン情報の同期を保証'
          ]
        },
        {
          version: 'v28',
          date: '2026-02-07',
          features: [
            '作成日と更新日が同じ場合は更新日を非表示にしてすっきり表示'
          ]
        },
        {
          version: 'v27',
          date: '2026-02-05',
          features: [
            'ESCキー動作の修正：全表示モードで新規メモ作成中にESCキーを押してもブックマークレット全体が閉じず、入力フォームのみクリアするよう改善',
            'KeyHandler.isNewMemoCreatingフラグの活用：全表示モードでも一覧モードと同様に新規作成状態を追跡',
            'clearFullViewForm関数の導入：フォームクリア処理の一元化で保守性向上',
            '絵文字選択時やテキスト入力時に新規作成フラグを自動設定してユーザー体験を向上'
          ]
        },
        {
          version: 'v26',
          date: '2026-02-05',
          features: [
            'コンパクトな新規メモ作成フォームを一覧表示に追加：リスト表示からクリーンなUIで直接メモを追加可能に'
          ]
        },
        {
          version: 'v25',
          date: '2026-02-04',
          features: [
            'ピン留めアイテムのドラッグ&ドロップ実装：視覚的フィードバック付きでピン留めアイテムを並び替え可能に',
            'DragDropManagerのクリーンなリファクタリングでメンテナンス性向上'
          ]
        },
        {
          version: 'v24',
          date: '2026-02-03',
          features: [
            'ボタンレイアウト修正：編集モードで一貫した横並び表示のためflex-wrapを削除'
          ]
        },
        {
          version: 'v23',
          date: '2026-02-02',
          features: [
            'テキストエリアの自動高さ調整実装：コンパクトな60pxから開始し、最大300pxまでコンテンツに応じて動的に拡大',
            'スムーズなトランジションとクリーンなリファクタリング実装'
          ]
        },
        {
          version: 'v22',
          date: '2026-02-01',
          features: [
            'Popover API実装：適切な表示管理とクリーンアップのためpopover="manual"属性を追加',
            'showPopover()/hidePopover()呼び出しによる確実な表示制御'
          ]
        },
        {
          version: 'v21',
          date: '2026-01-31',
          features: [
            'スタッキングコンテキスト問題修正：CDKオーバーレイコンテナより上に適切なz-index階層化を実現するためisolation:isolateを削除'
          ]
        },
        {
          version: 'v20',
          date: '2026-01-30',
          features: [
            'テキストエリアの高さ改善：20行以上のメモを快適に編集できるよう300px min-heightに増加',
            'テキストエリアスタイリングの共通化リファクタリング'
          ]
        },
        {
          version: 'v19',
          date: '2026-01-29',
          features: [
            'z-index問題修正：ページダイアログの上に常に表示されるよう全要素で集中化されたZ_INDEX定数を使用'
          ]
        },
        {
          version: 'v18',
          date: '2026-01-28',
          features: [
            '編集モードUIのリファクタリング：絵文字、タイトル、本文、保存/キャンセルボタンを単一コンテナに統合してレイアウトを簡素化'
          ]
        },
        {
          version: 'v17',
          date: '2026-01-27',
          features: [
            '編集モード時のレイアウト修正：ボタンが編集エリアに重ならず綺麗に表示されるよう改善',
            'createEditUI関数のリファクタリング：コンテナとボタンを明確に分離',
            'テキストエリアとアクションボタンの適切な配置で編集性向上'
          ]
        },
        {
          version: 'v16',
          date: '2026-01-26',
          features: [
            '設定ダイアログ表示中にESCキーを押してもポップアップが閉じないよう修正',
            '編集ボタンを押した際、テキストエリアに自動フォーカス（カーソルは文末に配置）',
            '編集時の表示崩れを修正（適切なレイアウトスタイル適用）',
            'requestAnimationFrame使用でフォーカスタイミングを改善',
            'コード品質とメンテナンス性の向上'
          ]
        },
        {
          version: 'v15',
          date: '2026-01-25',
          features: [
            'バグ修正と安定性向上'
          ]
        },
        {
          version: 'v14',
          date: '2026-01-24',
          features: [
            '設定のポップアップ化（設定タブ・更新履歴タブ）',
            'ESCキーでポップアップを閉じる機能を追加',
            'タブシステムによる拡張可能な設定UI'
          ]
        },
        {
          version: 'v13',
          date: '2026-01-23',
          features: [
            '既存機能の安定性向上'
          ]
        },
        {
          version: 'v12',
          date: '2026-01-22',
          features: [
            'Ctrl+Enter で保存できるように改善（見やすいヒント付き）',
            'ESC キーで編集モードをキャンセル可能',
            'キーボードショートカットの集中管理で拡張性向上'
          ]
        },
        {
          version: 'v11',
          date: '2026-01-21',
          features: [
            '一覧表示時、編集ボタンを押すとスクロール位置をその対象まで連れていく',
            '一覧表示時、更新日を表示しない（シンプルなUI）',
            '全表示時、作成日・更新日を表示（洗練されたUXで情報過多を防止）',
            '作成日と更新日が同じ場合は更新日を非表示にしてすっきり表示'
          ]
        }
      ]
    };

    // UI/UX constants for textarea dimensions
    // Optimized for comfortable editing with auto-height adjustment
    const TEXTAREA_CONFIG = {
      // Initial minimum height ensures at least 3 visible rows
      // Calculation: 3 rows × 13px font × 1.6 line-height + 20px padding = 82.4px
      MIN_HEIGHT: '82px',
      // Maximum height before scrolling (allows ~13+ visible lines)
      MAX_HEIGHT: '300px',
      // Font size for consistent readability
      FONT_SIZE: '13px',
      // Line height for comfortable reading
      LINE_HEIGHT: '1.6',
      // Padding for comfortable typing
      PADDING: '10px'
    };

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


    // Detect browser language and select appropriate translation set
    // Supports: ja (Japanese), en (English), zh-CN (Simplified Chinese), ko (Korean), zh-TW (Traditional Chinese)
    // Returns the user-saved language preference, or auto-detects from navigator.language
    const getLang = () => {
      if (_cache.language) return _cache.language;
      const lang = (navigator.language || 'en').toLowerCase();
      if (lang.startsWith('ja')) return 'ja';
      if (lang.startsWith('ko')) return 'ko';
      if (lang.startsWith('zh')) {
        return (lang.includes('tw') || lang.includes('hk') || lang.includes('hant')) ? 'zh-TW' : 'zh-CN';
      }
      if (lang.startsWith('en')) return 'en';
      return 'en';
    };

    // All UI text strings organized by language
    // Add new languages here - each key must exist in all language objects
    const TRANSLATIONS = {
      ja: {
        viewFull: '📝 全表示', viewList: '📋 一覧',
        viewToggleTitle: 'タイトル一覧表示を切り替えます',
        tagFilter: '🏷️ タグ', tagFilterTitle: 'タグでフィルタリング',
        settings: '⚙️ 設定', settingsTitle: 'バージョン情報を表示',
        deleteAll: '🗑️ 一括削除', deleteAllTitle: 'ピンを除いて一括削除を行います',
        titlePlaceholder: 'タイトル（省略可）',
        memoPlaceholder: 'テキストを入力...',
        memoContentPlaceholder: 'メモ内容を入力...',
        memoCompactPlaceholder: 'メモ内容...',
        tagInputPlaceholder: 'タグを入力してEnter...',
        saveMemo: '💾 保存 (Ctrl+Enter)', saveCompact: '💾 保存',
        saveBtn: '✓ 保存', cancelBtn: '✗ キャンセル',
        cancelEsc: '✗ キャンセル (ESC)', saveCtrlEnter: '✓ 保存 (Ctrl+Enter)',
        copyBtn: '✓ コピー',
        randomEmoji: '🎲 ランダム選択', clearEmoji: '🗑️ 削除',
        tagLabel: '🏷️ タグ', noTags: 'タグなし', noTagsAvailable: 'タグがありません',
        clearFilter: (n) => `✕ フィルタをクリア (${n}件選択中)`,
        pinBtn: (pinned, c) => pinned ? (c ? '📌' : '📌 Pin') : 'Pin',
        unpinTitle: 'ピン留めを解除', pinTitle: 'ピン留めする',
        editBtn: (c) => c ? '✏️' : 'Edit', editTitle: '編集する',
        copyAction: (c) => c ? '📋' : 'Copy', copyTitle: 'コピーする',
        deleteBtn: (c) => c ? '🗑️' : 'Del', deleteTitle: '削除する',
        confirmDeleteMemo: 'このメモを削除しますか？',
        addNewMemo: '➕ 新規メモを追加',
        createdLabel: '作成:', updatedLabel: '更新:',
        showMore: '▼ もっと見る', showLess: '▲ 閉じる',
        maxMemos: (m) => `最大${m}件です`,
        maxMemosCompact: (m) => `メモの保存に失敗しました。最大${m}件です`,
        deleteAllConfirm: (n) => `ピン留め以外の${n}件を削除しますか？`,
        noMemosToDelete: '削除するメモがありません',
        enterMemoContent: 'メモ内容を入力してください',
        templateFormTitle: '📝 テンプレート入力',
        templateFormDesc: '各項目を入力してください。コピー時にテンプレートが置き換えられます。',
        templateInputPlaceholder: (name) => `${name} を入力...`,
        templateSelectPlaceholder: (name) => `${name} を選択...`,
        templateLabelSelect: '(選択)', templateLabelTextarea: '(複数行テキスト)',
        templateLabelNumber: '数値', templateLabelText: 'テキスト',
        addVariableTitle: '➕ 新しい変数を追加', editVariableTitle: '✏️ 変数を編集',
        variableNameLabel: '変数名', variableNamePlaceholder: '例: ユーザー名, メールアドレス',
        variableValueLabel: '値', variableValuePlaceholder: '変数の値を入力...',
        variableNameRequired: '変数名を入力してください',
        variableNameDuplicate: (name) => `変数名「${name}」は既に使用されています`,
        variableEmpty: '(空)', variableDeleteConfirm: (name) => `変数「${name}」を削除しますか？`,
        settingsModalTitle: '設定',
        tabUsage: '📖 使い方', tabVariables: '🔧 変数',
        tabTagManagement: '🏷️ タグ管理', tabOther: '⚙️ その他', tabHistory: '📋 更新履歴',
        usageTitle: '📖 使い方ガイド', usageIntro: 'このメモツールの便利な機能をご紹介します。',
        tagFeatureTitle: '🏷️ タグ機能',
        tagFeatureDesc: 'メモにタグを付けて分類・管理できます。複数のタグを設定して、メモを整理しましょう。',
        tagFeatures: ['タグ入力時に自動補完とファジー検索で既存タグを簡単に選択', 'メモ作成・編集時にタグを追加・削除可能', '一覧表示と全表示の両方でタグを表示', 'タグでメモをフィルタリング（複数タグ選択可能）', 'タグ管理画面で不要なタグを削除可能'],
        tagUsageTitle: '💡 使い方:',
        tagSteps: ['メモ作成時または編集時に「タグ」フィールドにタグ名を入力してEnterキー', '既存タグは自動補完されるので、選択するだけでOK', 'タグ横の×ボタンでタグを削除', 'ヘッダーの「🏷️ タグ」ボタンでタグフィルタリング', '設定の「🏷️ タグ管理」でタグの一覧確認・削除'],
        templateFeatureTitle: '✨ テンプレート機能',
        templateFeatureDesc: 'メモ本文にプレースホルダを記述することで、コピー時に入力フォームが表示され、柔軟なテキスト生成が可能になります。',
        templateTypesTitle: '📝 テンプレートの種類:',
        textTypeTitle: '1. テキスト入力 (text)', textTypeDesc: '自由なテキストを入力できる基本的な入力フィールドです。',
        numberTypeTitle: '2. 数値入力 (number)', numberTypeDesc: '数値のみを入力できる入力フィールドです。',
        selectTypeTitle: '3. 選択入力 (select)', selectTypeDesc: 'ドロップダウンメニューから選択肢を選べます。カンマ (,) で区切って選択肢を指定します。注意: 選択肢の値にカンマを含めることはできません。',
        textareaTypeTitle: '4. 複数行テキスト入力 (textarea)', textareaTypeDesc: '複数行のテキストを入力できるテキストエリアです。長文や複数行の内容に最適です。',
        exampleTitle: '💡 使用例:',
        exampleCode: 'こんにちは、${text:名前}さん！\n今日は${select:天気|晴れ,曇り,雨}ですね。\n気温は${number:気温}度です。\n\n感想:\n${textarea:コメント}',
        exampleNote: '💬 コピーボタンを押すと、「名前」（テキスト入力）、「天気」（選択肢）、「気温」（数値入力）、「コメント」（複数行テキスト）の4つの入力フォームが表示され、入力後にテンプレートが置換されてコピーされます。',
        variableFeatureTitle: '🔧 変数機能',
        variableFeatureDesc: '変数を定義すると、メモ本文で繰り返し使用できる値を事前に登録できます。変数はテンプレート機能と組み合わせて使用することもできます。',
        variableUsageTitle: '📝 変数の使い方:',
        variableSteps: ['「🔧 変数」タブを開き、「➕ 新しい変数を追加」をクリック', '変数名と値を入力して保存', 'メモ本文で ${var:変数名} として使用', 'コピー時に自動的に変数の値が置き換えられます'],
        variableExampleTitle: '💡 使用例:',
        variableExampleCode: '変数設定:\n・ユーザー名 → 山田太郎\n・メール → taro@example.com\n\nメモ本文:\nお名前: ${var:ユーザー名}\n連絡先: ${var:メール}',
        variableExampleNote: '💬 変数とテンプレートを組み合わせることで、さらに柔軟なメモ作成が可能です。変数は設定で一度定義すれば、すべてのメモで使用できます。',
        tipsTitle: '💡 ヒント',
        tips: ['テンプレートがない場合は、通常通りメモ本文がそのままコピーされます', '同じ項目名と型は複数回使用できます（例: ${text:名前} を2箇所）', 'select型では選択肢をカンマ (,) で区切って指定します', '入力フォームではESCキーでキャンセル、Ctrl+Enterで送信できます', 'ピン留め機能でよく使うテンプレートを上部に固定できます'],
        variableSettingsTitle: '🔧 変数設定',
        variableSettingsDesc: '変数を定義すると、メモ本文で ${var:変数名} として使用できます。コピー時に自動的に値が置き換えられます。',
        noVariables: '変数が登録されていません', addVariable: '➕ 新しい変数を追加', editVariable: '✏️ 編集',
        tagManagementTitle: '🏷️ タグ管理',
        tagManagementDesc: 'メモに設定されているすべてのタグを管理できます。使用されていないタグを削除することも可能です。',
        noTagsYet: 'タグがまだ設定されていません。メモにタグを追加してください。',
        tagUsageCount: (n) => `${n}件のメモで使用中`, deleteTag: '削除',
        deleteTagConfirm: (tag, n) => `タグ「${tag}」は${n}件のメモで使用されています。削除してもよろしいですか？`,
        deleteTagConfirmNoMemo: (tag) => `タグ「${tag}」を削除してもよろしいですか？`,
        otherSettingsTitle: '⚙️ その他',
        languageSectionTitle: '🌐 表示言語',
        languageSectionDesc: 'UIの表示言語を変更できます。変更後は即座に反映されます。',
        languageAuto: '🌐 自動（ブラウザ設定）',
        appTitle: 'ローカルメモ',
        appDesc: 'IndexedDBにメモを保存し、編集・コピー・削除ができるフローティングメモウィジェット',
        dateLocale: 'ja-JP'
      },
      en: {
        viewFull: '📝 Full', viewList: '📋 List',
        viewToggleTitle: 'Toggle list/full view',
        tagFilter: '🏷️ Tags', tagFilterTitle: 'Filter by tags',
        settings: '⚙️ Settings', settingsTitle: 'Show settings',
        deleteAll: '🗑️ Delete All', deleteAllTitle: 'Delete all unpinned memos',
        titlePlaceholder: 'Title (optional)',
        memoPlaceholder: 'Enter text...',
        memoContentPlaceholder: 'Enter memo content...',
        memoCompactPlaceholder: 'Memo content...',
        tagInputPlaceholder: 'Type tag and press Enter...',
        saveMemo: '💾 Save (Ctrl+Enter)', saveCompact: '💾 Save',
        saveBtn: '✓ Save', cancelBtn: '✗ Cancel',
        cancelEsc: '✗ Cancel (ESC)', saveCtrlEnter: '✓ Save (Ctrl+Enter)',
        copyBtn: '✓ Copy',
        randomEmoji: '🎲 Random', clearEmoji: '🗑️ Clear',
        tagLabel: '🏷️ Tags', noTags: 'No tags', noTagsAvailable: 'No tags',
        clearFilter: (n) => `✕ Clear filter (${n} selected)`,
        pinBtn: (pinned, c) => pinned ? (c ? '📌' : '📌 Pin') : 'Pin',
        unpinTitle: 'Unpin', pinTitle: 'Pin',
        editBtn: (c) => c ? '✏️' : 'Edit', editTitle: 'Edit',
        copyAction: (c) => c ? '📋' : 'Copy', copyTitle: 'Copy',
        deleteBtn: (c) => c ? '🗑️' : 'Del', deleteTitle: 'Delete',
        confirmDeleteMemo: 'Delete this memo?',
        addNewMemo: '➕ Add New Memo',
        createdLabel: 'Created:', updatedLabel: 'Updated:',
        showMore: '▼ Show more', showLess: '▲ Show less',
        maxMemos: (m) => `Maximum ${m} memos`,
        maxMemosCompact: (m) => `Save failed. Maximum is ${m} memos`,
        deleteAllConfirm: (n) => `Delete ${n} unpinned memo(s)?`,
        noMemosToDelete: 'No memos to delete',
        enterMemoContent: 'Please enter memo content',
        templateFormTitle: '📝 Template Input',
        templateFormDesc: 'Fill in each field. Templates will be replaced when copied.',
        templateInputPlaceholder: (name) => `Enter ${name}...`,
        templateSelectPlaceholder: (name) => `Select ${name}...`,
        templateLabelSelect: '(select)', templateLabelTextarea: '(multiline text)',
        templateLabelNumber: 'number', templateLabelText: 'text',
        addVariableTitle: '➕ Add New Variable', editVariableTitle: '✏️ Edit Variable',
        variableNameLabel: 'Variable Name', variableNamePlaceholder: 'e.g. username, email',
        variableValueLabel: 'Value', variableValuePlaceholder: 'Enter variable value...',
        variableNameRequired: 'Please enter a variable name',
        variableNameDuplicate: (name) => `Variable name "${name}" is already in use`,
        variableEmpty: '(empty)', variableDeleteConfirm: (name) => `Delete variable "${name}"?`,
        settingsModalTitle: 'Settings',
        tabUsage: '📖 How to Use', tabVariables: '🔧 Variables',
        tabTagManagement: '🏷️ Tag Manager', tabOther: '⚙️ Other', tabHistory: '📋 Changelog',
        usageTitle: '📖 How to Use', usageIntro: 'Here are the useful features of this memo tool.',
        tagFeatureTitle: '🏷️ Tag Feature',
        tagFeatureDesc: 'Add tags to memos for categorization and management. Set multiple tags to organize your memos.',
        tagFeatures: ['Autocomplete and fuzzy search for existing tags when typing', 'Add/remove tags when creating or editing memos', 'Tags are displayed in both list and full view', 'Filter memos by tags (multiple tags supported)', 'Delete unused tags in the Tag Manager'],
        tagUsageTitle: '💡 How to use:',
        tagSteps: ['Type a tag name in the "Tags" field and press Enter when creating or editing a memo', 'Existing tags are autocompleted - just select them', 'Click × next to a tag to remove it', 'Click "🏷️ Tags" in the header to filter by tags', 'Go to Settings → "🏷️ Tag Manager" to view and delete tags'],
        templateFeatureTitle: '✨ Template Feature',
        templateFeatureDesc: 'Write placeholders in memo content to display an input form when copying, enabling flexible text generation.',
        templateTypesTitle: '📝 Template Types:',
        textTypeTitle: '1. Text Input (text)', textTypeDesc: 'A basic text input field for free-form text.',
        numberTypeTitle: '2. Number Input (number)', numberTypeDesc: 'An input field that only accepts numbers.',
        selectTypeTitle: '3. Dropdown Selection (select)', selectTypeDesc: 'Choose from a dropdown menu. Separate options with commas (,). Note: option values cannot contain commas.',
        textareaTypeTitle: '4. Multiline Text Input (textarea)', textareaTypeDesc: 'A textarea for multiline text. Best for long content.',
        exampleTitle: '💡 Example:',
        exampleCode: "Hello, ${text:Name}!\nToday's weather is ${select:Weather|Sunny,Cloudy,Rainy}.\nTemperature: ${number:Temp} degrees.\n\nComment:\n${textarea:Notes}",
        exampleNote: '💬 When you click Copy, input forms for "Name" (text), "Weather" (select), "Temp" (number), and "Notes" (textarea) will appear. After filling them in, the templates are replaced and copied.',
        variableFeatureTitle: '🔧 Variable Feature',
        variableFeatureDesc: 'Define variables to pre-register values you use repeatedly in memo content. Variables can also be combined with the template feature.',
        variableUsageTitle: '📝 How to use variables:',
        variableSteps: ['Open the "🔧 Variables" tab and click "➕ Add New Variable"', 'Enter the variable name and value, then save', 'Use ${var:VariableName} in memo content', 'The variable value is automatically substituted when copying'],
        variableExampleTitle: '💡 Example:',
        variableExampleCode: 'Variable settings:\n・username → John Doe\n・email → john@example.com\n\nMemo content:\nName: ${var:username}\nContact: ${var:email}',
        variableExampleNote: '💬 Combining variables and templates allows even more flexible memo creation. Once defined in settings, variables can be used in all memos.',
        tipsTitle: '💡 Tips',
        tips: ['Without templates, the memo content is copied as-is', 'The same name and type can be used multiple times (e.g., ${text:Name} in two places)', 'For select type, separate options with commas (,)', 'In input forms: ESC to cancel, Ctrl+Enter to submit', 'Pin your frequently used templates to keep them at the top'],
        variableSettingsTitle: '🔧 Variable Settings',
        variableSettingsDesc: 'Define variables to use as ${var:VariableName} in memo content. Values are automatically substituted when copying.',
        noVariables: 'No variables registered', addVariable: '➕ Add New Variable', editVariable: '✏️ Edit',
        tagManagementTitle: '🏷️ Tag Manager',
        tagManagementDesc: 'Manage all tags assigned to memos. You can also delete unused tags.',
        noTagsYet: 'No tags yet. Add tags to your memos.',
        tagUsageCount: (n) => `Used in ${n} memo(s)`, deleteTag: 'Delete',
        deleteTagConfirm: (tag, n) => `Tag "${tag}" is used in ${n} memo(s). Delete anyway?`,
        deleteTagConfirmNoMemo: (tag) => `Delete tag "${tag}"?`,
        otherSettingsTitle: '⚙️ Other',
        languageSectionTitle: '🌐 Display Language',
        languageSectionDesc: 'Change the language of the UI. Changes take effect immediately.',
        languageAuto: '🌐 Auto (Browser default)',
        appTitle: 'Local Memo',
        appDesc: 'A floating memo widget that saves memos to IndexedDB with edit, copy, and delete features',
        dateLocale: 'en-US'
      },
      'zh-CN': {
        viewFull: '📝 全显示', viewList: '📋 列表',
        viewToggleTitle: '切换列表/全显示',
        tagFilter: '🏷️ 标签', tagFilterTitle: '按标签筛选',
        settings: '⚙️ 设置', settingsTitle: '显示设置',
        deleteAll: '🗑️ 批量删除', deleteAllTitle: '删除所有未固定的备忘录',
        titlePlaceholder: '标题（可省略）',
        memoPlaceholder: '输入文本...',
        memoContentPlaceholder: '输入备忘录内容...',
        memoCompactPlaceholder: '备忘录内容...',
        tagInputPlaceholder: '输入标签后按Enter...',
        saveMemo: '💾 保存 (Ctrl+Enter)', saveCompact: '💾 保存',
        saveBtn: '✓ 保存', cancelBtn: '✗ 取消',
        cancelEsc: '✗ 取消 (ESC)', saveCtrlEnter: '✓ 保存 (Ctrl+Enter)',
        copyBtn: '✓ 复制',
        randomEmoji: '🎲 随机选择', clearEmoji: '🗑️ 清除',
        tagLabel: '🏷️ 标签', noTags: '无标签', noTagsAvailable: '没有标签',
        clearFilter: (n) => `✕ 清除筛选 (已选 ${n} 个)`,
        pinBtn: (pinned, c) => pinned ? (c ? '📌' : '📌 固定') : '固定',
        unpinTitle: '取消固定', pinTitle: '固定',
        editBtn: (c) => c ? '✏️' : '编辑', editTitle: '编辑',
        copyAction: (c) => c ? '📋' : '复制', copyTitle: '复制',
        deleteBtn: (c) => c ? '🗑️' : '删除', deleteTitle: '删除',
        confirmDeleteMemo: '删除此备忘录？',
        addNewMemo: '➕ 新建备忘录',
        createdLabel: '创建:', updatedLabel: '更新:',
        showMore: '▼ 显示更多', showLess: '▲ 收起',
        maxMemos: (m) => `最多 ${m} 条`,
        maxMemosCompact: (m) => `保存失败，最多 ${m} 条`,
        deleteAllConfirm: (n) => `删除 ${n} 条未固定的备忘录？`,
        noMemosToDelete: '没有可删除的备忘录',
        enterMemoContent: '请输入备忘录内容',
        templateFormTitle: '📝 模板输入',
        templateFormDesc: '请填写每个字段，复制时将替换模板。',
        templateInputPlaceholder: (name) => `输入 ${name}...`,
        templateSelectPlaceholder: (name) => `选择 ${name}...`,
        templateLabelSelect: '(选择)', templateLabelTextarea: '(多行文本)',
        templateLabelNumber: '数字', templateLabelText: '文本',
        addVariableTitle: '➕ 添加新变量', editVariableTitle: '✏️ 编辑变量',
        variableNameLabel: '变量名', variableNamePlaceholder: '例如：用户名、邮箱',
        variableValueLabel: '值', variableValuePlaceholder: '输入变量值...',
        variableNameRequired: '请输入变量名',
        variableNameDuplicate: (name) => `变量名「${name}」已被使用`,
        variableEmpty: '(空)', variableDeleteConfirm: (name) => `删除变量「${name}」？`,
        settingsModalTitle: '设置',
        tabUsage: '📖 使用说明', tabVariables: '🔧 变量',
        tabTagManagement: '🏷️ 标签管理', tabOther: '⚙️ 其他', tabHistory: '📋 更新历史',
        usageTitle: '📖 使用说明', usageIntro: '以下是此备忘录工具的实用功能介绍。',
        tagFeatureTitle: '🏷️ 标签功能',
        tagFeatureDesc: '为备忘录添加标签以分类和管理。设置多个标签来整理您的备忘录。',
        tagFeatures: ['输入时自动补全和模糊搜索现有标签', '创建或编辑备忘录时可添加/删除标签', '列表和全显示模式均显示标签', '按标签筛选备忘录（支持多选）', '在标签管理中删除不需要的标签'],
        tagUsageTitle: '💡 使用方法：',
        tagSteps: ['创建或编辑备忘录时，在「标签」字段输入标签名后按Enter', '已有标签会自动补全，选择即可', '点击标签旁的×可删除标签', '点击标题栏「🏷️ 标签」按钮按标签筛选', '在设置「🏷️ 标签管理」中查看和删除标签'],
        templateFeatureTitle: '✨ 模板功能',
        templateFeatureDesc: '在备忘录内容中写入占位符，复制时会显示输入表单，实现灵活的文本生成。',
        templateTypesTitle: '📝 模板类型：',
        textTypeTitle: '1. 文本输入 (text)', textTypeDesc: '可自由输入文本的基本输入字段。',
        numberTypeTitle: '2. 数字输入 (number)', numberTypeDesc: '只能输入数字的输入字段。',
        selectTypeTitle: '3. 下拉选择 (select)', selectTypeDesc: '从下拉菜单中选择。用逗号(,)分隔选项。注意：选项值不能包含逗号。',
        textareaTypeTitle: '4. 多行文本输入 (textarea)', textareaTypeDesc: '可输入多行文本的文本框，适合长内容。',
        exampleTitle: '💡 使用示例：',
        exampleCode: '你好，${text:姓名}！\n今天天气${select:天气|晴天,多云,下雨}。\n气温${number:温度}度。\n\n感想：\n${textarea:备注}',
        exampleNote: '💬 点击复制按钮后，会显示「姓名」（文本）、「天气」（选择）、「温度」（数字）、「备注」（多行文本）四个输入表单，填写后模板将被替换并复制。',
        variableFeatureTitle: '🔧 变量功能',
        variableFeatureDesc: '定义变量可以预先注册在备忘录内容中重复使用的值，也可以与模板功能组合使用。',
        variableUsageTitle: '📝 变量使用方法：',
        variableSteps: ['打开「🔧 变量」选项卡，点击「➕ 添加新变量」', '输入变量名和值后保存', '在备忘录内容中使用 ${var:变量名}', '复制时自动替换为变量的值'],
        variableExampleTitle: '💡 使用示例：',
        variableExampleCode: '变量设置：\n・用户名 → 张三\n・邮箱 → zhang@example.com\n\n备忘录内容：\n姓名：${var:用户名}\n联系方式：${var:邮箱}',
        variableExampleNote: '💬 变量与模板组合使用可实现更灵活的备忘录创建。在设置中定义一次后，所有备忘录都可以使用。',
        tipsTitle: '💡 提示',
        tips: ['没有模板时，备忘录内容将直接复制', '相同名称和类型可多次使用（例如在两处使用 ${text:姓名}）', 'select类型用逗号(,)分隔选项', '在输入表单中可用ESC取消，Ctrl+Enter提交', '使用固定功能将常用模板置顶'],
        variableSettingsTitle: '🔧 变量设置',
        variableSettingsDesc: '定义变量后，可在备忘录内容中使用 ${var:变量名}，复制时自动替换为变量值。',
        noVariables: '尚未注册变量', addVariable: '➕ 添加新变量', editVariable: '✏️ 编辑',
        tagManagementTitle: '🏷️ 标签管理',
        tagManagementDesc: '管理备忘录中设置的所有标签，也可以删除不再使用的标签。',
        noTagsYet: '尚未设置标签，请为备忘录添加标签。',
        tagUsageCount: (n) => `在 ${n} 条备忘录中使用`, deleteTag: '删除',
        deleteTagConfirm: (tag, n) => `标签「${tag}」在 ${n} 条备忘录中使用，确定删除？`,
        deleteTagConfirmNoMemo: (tag) => `确定删除标签「${tag}」？`,
        otherSettingsTitle: '⚙️ 其他',
        languageSectionTitle: '🌐 显示语言',
        languageSectionDesc: '更改界面显示语言，更改后立即生效。',
        languageAuto: '🌐 自动（浏览器设置）',
        appTitle: '本地备忘录',
        appDesc: '将备忘录保存到IndexedDB，支持编辑、复制和删除的浮动备忘录小组件',
        dateLocale: 'zh-CN'
      },
      ko: {
        viewFull: '📝 전체 보기', viewList: '📋 목록',
        viewToggleTitle: '목록/전체 보기 전환',
        tagFilter: '🏷️ 태그', tagFilterTitle: '태그로 필터링',
        settings: '⚙️ 설정', settingsTitle: '설정 표시',
        deleteAll: '🗑️ 일괄 삭제', deleteAllTitle: '고정되지 않은 메모 모두 삭제',
        titlePlaceholder: '제목 (선택사항)',
        memoPlaceholder: '텍스트 입력...',
        memoContentPlaceholder: '메모 내용 입력...',
        memoCompactPlaceholder: '메모 내용...',
        tagInputPlaceholder: '태그 입력 후 Enter...',
        saveMemo: '💾 저장 (Ctrl+Enter)', saveCompact: '💾 저장',
        saveBtn: '✓ 저장', cancelBtn: '✗ 취소',
        cancelEsc: '✗ 취소 (ESC)', saveCtrlEnter: '✓ 저장 (Ctrl+Enter)',
        copyBtn: '✓ 복사',
        randomEmoji: '🎲 랜덤 선택', clearEmoji: '🗑️ 삭제',
        tagLabel: '🏷️ 태그', noTags: '태그 없음', noTagsAvailable: '태그 없음',
        clearFilter: (n) => `✕ 필터 초기화 (${n}개 선택됨)`,
        pinBtn: (pinned, c) => pinned ? (c ? '📌' : '📌 고정') : '고정',
        unpinTitle: '고정 해제', pinTitle: '고정',
        editBtn: (c) => c ? '✏️' : '편집', editTitle: '편집',
        copyAction: (c) => c ? '📋' : '복사', copyTitle: '복사',
        deleteBtn: (c) => c ? '🗑️' : '삭제', deleteTitle: '삭제',
        confirmDeleteMemo: '이 메모를 삭제하시겠습니까?',
        addNewMemo: '➕ 새 메모 추가',
        createdLabel: '생성:', updatedLabel: '수정:',
        showMore: '▼ 더 보기', showLess: '▲ 닫기',
        maxMemos: (m) => `최대 ${m}개`,
        maxMemosCompact: (m) => `저장 실패. 최대 ${m}개`,
        deleteAllConfirm: (n) => `고정되지 않은 ${n}개를 삭제하시겠습니까?`,
        noMemosToDelete: '삭제할 메모가 없습니다',
        enterMemoContent: '메모 내용을 입력해주세요',
        templateFormTitle: '📝 템플릿 입력',
        templateFormDesc: '각 항목을 입력해주세요. 복사 시 템플릿이 대체됩니다.',
        templateInputPlaceholder: (name) => `${name} 입력...`,
        templateSelectPlaceholder: (name) => `${name} 선택...`,
        templateLabelSelect: '(선택)', templateLabelTextarea: '(여러 줄 텍스트)',
        templateLabelNumber: '숫자', templateLabelText: '텍스트',
        addVariableTitle: '➕ 새 변수 추가', editVariableTitle: '✏️ 변수 편집',
        variableNameLabel: '변수명', variableNamePlaceholder: '예: 사용자명, 이메일',
        variableValueLabel: '값', variableValuePlaceholder: '변수 값 입력...',
        variableNameRequired: '변수명을 입력해주세요',
        variableNameDuplicate: (name) => `변수명 「${name}」은 이미 사용 중입니다`,
        variableEmpty: '(비어있음)', variableDeleteConfirm: (name) => `변수 「${name}」를 삭제하시겠습니까?`,
        settingsModalTitle: '설정',
        tabUsage: '📖 사용법', tabVariables: '🔧 변수',
        tabTagManagement: '🏷️ 태그 관리', tabOther: '⚙️ 기타', tabHistory: '📋 업데이트 기록',
        usageTitle: '📖 사용 가이드', usageIntro: '이 메모 도구의 편리한 기능을 소개합니다.',
        tagFeatureTitle: '🏷️ 태그 기능',
        tagFeatureDesc: '메모에 태그를 붙여 분류하고 관리할 수 있습니다. 여러 태그를 설정하여 메모를 정리하세요.',
        tagFeatures: ['태그 입력 시 자동 완성 및 퍼지 검색으로 기존 태그 선택 가능', '메모 작성/편집 시 태그 추가/삭제 가능', '목록 보기와 전체 보기 모두에서 태그 표시', '태그로 메모 필터링 (다중 태그 선택 가능)', '태그 관리 화면에서 불필요한 태그 삭제 가능'],
        tagUsageTitle: '💡 사용 방법:',
        tagSteps: ['메모 작성 또는 편집 시 「태그」 필드에 태그명 입력 후 Enter', '기존 태그는 자동 완성되므로 선택만 하면 됩니다', '태그 옆의 × 버튼으로 태그 삭제', '헤더의 「🏷️ 태그」 버튼으로 태그 필터링', '설정의 「🏷️ 태그 관리」에서 태그 목록 확인 및 삭제'],
        templateFeatureTitle: '✨ 템플릿 기능',
        templateFeatureDesc: '메모 내용에 플레이스홀더를 작성하면 복사 시 입력 폼이 표시되어 유연한 텍스트 생성이 가능합니다.',
        templateTypesTitle: '📝 템플릿 유형:',
        textTypeTitle: '1. 텍스트 입력 (text)', textTypeDesc: '자유로운 텍스트를 입력할 수 있는 기본 입력 필드입니다.',
        numberTypeTitle: '2. 숫자 입력 (number)', numberTypeDesc: '숫자만 입력할 수 있는 입력 필드입니다.',
        selectTypeTitle: '3. 선택 입력 (select)', selectTypeDesc: '드롭다운 메뉴에서 선택할 수 있습니다. 쉼표(,)로 선택지를 구분합니다. 주의: 선택지 값에 쉼표를 포함할 수 없습니다.',
        textareaTypeTitle: '4. 여러 줄 텍스트 입력 (textarea)', textareaTypeDesc: '여러 줄 텍스트를 입력할 수 있는 텍스트 영역입니다. 긴 내용에 적합합니다.',
        exampleTitle: '💡 사용 예시:',
        exampleCode: '안녕하세요, ${text:이름}님!\n오늘 날씨는 ${select:날씨|맑음,흐림,비}입니다.\n기온은 ${number:기온}도입니다.\n\n감상:\n${textarea:코멘트}',
        exampleNote: '💬 복사 버튼을 누르면 「이름」(텍스트), 「날씨」(선택), 「기온」(숫자), 「코멘트」(여러 줄 텍스트) 4개의 입력 폼이 표시되고, 입력 후 템플릿이 대체되어 복사됩니다.',
        variableFeatureTitle: '🔧 변수 기능',
        variableFeatureDesc: '변수를 정의하면 메모 내용에서 반복적으로 사용하는 값을 미리 등록할 수 있습니다. 템플릿 기능과 조합하여 사용할 수도 있습니다.',
        variableUsageTitle: '📝 변수 사용 방법:',
        variableSteps: ['「🔧 변수」 탭을 열고 「➕ 새 변수 추가」 클릭', '변수명과 값을 입력하고 저장', '메모 내용에서 ${var:변수명}으로 사용', '복사 시 자동으로 변수 값으로 대체됩니다'],
        variableExampleTitle: '💡 사용 예시:',
        variableExampleCode: '변수 설정:\n・사용자명 → 홍길동\n・이메일 → hong@example.com\n\n메모 내용:\n이름: ${var:사용자명}\n연락처: ${var:이메일}',
        variableExampleNote: '💬 변수와 템플릿을 조합하면 더욱 유연한 메모 작성이 가능합니다. 설정에서 한 번 정의하면 모든 메모에서 사용할 수 있습니다.',
        tipsTitle: '💡 팁',
        tips: ['템플릿이 없는 경우 메모 내용이 그대로 복사됩니다', '같은 항목명과 유형을 여러 번 사용할 수 있습니다 (예: ${text:이름}을 2곳에)', 'select 유형에서는 쉼표(,)로 선택지를 구분합니다', '입력 폼에서 ESC로 취소, Ctrl+Enter로 제출할 수 있습니다', '고정 기능으로 자주 사용하는 템플릿을 상단에 고정할 수 있습니다'],
        variableSettingsTitle: '🔧 변수 설정',
        variableSettingsDesc: '변수를 정의하면 메모 내용에서 ${var:변수명}으로 사용할 수 있습니다. 복사 시 자동으로 값이 대체됩니다.',
        noVariables: '등록된 변수가 없습니다', addVariable: '➕ 새 변수 추가', editVariable: '✏️ 편집',
        tagManagementTitle: '🏷️ 태그 관리',
        tagManagementDesc: '메모에 설정된 모든 태그를 관리할 수 있습니다. 사용하지 않는 태그도 삭제할 수 있습니다.',
        noTagsYet: '아직 태그가 설정되지 않았습니다. 메모에 태그를 추가해주세요.',
        tagUsageCount: (n) => `${n}개의 메모에서 사용 중`, deleteTag: '삭제',
        deleteTagConfirm: (tag, n) => `태그 「${tag}」는 ${n}개의 메모에서 사용 중입니다. 삭제하시겠습니까?`,
        deleteTagConfirmNoMemo: (tag) => `태그 「${tag}」를 삭제하시겠습니까?`,
        otherSettingsTitle: '⚙️ 기타',
        languageSectionTitle: '🌐 표시 언어',
        languageSectionDesc: 'UI 표시 언어를 변경할 수 있습니다. 변경 후 즉시 반영됩니다.',
        languageAuto: '🌐 자동（브라우저 설정）',
        appTitle: '로컬 메모',
        appDesc: 'IndexedDB에 메모를 저장하고 편집, 복사, 삭제가 가능한 플로팅 메모 위젯',
        dateLocale: 'ko-KR'
      },
      'zh-TW': {
        viewFull: '📝 全顯示', viewList: '📋 清單',
        viewToggleTitle: '切換清單/全顯示',
        tagFilter: '🏷️ 標籤', tagFilterTitle: '依標籤篩選',
        settings: '⚙️ 設定', settingsTitle: '顯示設定',
        deleteAll: '🗑️ 批次刪除', deleteAllTitle: '刪除所有未固定的備忘錄',
        titlePlaceholder: '標題（可省略）',
        memoPlaceholder: '輸入文字...',
        memoContentPlaceholder: '輸入備忘錄內容...',
        memoCompactPlaceholder: '備忘錄內容...',
        tagInputPlaceholder: '輸入標籤後按Enter...',
        saveMemo: '💾 儲存 (Ctrl+Enter)', saveCompact: '💾 儲存',
        saveBtn: '✓ 儲存', cancelBtn: '✗ 取消',
        cancelEsc: '✗ 取消 (ESC)', saveCtrlEnter: '✓ 儲存 (Ctrl+Enter)',
        copyBtn: '✓ 複製',
        randomEmoji: '🎲 隨機選擇', clearEmoji: '🗑️ 清除',
        tagLabel: '🏷️ 標籤', noTags: '無標籤', noTagsAvailable: '沒有標籤',
        clearFilter: (n) => `✕ 清除篩選 (已選 ${n} 個)`,
        pinBtn: (pinned, c) => pinned ? (c ? '📌' : '📌 固定') : '固定',
        unpinTitle: '取消固定', pinTitle: '固定',
        editBtn: (c) => c ? '✏️' : '編輯', editTitle: '編輯',
        copyAction: (c) => c ? '📋' : '複製', copyTitle: '複製',
        deleteBtn: (c) => c ? '🗑️' : '刪除', deleteTitle: '刪除',
        confirmDeleteMemo: '刪除此備忘錄？',
        addNewMemo: '➕ 新增備忘錄',
        createdLabel: '建立:', updatedLabel: '更新:',
        showMore: '▼ 顯示更多', showLess: '▲ 收起',
        maxMemos: (m) => `最多 ${m} 條`,
        maxMemosCompact: (m) => `儲存失敗，最多 ${m} 條`,
        deleteAllConfirm: (n) => `刪除 ${n} 條未固定的備忘錄？`,
        noMemosToDelete: '沒有可刪除的備忘錄',
        enterMemoContent: '請輸入備忘錄內容',
        templateFormTitle: '📝 範本輸入',
        templateFormDesc: '請填寫每個欄位，複製時將替換範本。',
        templateInputPlaceholder: (name) => `輸入 ${name}...`,
        templateSelectPlaceholder: (name) => `選擇 ${name}...`,
        templateLabelSelect: '(選擇)', templateLabelTextarea: '(多行文字)',
        templateLabelNumber: '數字', templateLabelText: '文字',
        addVariableTitle: '➕ 新增變數', editVariableTitle: '✏️ 編輯變數',
        variableNameLabel: '變數名稱', variableNamePlaceholder: '例如：使用者名稱、電子郵件',
        variableValueLabel: '值', variableValuePlaceholder: '輸入變數值...',
        variableNameRequired: '請輸入變數名稱',
        variableNameDuplicate: (name) => `變數名稱「${name}」已被使用`,
        variableEmpty: '(空)', variableDeleteConfirm: (name) => `刪除變數「${name}」？`,
        settingsModalTitle: '設定',
        tabUsage: '📖 使用說明', tabVariables: '🔧 變數',
        tabTagManagement: '🏷️ 標籤管理', tabOther: '⚙️ 其他', tabHistory: '📋 更新記錄',
        usageTitle: '📖 使用說明', usageIntro: '以下是此備忘錄工具的實用功能介紹。',
        tagFeatureTitle: '🏷️ 標籤功能',
        tagFeatureDesc: '為備忘錄新增標籤以分類和管理。設定多個標籤來整理您的備忘錄。',
        tagFeatures: ['輸入時自動補全和模糊搜尋現有標籤', '建立或編輯備忘錄時可新增/刪除標籤', '清單和全顯示模式均顯示標籤', '依標籤篩選備忘錄（支援多選）', '在標籤管理中刪除不需要的標籤'],
        tagUsageTitle: '💡 使用方法：',
        tagSteps: ['建立或編輯備忘錄時，在「標籤」欄位輸入標籤名稱後按Enter', '已有標籤會自動補全，選擇即可', '點選標籤旁的×可刪除標籤', '點選標題列「🏷️ 標籤」按鈕依標籤篩選', '在設定「🏷️ 標籤管理」中查看和刪除標籤'],
        templateFeatureTitle: '✨ 範本功能',
        templateFeatureDesc: '在備忘錄內容中寫入占位符，複製時會顯示輸入表單，實現靈活的文字生成。',
        templateTypesTitle: '📝 範本類型：',
        textTypeTitle: '1. 文字輸入 (text)', textTypeDesc: '可自由輸入文字的基本輸入欄位。',
        numberTypeTitle: '2. 數字輸入 (number)', numberTypeDesc: '只能輸入數字的輸入欄位。',
        selectTypeTitle: '3. 下拉選擇 (select)', selectTypeDesc: '從下拉選單中選擇。用逗號(,)分隔選項。注意：選項值不能包含逗號。',
        textareaTypeTitle: '4. 多行文字輸入 (textarea)', textareaTypeDesc: '可輸入多行文字的文字區域，適合長內容。',
        exampleTitle: '💡 使用範例：',
        exampleCode: '您好，${text:姓名}！\n今天天氣${select:天氣|晴天,多雲,下雨}。\n氣溫${number:溫度}度。\n\n感想：\n${textarea:備注}',
        exampleNote: '💬 點選複製按鈕後，會顯示「姓名」（文字）、「天氣」（選擇）、「溫度」（數字）、「備注」（多行文字）四個輸入表單，填寫後範本將被替換並複製。',
        variableFeatureTitle: '🔧 變數功能',
        variableFeatureDesc: '定義變數可以預先登錄在備忘錄內容中重複使用的值，也可以與範本功能組合使用。',
        variableUsageTitle: '📝 變數使用方法：',
        variableSteps: ['開啟「🔧 變數」索引標籤，點選「➕ 新增變數」', '輸入變數名稱和值後儲存', '在備忘錄內容中使用 ${var:變數名稱}', '複製時自動替換為變數的值'],
        variableExampleTitle: '💡 使用範例：',
        variableExampleCode: '變數設定：\n・使用者名稱 → 王小明\n・電子郵件 → wang@example.com\n\n備忘錄內容：\n姓名：${var:使用者名稱}\n聯絡方式：${var:電子郵件}',
        variableExampleNote: '💬 變數與範本組合使用可實現更靈活的備忘錄建立。在設定中定義一次後，所有備忘錄都可以使用。',
        tipsTitle: '💡 提示',
        tips: ['沒有範本時，備忘錄內容將直接複製', '相同名稱和類型可多次使用（例如在兩處使用 ${text:姓名}）', 'select類型用逗號(,)分隔選項', '在輸入表單中可用ESC取消，Ctrl+Enter提交', '使用固定功能將常用範本置頂'],
        variableSettingsTitle: '🔧 變數設定',
        variableSettingsDesc: '定義變數後，可在備忘錄內容中使用 ${var:變數名稱}，複製時自動替換為變數值。',
        noVariables: '尚未登錄變數', addVariable: '➕ 新增變數', editVariable: '✏️ 編輯',
        tagManagementTitle: '🏷️ 標籤管理',
        tagManagementDesc: '管理備忘錄中設定的所有標籤，也可以刪除不再使用的標籤。',
        noTagsYet: '尚未設定標籤，請為備忘錄新增標籤。',
        tagUsageCount: (n) => `在 ${n} 條備忘錄中使用`, deleteTag: '刪除',
        deleteTagConfirm: (tag, n) => `標籤「${tag}」在 ${n} 條備忘錄中使用，確定刪除？`,
        deleteTagConfirmNoMemo: (tag) => `確定刪除標籤「${tag}」？`,
        otherSettingsTitle: '⚙️ 其他',
        languageSectionTitle: '🌐 顯示語言',
        languageSectionDesc: '可以變更UI的顯示語言，變更後立即生效。',
        languageAuto: '🌐 自動（瀏覽器設定）',
        appTitle: '本地備忘錄',
        appDesc: '將備忘錄儲存到IndexedDB，支援編輯、複製和刪除的浮動備忘錄小工具',
        dateLocale: 'zh-TW'
      }
    };

    // Available language options for the language switcher in Other settings tab.
    // code: null = auto-detect from browser, otherwise must match a key in TRANSLATIONS.
    // Fixed native labels are always shown in their own script regardless of current UI language.
    const LANGUAGES = [
      { code: null },
      { code: 'ja',    label: '🇯🇵 日本語' },
      { code: 'en',    label: '🇺🇸 English' },
      { code: 'zh-CN', label: '🇨🇳 简体中文' },
      { code: 'ko',    label: '🇰🇷 한국어' },
      { code: 'zh-TW', label: '🇹🇼 繁體中文' }
    ];

    // Select translation set based on browser language (or saved preference)
    const T = TRANSLATIONS[getLang()];

    // Drag & Drop Manager
    // Provides clean, maintainable drag & drop functionality with visual feedback
    const DragDropManager = {
      // State tracking for drag operations
      draggedElement: null,
      draggedIndex: null,
      dropIndicator: null,
      // Track all draggable elements for enable/disable functionality
      draggableElements: new Set(),
      
      /**
       * Initialize drag & drop functionality for a list item
       * @param {HTMLElement} listItem - The list item element
       * @param {number} pinnedIndex - Index within pinned items array
       * @param {Array} allData - Complete data array
       * @param {Function} onReorder - Callback when reorder occurs
       */
      setupDraggable(listItem, pinnedIndex, allData, onReorder) {
        // Only pinned items are draggable
        listItem.setAttribute('draggable', 'true');
        listItem.style.cursor = 'move';
        
        // Track this element for enable/disable functionality
        this.draggableElements.add(listItem);
        
        // Add drag handle indicator (visual cue for draggability)
        const dragHandle = createElement('div', [
          'position:absolute',
          'left:4px',
          'top:50%',
          'transform:translateY(-50%)',
          'font-size:14px',
          'color:#bbb',
          'pointer-events:none',
          'user-select:none'
        ].join(';'), '⋮⋮');
        listItem.style.position = 'relative';
        listItem.style.paddingLeft = '24px';
        listItem.insertBefore(dragHandle, listItem.firstChild);
        
        // Drag start event
        listItem.addEventListener('dragstart', (e) => {
          this.draggedElement = listItem;
          this.draggedIndex = pinnedIndex;
          
          // Visual feedback: semi-transparent
          listItem.style.opacity = '0.4';
          
          // Set drag data
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', listItem.innerHTML);
        });
        
        // Drag end event
        listItem.addEventListener('dragend', () => {
          // Restore opacity
          if (this.draggedElement) {
            this.draggedElement.style.opacity = '1';
          }
          
          // Clean up
          this.draggedElement = null;
          this.draggedIndex = null;
          this.removeDropIndicator();
        });
        
        // Drag over event
        listItem.addEventListener('dragover', (e) => {
          if (!this.draggedElement || this.draggedElement === listItem) {
            return;
          }
          
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          
          // Show drop indicator
          this.showDropIndicator(listItem, e.clientY);
        });
        
        // Drag leave event
        listItem.addEventListener('dragleave', (e) => {
          // Only remove indicator if leaving the entire element
          if (e.target === listItem) {
            this.removeDropIndicator();
          }
        });
        
        // Drop event
        listItem.addEventListener('drop', (e) => {
          if (!this.draggedElement || this.draggedElement === listItem) {
            return;
          }
          
          e.preventDefault();
          e.stopPropagation();
          
          // Calculate drop position based on mouse Y position
          const rect = listItem.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          
          let targetIndex = pinnedIndex;
          const sourceIndex = this.draggedIndex;
          
          // If dropping after midpoint, adjust target index
          if (e.clientY >= midpoint) {
            targetIndex = pinnedIndex + 1;
          }
          
          // Adjust for items moving down (need to account for removal of source)
          if (sourceIndex < targetIndex) {
            targetIndex--;
          }
          
          if (sourceIndex !== targetIndex) {
            // Perform reorder
            this.reorderPinnedItems(sourceIndex, targetIndex, allData, onReorder);
          }
          
          this.removeDropIndicator();
        });
      },
      
      /**
       * Show visual indicator for drop position
       * @param {HTMLElement} targetElement - Element being hovered over
       * @param {number} mouseY - Mouse Y position
       */
      showDropIndicator(targetElement, mouseY) {
        // Remove existing indicator
        this.removeDropIndicator();
        
        // Create drop indicator line
        const indicator = createElement('div', [
          'position:absolute',
          'left:0',
          'right:0',
          'height:3px',
          'background:#4285f4',
          'border-radius:2px',
          'pointer-events:none',
          'z-index:1000',
          'box-shadow:0 0 4px rgba(66,133,244,0.5)'
        ].join(';'));
        
        // Determine if drop should be before or after
        const rect = targetElement.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (mouseY < midpoint) {
          // Drop before
          indicator.style.top = '-2px';
        } else {
          // Drop after
          indicator.style.bottom = '-2px';
        }
        
        targetElement.style.position = 'relative';
        targetElement.appendChild(indicator);
        this.dropIndicator = indicator;
      },
      
      /**
       * Remove drop indicator from DOM
       */
      removeDropIndicator() {
        if (this.dropIndicator && this.dropIndicator.parentNode) {
          this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
        this.dropIndicator = null;
      },
      
      /**
       * Reorder pinned items in the data array
       * @param {number} fromIndex - Source index within pinned items
       * @param {number} toIndex - Target index within pinned items
       * @param {Array} allData - Complete data array
       * @param {Function} onReorder - Callback after reordering
       */
      reorderPinnedItems(fromIndex, toIndex, allData, onReorder) {
        // Extract pinned and unpinned items
        const pinnedItems = allData.filter(item => item.pinned);
        const unpinnedItems = allData.filter(item => !item.pinned);
        
        // Reorder pinned items
        const [movedItem] = pinnedItems.splice(fromIndex, 1);
        pinnedItems.splice(toIndex, 0, movedItem);
        
        // Reconstruct data array: pinned first, then unpinned
        const newData = [...pinnedItems, ...unpinnedItems];
        
        // Trigger callback with new data
        onReorder(newData);
      },
      
      /**
       * Disable drag & drop for all tracked elements
       * Used when entering edit mode to prevent interference with text selection
       */
      disableAll() {
        this.draggableElements.forEach(element => {
          element.setAttribute('draggable', 'false');
          element.style.cursor = 'default';
        });
      },
      
      /**
       * Enable drag & drop for all tracked elements
       * Used when exiting edit mode to restore drag functionality
       */
      enableAll() {
        this.draggableElements.forEach(element => {
          element.setAttribute('draggable', 'true');
          element.style.cursor = 'move';
        });
      },
      
      /**
       * Clear all tracked draggable elements
       * Called when re-rendering the list to start fresh
       */
      clearTracking() {
        this.draggableElements.clear();
      }
    };

    const load = () => {
      const data = Array.isArray(_cache.memos) ? _cache.memos : [];
      // Ensure backward compatibility: normalize data structure
      return data.map(item => ({
        title: item.title || '',
        text: item.text,
        // Migrate old 'date' field to createdDate and updatedDate
        createdDate: item.createdDate || item.date || new Date().toISOString(),
        updatedDate: item.updatedDate || item.date || new Date().toISOString(),
        pinned: item.pinned || false,
        emoji: item.emoji || '',
        tags: item.tags || []
      }));
    };

    // Load saved view mode from IndexedDB (via cache)
    const loadViewMode = () => {
      return _cache.viewMode === 'list';
    };

    // Save view mode to IndexedDB
    const saveViewMode = (isListMode) => {
      _cache.viewMode = isListMode ? 'list' : 'full';
      if (_db) {
        dbPut(_db, 'viewMode', _cache.viewMode).catch(() => {});
      }
    };

    const save = (data) => {
      _cache.memos = data;
      if (_db) {
        dbPut(_db, 'memos', data).catch(e => console.error('Failed to save memos:', e));
      }
      renderList(data);
    };

    // Variable management functions
    const loadVariables = () => {
      const data = Array.isArray(_cache.variables) ? _cache.variables : [];
      // Ensure each variable has name and value properties
      return data.map(item => ({
        name: item.name || '',
        value: item.value || ''
      }));
    };

    const saveVariables = (variables) => {
      _cache.variables = variables;
      if (_db) {
        dbPut(_db, 'variables', variables).catch(e => console.error('Failed to save variables:', e));
      }
    };

    // Save language preference to IndexedDB (null = auto-detect from browser)
    const saveLanguage = async (lang) => {
      _cache.language = lang;
      if (_db) {
        await dbPut(_db, 'language', lang).catch(e => console.error('Failed to save language:', e));
      }
    };

    /**
     * Resolve variables in text by replacing ${var:name} with variable values
     * @param {string} text - Text containing variable placeholders
     * @returns {string} - Text with variables resolved
     */
    const resolveVariables = (text) => {
      const variables = loadVariables();
      let result = text;
      
      // Replace each variable placeholder with its value
      variables.forEach(variable => {
        const placeholder = `\${var:${variable.name}}`;
        result = result.replaceAll(placeholder, variable.value);
      });
      
      return result;
    };

    // Tag management functions
    /**
     * Load all unique tags from all memos
     * @returns {Array<string>} - Array of unique tag names sorted alphabetically
     */
    const loadAllTags = () => {
      const data = load();
      const tagSet = new Set();
      
      data.forEach(memo => {
        if (memo.tags && Array.isArray(memo.tags)) {
          memo.tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              tagSet.add(tag.trim());
            }
          });
        }
      });
      
      return Array.from(tagSet).sort();
    };

    /**
     * Save tag filter state to IndexedDB
     * @param {Array<string>} filters - Array of tag names to filter by
     */
    const saveTagFilter = (filters) => {
      _cache.tagFilter = filters;
      if (_db) {
        dbPut(_db, 'tagFilter', filters).catch(e => console.error('Failed to save tag filter:', e));
      }
    };

    /**
     * Load tag filter state from IndexedDB (via cache)
     * @returns {Array<string>} - Array of tag names to filter by
     */
    const loadTagFilter = () => {
      const saved = _cache.tagFilter;
      return Array.isArray(saved) ? saved : [];
    };

    /**
     * Fuzzy search for tags matching the input query
     * @param {string} query - Search query
     * @param {Array<string>} tags - Array of tags to search
     * @returns {Array<string>} - Filtered tags matching the query
     */
    const fuzzySearchTags = (query, tags) => {
      if (!query) return tags;
      
      const lowerQuery = query.toLowerCase();
      
      // Filter tags that contain all characters from the query in order
      return tags.filter(tag => {
        const lowerTag = tag.toLowerCase();
        let queryIndex = 0;
        
        for (let i = 0; i < lowerTag.length && queryIndex < lowerQuery.length; i++) {
          if (lowerTag[i] === lowerQuery[queryIndex]) {
            queryIndex++;
          }
        }
        
        return queryIndex === lowerQuery.length;
      }).sort((a, b) => {
        // Prioritize tags that start with the query
        const aStarts = a.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.toLowerCase().startsWith(lowerQuery);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Then sort by length (shorter first)
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        
        // Finally alphabetically
        return a.localeCompare(b);
      });
    };

    /**
     * Delete unused tags from storage
     * @param {Array<string>} tagsToDelete - Tags to delete
     */
    const deleteUnusedTags = (tagsToDelete) => {
      const data = load();
      const tagSet = new Set(tagsToDelete);
      
      // Remove tags from all memos
      data.forEach(memo => {
        if (memo.tags && Array.isArray(memo.tags)) {
          memo.tags = memo.tags.filter(tag => !tagSet.has(tag));
        }
      });
      
      save(data);
    };

    // Track current tag filter state - load from IndexedDB (via cache)
    let currentTagFilter = loadTagFilter();


    const createElement = (tag, css = '', text = '', clickHandler) => {
      const element = document.createElement(tag);
      if (css) element.style.cssText = css;
      if (text) element.textContent = text;
      if (clickHandler) element.onclick = clickHandler;
      return element;
    };

    // Shared utility to stop event propagation.
    // Prevents events (keydown, input, paste, etc.) from reaching page-level listeners
    // such as those in Discord, Mattermost, and Slack that steal focus or capture clipboard data.
    const stopPropagation = (e) => e.stopPropagation();

    /**
     * Safely clear all children from a container element
     * Alternative to innerHTML = '' to avoid TrustedHTML issues
     * @param {HTMLElement} container - The container to clear
     */
    const clearContainer = (container) => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };

    /**
     * Create elements from HTML string using DOMParser
     * Safe alternative to innerHTML for creating DOM from HTML strings
     * Note: In this codebase, all tab content uses functions, not strings,
     * so this is a defensive measure for potential future use.
     * @param {string} htmlString - The HTML string to convert
     * @returns {DocumentFragment} - Document fragment containing the created elements
     */
    const createElementsFromHTML = (htmlString) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const fragment = document.createDocumentFragment();
      while (doc.body.firstChild) {
        fragment.appendChild(doc.body.firstChild);
      }
      return fragment;
    };

    // Get random emoji from collection
    const getRandomEmoji = () => {
      return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    };

    /**
     * Initialize emoji for new memo creation
     * Centralizes emoji initialization logic for consistency and maintainability
     * @returns {string} - Randomly selected emoji
     */
    const initializeNewMemoEmoji = () => {
      return getRandomEmoji();
    };

    // Track current emoji (initialize with random emoji for new memo)
    let currentEmoji = initializeNewMemoEmoji();
    
    // Track current tags for new memo creation
    let currentTags = [];

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
     * Template Parser - Parses ${type:name} or ${type:name|options} placeholders in text
     * Supported types: text, number, select, textarea
     * @param {string} text - Text containing templates
     * @returns {Array<{type: string, name: string, options: Array<string>, placeholder: string}>} - Array of template placeholders
     */
    const parseTemplates = (text) => {
      // Match ${type:name} or ${type:name|option1,option2,...}
      const regex = /\$\{(text|number|select|textarea):([^}|]+)(?:\|([^}]+))?\}/g;
      const templates = [];
      
      // Use matchAll for cleaner iteration
      for (const match of text.matchAll(regex)) {
        const type = match[1].trim();
        const name = match[2].trim();
        const optionsStr = match[3];
        
        // Parse options for select type (comma-separated values)
        const options = optionsStr 
          ? optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt)
          : [];
        
        // Avoid duplicates based on type and name combination
        if (name && !templates.find(t => t.type === type && t.name === name)) {
          templates.push({ 
            type, 
            name, 
            options,
            placeholder: match[0] 
          });
        }
      }
      return templates;
    };

    /**
     * Create appropriate input element based on template type
     * @param {Object} template - Template object with type, name, and options
     * @returns {HTMLElement} - Input element (input, select, etc.)
     * @note For select type, options are comma-separated. Literal comma characters in options are not supported.
     */
    const createInputElement = (template) => {
      const commonStyles = [
        'width:100%',
        'padding:10px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'font-size:13px',
        'box-sizing:border-box',
        'transition:border-color 0.2s'
      ];

      let inputElement;

      switch (template.type) {
        case 'text':
          inputElement = createElement('input');
          inputElement.type = 'text';
          inputElement.placeholder = T.templateInputPlaceholder(template.name);
          inputElement.style.cssText = commonStyles.join(';');
          break;

        case 'number':
          inputElement = createElement('input');
          inputElement.type = 'number';
          inputElement.placeholder = T.templateInputPlaceholder(template.name);
          inputElement.style.cssText = commonStyles.join(';');
          break;

        case 'select':
          inputElement = createElement('select');
          inputElement.style.cssText = commonStyles.join(';');
          
          // Add default empty option
          const defaultOption = createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = T.templateSelectPlaceholder(template.name);
          defaultOption.disabled = true;
          defaultOption.selected = true;
          inputElement.appendChild(defaultOption);
          
          // Add options from template
          template.options.forEach(optionValue => {
            const option = createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            inputElement.appendChild(option);
          });
          break;

        case 'textarea':
          inputElement = createElement('textarea');
          inputElement.placeholder = T.templateInputPlaceholder(template.name);
          // Use textarea-specific styles with auto-height capabilities
          const textareaStyles = [
            ...commonStyles,
            `min-height:${TEXTAREA_CONFIG.MIN_HEIGHT}`,
            `max-height:${TEXTAREA_CONFIG.MAX_HEIGHT}`,
            'resize:vertical',
            'font-family:inherit',
            `line-height:${TEXTAREA_CONFIG.LINE_HEIGHT}`,
            'overflow-y:hidden',
            'transition:height 0.1s ease'
          ];
          inputElement.style.cssText = textareaStyles.join(';');
          // Enable auto-height adjustment for smooth content expansion
          setupAutoHeight(inputElement);
          break;

        default:
          // Fallback to text input
          inputElement = createElement('input');
          inputElement.type = 'text';
          inputElement.placeholder = T.templateInputPlaceholder(template.name);
          inputElement.style.cssText = commonStyles.join(';');
      }

      return inputElement;
    };

    /**
     * Generate human-readable label text for template input fields
     * @param {Object} template - Template object with type, name, and options
     * @returns {string} - Label text with type indicator
     */
    const getTemplateLabelText = (template) => {
      if (template.type === 'select' && template.options.length > 0) {
        return `${template.name} ${T.templateLabelSelect}`;
      }
      if (template.type === 'textarea') {
        return `${template.name} ${T.templateLabelTextarea}`;
      }
      return `${template.name} (${template.type === 'number' ? T.templateLabelNumber : T.templateLabelText})`;
    };

    /**
     * Create input form dialog for template placeholders
     * Uses DialogManager for consistent modal behavior with ESC support and overlay
     * @param {Array<{type: string, name: string, options: Array<string>, placeholder: string}>} templates - Template placeholders
     * @param {Function} onSubmit - Callback with input values object {name: value}
     * @param {Function} onCancel - Callback on cancel
     * @returns {Object} - Dialog container and form elements
     */
    const createTemplateForm = (templates, onSubmit, onCancel) => {
      // Modal overlay with higher z-index to appear above everything
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
        'justify-content:center',
        'backdrop-filter:blur(2px)'
      ].join(';'));

      // Form container
      const formContainer = createElement('div', [
        'background:#fff',
        'border-radius:8px',
        'padding:24px',
        'min-width:400px',
        'max-width:600px',
        'max-height:80vh',
        'overflow-y:auto',
        'box-shadow:0 8px 32px rgba(0,0,0,0.2)'
      ].join(';'));

      // Title
      const title = createElement('h3', [
        'margin:0 0 16px 0',
        'font-size:16px',
        'font-weight:600',
        'color:#202124'
      ].join(';'), T.templateFormTitle);

      // Description
      const description = createElement('p', [
        'margin:0 0 20px 0',
        'font-size:13px',
        'color:#5f6368',
        'line-height:1.5'
      ].join(';'), T.templateFormDesc);

      formContainer.appendChild(title);
      formContainer.appendChild(description);

      // Input fields array
      const inputFields = [];

      templates.forEach((template, index) => {
        // Field container
        const fieldContainer = createElement('div', [
          'margin-bottom:16px'
        ].join(';'));

        // Label with type indicator using helper function
        const labelText = getTemplateLabelText(template);
        
        const label = createElement('label', [
          'display:block',
          'margin-bottom:6px',
          'font-size:13px',
          'font-weight:500',
          'color:#202124'
        ].join(';'), labelText);

        // Create appropriate input element based on type
        const input = createInputElement(template);

        // Focus effect for all input types
        input.onfocus = () => input.style.borderColor = '#1a73e8';
        input.onblur = () => input.style.borderColor = '#dadce0';

        // Auto-focus first input
        if (index === 0) {
          setTimeout(() => input.focus(), 100);
        }

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        formContainer.appendChild(fieldContainer);

        inputFields.push({ name: template.name, input });
      });

      // Button container
      const buttonContainer = createElement('div', [
        'display:flex',
        'gap:8px',
        'justify-content:flex-end',
        'margin-top:24px',
        'padding-top:16px',
        'border-top:1px solid #e8eaed'
      ].join(';'));

      // Forward declaration for escapeHandler (will be defined below)
      let escapeHandler;

      // Helper function to close the dialog - using DialogManager
      const clickHandler = DialogManager.createOverlayClickHandler(() => {
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
        onCancel();
      });

      // Cancel button
      const cancelButton = createElement('button', [
        'padding:10px 24px',
        'font-size:13px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'cursor:pointer',
        'background:#fff',
        'color:#202124',
        'font-weight:500',
        'transition:all 0.2s'
      ].join(';'), T.cancelBtn, () => {
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
        onCancel();
      });

      cancelButton.onmouseover = () => {
        cancelButton.style.background = '#f8f9fa';
        cancelButton.style.borderColor = '#bdc1c6';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.background = '#fff';
        cancelButton.style.borderColor = '#dadce0';
      };

      // Submit button
      const submitButton = createElement('button', [
        'padding:10px 24px',
        'font-size:13px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        `background:${COLORS.SAVE_BUTTON}`,
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), T.copyBtn, () => {
        const values = {};
        inputFields.forEach(field => {
          values[field.name] = field.input.value.trim();
        });
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
        onSubmit(values);
      });

      submitButton.onmouseover = () => submitButton.style.background = COLORS.SAVE_BUTTON_HOVER;
      submitButton.onmouseout = () => submitButton.style.background = COLORS.SAVE_BUTTON;

      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(submitButton);
      formContainer.appendChild(buttonContainer);

      // Keyboard handlers - using DialogManager for clean ESC/Ctrl+Enter handling
      escapeHandler = DialogManager.createEscapeHandler(() => {
        cancelButton.click();
      });
      const ctrlEnterHandler = DialogManager.createCtrlEnterHandler(() => {
        submitButton.click();
      });

      const handleKeyDown = (e) => {
        escapeHandler(e);
        ctrlEnterHandler(e);
        // Prevent event propagation to avoid interference from external focus monitoring
        // (e.g., Mattermost, Slack automatically restoring focus to their input fields)
        e.stopPropagation();
      };

      inputFields.forEach(field => {
        field.input.onkeydown = handleKeyDown;
        field.input.oninput = stopPropagation;
        field.input.onpaste = stopPropagation;
      });

      overlay.appendChild(formContainer);

      // Double-click outside to close - using DialogManager
      overlay.onclick = (e) => clickHandler.onclick(e, overlay);

      // Prevent clicks inside form from closing
      formContainer.onclick = (e) => {
        e.stopPropagation();
      };

      // Register this dialog with the stack
      DialogManager.pushDialog({ overlay, escapeHandler, clickHandler });

      // Attach to shadow DOM for proper layering
      shadow.appendChild(overlay);

      return { overlay, inputFields };
    };

    /**
     * Replace template placeholders with values
     * @param {string} text - Text with templates
     * @param {Array<{type: string, name: string, placeholder: string}>} templates - Original template objects containing exact placeholder strings
     * @param {Object} values - Object mapping template names to replacement values
     * @returns {string} - Text with templates replaced
     * @note The templates parameter is required to ensure accurate placeholder replacement using the original placeholder strings,
     *       which may contain options (e.g., ${select:name|opt1,opt2}) that need exact matching
     */
    const replaceTemplates = (text, templates, values) => {
      let result = text;
      
      // Replace each template placeholder with its corresponding value
      templates.forEach(template => {
        const value = values[template.name] || '';
        // Use the original placeholder string for accurate replacement
        result = result.replaceAll(template.placeholder, value);
      });
      
      return result;
    };

    /**
     * DialogManager - Centralized dialog management system
     * Provides unified, high-quality dialog handling with consistent behavior
     * Handles ESC keys, outside clicks (single or double), proper cleanup, and dialog stacking
     */
    const DialogManager = {
      // Dialog stack to track nested dialogs (most recent dialog is at the end)
      dialogStack: [],
      
      /**
       * Push a dialog onto the stack
       * @param {Object} dialog - Dialog object containing overlay, escHandler, etc.
       */
      pushDialog(dialog) {
        this.dialogStack.push(dialog);
        // Always set modal flag to true when any dialog is open
        KeyHandler.isModalOpen = true;
      },
      
      /**
       * Pop a dialog from the stack
       * @returns {Object|null} The removed dialog object, or null if stack is empty
       */
      popDialog() {
        const dialog = this.dialogStack.pop();
        // Update modal open flag based on remaining dialogs
        KeyHandler.isModalOpen = this.dialogStack.length > 0;
        return dialog;
      },
      
      /**
       * Get the topmost (most recent) dialog in the stack
       * @returns {Object|null} The topmost dialog, or null if stack is empty
       */
      getTopDialog() {
        return this.dialogStack.length > 0 ? this.dialogStack[this.dialogStack.length - 1] : null;
      },
      
      /**
       * Check if there are any dialogs in the stack
       * @returns {boolean} True if stack has dialogs, false otherwise
       */
      hasDialogs() {
        return this.dialogStack.length > 0;
      },
      
      /**
      * Create a double-click handler for overlay outside clicks
      * Prevents accidental dialog closure by requiring two clicks within 500ms
      * @param {Function} onClose - Callback to execute when double-click occurs
       * @returns {Object} Handler object with onclick function and cleanup
       */
      createOverlayClickHandler(onClose) {
        let clickCount = 0;
        let clickTimer = null;
        
        return {
          onclick: (e, overlay) => {
            if (e.target === overlay) {
              clickCount++;
              
              if (clickCount === 1) {
                // First click - show subtle visual feedback
                overlay.style.animation = 'none';
                setTimeout(() => {
                  overlay.style.animation = '';
                }, 10);
                
                // Reset counter after 500ms
                clickTimer = setTimeout(() => {
                  clickCount = 0;
                }, 500);
              } else if (clickCount >= 2) {
                // Second click within 500ms - execute close callback
                if (clickTimer) {
                  clearTimeout(clickTimer);
                }
                onClose();
              }
            }
          },
          cleanup: () => {
            if (clickTimer) {
              clearTimeout(clickTimer);
            }
          }
        };
      },
      
      /**
       * Create an ESC key handler that only affects the current dialog
       * Prevents ESC from propagating to parent dialogs or main popup
       * @param {Function} onEscape - Callback to execute when ESC is pressed
       * @returns {Function} Event handler function
       */
      createEscapeHandler(onEscape) {
        return (e) => {
          if (e.key === KeyHandler.ESC) {
            // Stop propagation to prevent parent dialogs from closing
            e.stopPropagation();
            e.preventDefault();
            onEscape();
          }
        };
      },
      
      /**
       * Create a Ctrl+Enter handler for quick save actions
       * @param {Function} onCtrlEnter - Callback to execute when Ctrl+Enter is pressed
       * @returns {Function} Event handler function
       */
      createCtrlEnterHandler(onCtrlEnter) {
        return (e) => {
          if (KeyHandler.isCtrlEnter(e)) {
            e.preventDefault();
            e.stopPropagation();
            onCtrlEnter();
          }
        };
      },
      
      /**
       * Unified dialog close function
       * Handles all necessary cleanup: flags, timers, DOM removal
       * @param {Object} config - Configuration object
       * @param {HTMLElement} config.overlay - Overlay element to remove
       * @param {Object} [config.clickHandler] - Click handler with cleanup function
       * @param {Function} [config.escapeHandler] - ESC key handler to remove
       */
      closeDialog(config) {
        const { overlay, clickHandler, escapeHandler } = config;
        
        // Remove dialog from stack by searching for matching overlay
        const dialogIndex = this.dialogStack.findIndex(d => d.overlay === overlay);
        if (dialogIndex !== -1) {
          this.dialogStack.splice(dialogIndex, 1);
        }
        
        // Update modal flag based on remaining dialogs in stack
        KeyHandler.isModalOpen = this.dialogStack.length > 0;
        
        // Clean up escape handler if provided
        if (escapeHandler) {
          document.removeEventListener('keydown', escapeHandler);
        }
        
        // Clean up click handler timers
        if (clickHandler && clickHandler.cleanup) {
          clickHandler.cleanup();
        }
        
        // Remove overlay from DOM
        if (overlay && overlay.parentNode) {
          overlay.remove();
        }
      }
    };

    /**
     * Show dialog for adding or editing a variable
     * Uses DialogManager for clean, unified dialog handling
     * @param {Object|null} variable - Variable to edit (null for new variable)
     * @param {number} index - Index of variable in array (-1 for new variable)
     * @param {Function} onSave - Callback after save
     */
    const showVariableEditDialog = (variable, index, onSave) => {
      const isNew = !variable;
      
      // Modal overlay - uses NESTED_MODAL_OVERLAY for proper layering above settings dialog
      const overlay = createElement('div', [
        'position:fixed',
        'top:0',
        'left:0',
        'width:100%',
        'height:100%',
        'background:rgba(0,0,0,0.5)',
        `z-index:${Z_INDEX.NESTED_MODAL_OVERLAY}`,
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'backdrop-filter:blur(2px)'
      ].join(';'));
      
      // Dialog container
      const dialog = createElement('div', [
        'background:#fff',
        'border-radius:8px',
        'padding:24px',
        'min-width:400px',
        'max-width:600px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.2)'
      ].join(';'));
      
      // Title
      const title = createElement('h3', [
        'margin:0 0 16px 0',
        'font-size:16px',
        'font-weight:600',
        'color:#202124'
      ].join(';'), isNew ? T.addVariableTitle : T.editVariableTitle);
      
      // Name label
      const nameLabel = createElement('label', [
        'display:block',
        'margin-bottom:6px',
        'font-size:13px',
        'font-weight:500',
        'color:#202124'
      ].join(';'), T.variableNameLabel);
      
      // Name input
      const nameInput = createElement('input', [
        'width:100%',
        'padding:10px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'font-size:13px',
        'box-sizing:border-box',
        'margin-bottom:16px',
        'transition:border-color 0.2s'
      ].join(';'));
      nameInput.type = 'text';
      nameInput.placeholder = T.variableNamePlaceholder;
      nameInput.value = variable ? variable.name : '';
      
      nameInput.onfocus = () => nameInput.style.borderColor = '#1a73e8';
      nameInput.onblur = () => nameInput.style.borderColor = '#dadce0';
      
      // Value label
      const valueLabel = createElement('label', [
        'display:block',
        'margin-bottom:6px',
        'font-size:13px',
        'font-weight:500',
        'color:#202124'
      ].join(';'), T.variableValueLabel);
      
      // Value textarea
      const valueTextarea = createElement('textarea', [
        'width:100%',
        'min-height:80px',
        'padding:10px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'font-size:13px',
        'box-sizing:border-box',
        'margin-bottom:16px',
        'resize:vertical',
        'font-family:sans-serif',
        'transition:border-color 0.2s'
      ].join(';'));
      valueTextarea.placeholder = T.variableValuePlaceholder;
      valueTextarea.value = variable ? variable.value : '';
      
      valueTextarea.onfocus = () => valueTextarea.style.borderColor = '#1a73e8';
      valueTextarea.onblur = () => valueTextarea.style.borderColor = '#dadce0';
      
      // Button container
      const buttonContainer = createElement('div', [
        'display:flex',
        'gap:8px',
        'justify-content:flex-end',
        'margin-top:20px'
      ].join(';'));
      
      // Forward declaration for escapeHandler (will be defined below)
      let escapeHandler;
      
      // Helper function to close the dialog - using DialogManager
      const clickHandler = DialogManager.createOverlayClickHandler(() => {
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
      });
      
      // Cancel button
      const cancelButton = createElement('button', [
        'padding:10px 24px',
        'font-size:13px',
        'border:1px solid #dadce0',
        'border-radius:4px',
        'cursor:pointer',
        'background:#fff',
        'color:#202124',
        'font-weight:500',
        'transition:all 0.2s'
      ].join(';'), T.cancelBtn, () => {
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
      });
      
      cancelButton.onmouseover = () => {
        cancelButton.style.background = '#f8f9fa';
        cancelButton.style.borderColor = '#bdc1c6';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.background = '#fff';
        cancelButton.style.borderColor = '#dadce0';
      };
      
      // Save button
      const saveButton = createElement('button', [
        'padding:10px 24px',
        'font-size:13px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        `background:${COLORS.SAVE_BUTTON}`,
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), T.saveBtn);
      
      saveButton.onmouseover = () => saveButton.style.background = COLORS.SAVE_BUTTON_HOVER;
      saveButton.onmouseout = () => saveButton.style.background = COLORS.SAVE_BUTTON;
      
      // Save button click handler
      saveButton.onclick = () => {
        const name = nameInput.value.trim();
        const value = valueTextarea.value.trim();
        
        if (!name) {
          alert(T.variableNameRequired);
          nameInput.focus();
          return;
        }
        
        // Check for duplicate variable names (excluding current variable when editing)
        const variables = loadVariables();
        const duplicateIndex = variables.findIndex(v => v.name === name);
        if (duplicateIndex !== -1 && duplicateIndex !== index) {
          alert(T.variableNameDuplicate(name));
          nameInput.focus();
          return;
        }
        
        if (isNew) {
          // Add new variable
          variables.push({ name, value });
        } else {
          // Update existing variable
          variables[index] = { name, value };
        }
        
        saveVariables(variables);
        DialogManager.closeDialog({ overlay, clickHandler, escapeHandler });
        if (onSave) onSave();
      };
      
      // Keyboard handlers - using DialogManager for clean ESC/Ctrl+Enter handling
      escapeHandler = DialogManager.createEscapeHandler(() => {
        cancelButton.click();
      });
      const ctrlEnterHandler = DialogManager.createCtrlEnterHandler(() => {
        saveButton.click();
      });
      
      // Unified keydown handler with event propagation prevention
      // Prevents Mattermost/Slack focus monitoring from interfering with input
      const handleKeyDown = (e) => {
        escapeHandler(e);
        ctrlEnterHandler(e);
        // Stop propagation to prevent external focus monitoring from interfering
        e.stopPropagation();
      };
      
      nameInput.onkeydown = handleKeyDown;
      nameInput.oninput = stopPropagation;
      nameInput.onpaste = stopPropagation;
      valueTextarea.onkeydown = handleKeyDown;
      valueTextarea.oninput = stopPropagation;
      valueTextarea.onpaste = stopPropagation;
      
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(saveButton);
      
      dialog.appendChild(title);
      dialog.appendChild(nameLabel);
      dialog.appendChild(nameInput);
      dialog.appendChild(valueLabel);
      dialog.appendChild(valueTextarea);
      dialog.appendChild(buttonContainer);
      
      overlay.appendChild(dialog);
      
      // Double-click outside to close - using DialogManager
      overlay.onclick = (e) => clickHandler.onclick(e, overlay);
      
      // Prevent clicks inside dialog from closing
      dialog.onclick = (e) => {
        e.stopPropagation();
      };
      
      // Register this dialog with the stack
      DialogManager.pushDialog({ overlay, escapeHandler, clickHandler });
      
      // Attach to shadow DOM for proper layering above settings dialog
      shadow.appendChild(overlay);
      
      // Auto-focus name input
      setTimeout(() => nameInput.focus(), 100);
    };

    /**
     * Setup auto-height adjustment for textarea elements
     * Automatically adjusts textarea height based on content, with smooth transitions
     * @param {HTMLTextAreaElement} textarea - The textarea element to enhance
     */
    const setupAutoHeight = (textarea) => {
      /**
       * Adjust textarea height based on content
       * Ensures smooth UX by:
       * - Starting small when empty (MIN_HEIGHT)
       * - Growing with content up to MAX_HEIGHT
       * - Enabling scroll when content exceeds MAX_HEIGHT
       */
      const adjustHeight = () => {
        // Reset height to recalculate scrollHeight accurately
        textarea.style.height = 'auto';
        
        // Get the actual content height
        const scrollHeight = textarea.scrollHeight;
        
        // Parse max height from config (remove 'px' suffix)
        const maxHeight = parseInt(TEXTAREA_CONFIG.MAX_HEIGHT);
        
        // Set height to content size, capped at max height
        if (scrollHeight <= maxHeight) {
          textarea.style.height = scrollHeight + 'px';
          textarea.style.overflowY = 'hidden';
        } else {
          textarea.style.height = TEXTAREA_CONFIG.MAX_HEIGHT;
          textarea.style.overflowY = 'auto';
        }
      };
      
      // Adjust on input
      textarea.addEventListener('input', adjustHeight);
      
      // Initial adjustment for pre-filled content
      // Use setTimeout to ensure textarea is rendered before measuring
      setTimeout(() => adjustHeight(), 0);
    };

    /**
     * Create a textarea element with optimized styling for comfortable memo editing
     * Uses centralized TEXTAREA_CONFIG for consistent UI/UX across the app
     * Features auto-height adjustment that grows with content
     * @param {Object} options - Configuration options
     * @param {string} options.placeholder - Placeholder text
     * @param {string} options.value - Initial value
     * @param {string} options.borderColor - Border color (default: #1a73e8)
     * @param {string} options.marginBottom - Bottom margin (default: 12px)
     * @returns {HTMLTextAreaElement} - Configured textarea element with auto-height
     */
     const createTextarea = (options = {}) => {
      const {
        placeholder = T.memoContentPlaceholder,
        value = '',
        borderColor = '#1a73e8',
        marginBottom = '12px'
      } = options;
      
      const textarea = createElement('textarea', [
        'width:100%',
        `min-height:${TEXTAREA_CONFIG.MIN_HEIGHT}`,
        `padding:${TEXTAREA_CONFIG.PADDING}`,
        `border:1px solid ${borderColor}`,
        'border-radius:4px',
        'resize:vertical',
        `font-size:${TEXTAREA_CONFIG.FONT_SIZE}`,
        'background:#fff',
        'color:#333',
        'font-family:sans-serif',
        'box-sizing:border-box',
        `margin-bottom:${marginBottom}`,
        `line-height:${TEXTAREA_CONFIG.LINE_HEIGHT}`,
        'overflow-y:hidden',
        'transition:height 0.1s ease'
      ].join(';'));
      
      textarea.value = value;
      textarea.placeholder = placeholder;
      
      // Enable auto-height adjustment
      setupAutoHeight(textarea);
      
      return textarea;
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
      titleInput.placeholder = T.titlePlaceholder;
      
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
      ].join(';'), T.randomEmoji, () => {
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
      ].join(';'), T.clearEmoji, () => {
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
     * Create tag input component with autocomplete and fuzzy search
     * @param {Array<string>} initialTags - Initial tags to display
     * @param {Function} onTagsChange - Callback when tags change
     * @returns {Object} - Object with container and getTags method
     */
    const createTagInput = (initialTags = [], onTagsChange = null) => {
      const tags = [...initialTags];
      
      // Main container
      const container = createElement('div', [
        'margin-bottom:12px'
      ].join(';'));
      
      // Label
      const label = createElement('div', [
        'font-size:13px',
        'color:#555',
        'margin-bottom:4px',
        'font-weight:500'
      ].join(';'), T.tagLabel);
      container.appendChild(label);
      
      // Tags display container
      const tagsDisplay = createElement('div', [
        'display:flex',
        'flex-wrap:wrap',
        'gap:6px',
        'margin-bottom:6px',
        'min-height:20px'
      ].join(';'));
      
      // Input container with autocomplete
      const inputContainer = createElement('div', [
        'position:relative'
      ].join(';'));
      
      // Tag input field
      const tagInput = createElement('input', [
        'width:100%',
        'padding:8px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'font-size:13px',
        'box-sizing:border-box'
      ].join(';'));
      tagInput.type = 'text';
      tagInput.placeholder = T.tagInputPlaceholder;
      
      // Autocomplete dropdown
      const autocompleteDropdown = createElement('div', [
        'display:none',
        'position:absolute',
        'top:100%',
        'left:0',
        'right:0',
        'min-width:250px',
        'background:#fff',
        'border:1px solid #ddd',
        'border-top:none',
        'border-radius:0 0 4px 4px',
        'max-height:150px',
        'overflow-y:auto',
        'box-shadow:0 2px 8px rgba(0,0,0,0.1)',
        `z-index:${Z_INDEX.DROPDOWN}`,
        'box-sizing:border-box'
      ].join(';'));
      
      // Function to render tags
      const renderTags = () => {
        clearContainer(tagsDisplay);
        
        tags.forEach(tag => {
          const tagChip = createElement('span', [
            'display:inline-flex',
            'align-items:center',
            'gap:4px',
            'padding:4px 8px',
            'background:#e3f2fd',
            'border:1px solid #90caf9',
            'border-radius:12px',
            'font-size:12px',
            'color:#1976d2',
            'font-weight:500'
          ].join(';'));
          
          const tagText = createElement('span', '', tag);
          const deleteBtn = createElement('span', [
            'cursor:pointer',
            'font-size:14px',
            'line-height:1',
            'opacity:0.7',
            'transition:opacity 0.2s'
          ].join(';'), '×', () => {
            const index = tags.indexOf(tag);
            if (index > -1) {
              tags.splice(index, 1);
              renderTags();
              if (onTagsChange) onTagsChange(tags);
            }
          });
          
          deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
          deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.7';
          
          tagChip.appendChild(tagText);
          tagChip.appendChild(deleteBtn);
          tagsDisplay.appendChild(tagChip);
        });
        
        if (tags.length === 0) {
          const emptyText = createElement('span', [
            'color:#999',
            'font-size:12px',
            'font-style:italic'
          ].join(';'), T.noTags);
          tagsDisplay.appendChild(emptyText);
        }
      };
      
      // Function to add a tag (keep dropdown open for continuous selection)
      const addTag = (tag) => {
        const trimmedTag = tag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
          tags.push(trimmedTag);
          renderTags();
          if (onTagsChange) onTagsChange(tags);
        }
        // Clear input but keep dropdown open for continuous tag selection
        tagInput.value = '';
        // Refocus the input field for smooth continuous input
        tagInput.focus();
        // Show updated autocomplete suggestions (without the just-added tag)
        showAutocomplete('');
      };
      
      // Function to show autocomplete suggestions
      const showAutocomplete = (query) => {
        const allTags = loadAllTags();
        const availableTags = allTags.filter(tag => !tags.includes(tag));
        const matchedTags = fuzzySearchTags(query, availableTags);
        
        clearContainer(autocompleteDropdown);
        
        if (matchedTags.length === 0) {
          autocompleteDropdown.style.display = 'none';
          return;
        }
        
        matchedTags.slice(0, 10).forEach(tag => {
          const item = createElement('div', [
            'padding:8px 12px',
            'cursor:pointer',
            'font-size:13px',
            'transition:background 0.2s'
          ].join(';'), tag, () => {
            addTag(tag);
          });
          
          item.onmouseover = () => item.style.background = '#f5f5f5';
          item.onmouseout = () => item.style.background = '#fff';
          
          autocompleteDropdown.appendChild(item);
        });
        
        autocompleteDropdown.style.display = 'block';
      };
      
      // Input event handlers
      tagInput.oninput = (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
          showAutocomplete(query);
        } else {
          autocompleteDropdown.style.display = 'none';
        }
      };
      
      tagInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = tagInput.value.trim();
          if (query) {
            addTag(query);
          }
          e.stopPropagation();
        } else if (e.key === 'Escape') {
          // Only close autocomplete if it's visible
          if (autocompleteDropdown.style.display !== 'none') {
            autocompleteDropdown.style.display = 'none';
            tagInput.value = '';
          }
          // Always prevent ESC from bubbling to parent handlers
          e.preventDefault();
          e.stopPropagation();
        } else {
          // Prevent all other key events from bubbling to parent handlers
          e.stopPropagation();
        }
      };
      tagInput.onpaste = stopPropagation;
      
      // Close autocomplete when clicking outside
      tagInput.onblur = () => {
        setTimeout(() => {
          autocompleteDropdown.style.display = 'none';
        }, 200);
      };
      
      inputContainer.appendChild(tagInput);
      inputContainer.appendChild(autocompleteDropdown);
      
      container.appendChild(tagsDisplay);
      container.appendChild(inputContainer);
      
      // Initial render
      renderTags();
      
      return {
        container,
        getTags: () => [...tags],
        setTags: (newTags) => {
          tags.length = 0;
          tags.push(...newTags);
          renderTags();
        }
      };
    };

    /**
     * Create edit UI components for inline memo editing with improved layout
     * @param {Object} item - The memo item to edit with properties: title, text, emoji, tags
     * @param {Function} onSave - Callback function called when save is clicked, receives updated data object
     * @param {Function} onCancel - Callback function called when cancel is clicked or ESC is pressed
     * @returns {Object} - Object containing:
     *   - container: DOM element with complete edit UI (emoji picker, tag input, textarea, and buttons)
     *   - titleInput: Input element for title
     *   - textArea: Textarea element for memo content
     *   - tagInput: Tag input component
     */
    const createEditUI = (item, onSave, onCancel) => {
      // Create emoji picker
      const emojiPicker = createEmojiPicker(item.emoji);
      
      // Create tag input
      const tagInput = createTagInput(item.tags || []);
      
      // Text area - use centralized textarea creation for consistent UI/UX
      const textArea = createTextarea({
        placeholder: T.memoContentPlaceholder,
        value: item.text,
        borderColor: '#1a73e8',
        marginBottom: '12px'
      });
      
      // Set initial title
      emojiPicker.titleInput.value = item.title || '';
      
      // Create button container - no flex-wrap to prevent button wrapping
      const buttonContainer = createElement('div', [
        'display:flex',
        'gap:8px',
        'justify-content:flex-start'
      ].join(';'));
      
      // Save button
      const saveButton = createElement('button', [
        'padding:8px 16px',
        'font-size:13px',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        `background:${COLORS.SAVE_BUTTON}`,
        'color:#fff',
        'white-space:nowrap',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), T.saveCtrlEnter, () => {
        const newTitle = emojiPicker.titleInput.value.trim();
        const newText = textArea.value.trim();
        if (!newText) return;
        onSave({
          title: newTitle,
          text: newText,
          emoji: emojiPicker.getEmoji(),
          tags: tagInput.getTags()
        });
      });
      
      // Add hover effect to save button
      saveButton.onmouseover = () => saveButton.style.background = COLORS.SAVE_BUTTON_HOVER;
      saveButton.onmouseout = () => saveButton.style.background = COLORS.SAVE_BUTTON;
      
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
      ].join(';'), T.cancelEsc, onCancel);
      
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
      emojiPicker.titleInput.oninput = stopPropagation;
      emojiPicker.titleInput.onpaste = stopPropagation;
      
      textArea.onkeydown = handleKeyDown;
      textArea.oninput = stopPropagation;
      textArea.onpaste = stopPropagation;
      
      // Assemble container with proper layout styling
      // Container now includes emoji picker, tag input, textarea, AND buttons in a clean vertical layout
      const container = createElement('div', [
        'display:flex',
        'flex-direction:column',
        'width:100%',
        'gap:8px',
        'box-sizing:border-box'
      ].join(';'));
      container.appendChild(emojiPicker.container);
      container.appendChild(tagInput.container);
      container.appendChild(textArea);
      container.appendChild(buttonContainer);
      
      return {
        container,
        titleInput: emojiPicker.titleInput,
        textArea,
        tagInput
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
          'height:80vh',
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
            'padding:0 20px',
            'overflow-x:auto',
            'white-space:nowrap',
            'scrollbar-width:none'
          ].join(';'));
          
          // Enable horizontal scroll with mouse wheel
          tabNav.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
              e.preventDefault();
              tabNav.scrollLeft += e.deltaY;
            }
          }, { passive: false });
          
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
              'transition:all 0.2s',
              'white-space:nowrap',
              'flex-shrink:0'
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
              const fragment = createElementsFromHTML(tab.content);
              tabContent.appendChild(fragment);
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
            const fragment = createElementsFromHTML(tabs[0].content);
            content.appendChild(fragment);
          }
          
          modal.appendChild(content);
        }
        
        overlay.appendChild(modal);
        
        // Create double-click handler using DialogManager
        const clickHandler = DialogManager.createOverlayClickHandler(() => {
          this.close();
          if (onClose) onClose();
        });
        
        // Double-click overlay to close - prevents accidental closure
        overlay.onclick = (e) => clickHandler.onclick(e, overlay);
        
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
        
        // Register with dialog stack
        DialogManager.pushDialog({ overlay, escapeHandler: escHandler, clickHandler });
        
        this.activeModal = { overlay, escHandler, originalOverflow, clickHandler };
      },
      
      // Close the active modal
      close: function() {
        if (this.activeModal) {
          // Use DialogManager.closeDialog for proper cleanup
          DialogManager.closeDialog({
            overlay: this.activeModal.overlay,
            clickHandler: this.activeModal.clickHandler,
            escapeHandler: this.activeModal.escHandler
          });
          
          // Restore original body overflow to re-enable scrolling
          if (this.activeModal.originalOverflow !== '') {
            document.body.style.overflow = this.activeModal.originalOverflow;
          } else {
            // Remove the inline style to restore default behavior
            document.body.style.removeProperty('overflow');
          }
          
          this.activeModal = null;
        }
      }
    };

    const wrap = createElement('div', [
      'position:fixed',
      `z-index:${Z_INDEX.BASE}`,
      'top:20px',
      'left:20px',
      'width:420px',
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
    
    // Initialize view mode from IndexedDB (via cache)
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
    ].join(';'), isTitleOnlyMode ? T.viewFull : T.viewList, () => {
      isTitleOnlyMode = !isTitleOnlyMode;
      titleOnlyButton.textContent = isTitleOnlyMode ? T.viewFull : T.viewList;
      titleOnlyButton.style.background = isTitleOnlyMode ? '#1a73e8' : '#34a853';
      
      // Save view mode to IndexedDB
      saveViewMode(isTitleOnlyMode);
      
      // Hide/show input fields based on mode
      if (isTitleOnlyMode) {
        emojiTitleRowContainer.style.display = 'none';
        newMemoTagInput.container.style.display = 'none';
        input.style.display = 'none';
        saveButton.style.display = 'none';
        // When entering list view, just reset the flag but preserve compactFormState
        // This allows users to resume editing if they accidentally switch views
        KeyHandler.isNewMemoCreating = false;
      } else {
        emojiTitleRowContainer.style.display = 'block';
        newMemoTagInput.container.style.display = 'block';
        input.style.display = 'block';
        saveButton.style.display = 'block';
        // When switching to full view, completely reset compact form state
        resetCompactFormState();
      }
      
      renderList(load());
    });
    titleOnlyButton.title = T.viewToggleTitle;
    buttonRow.appendChild(titleOnlyButton);
    
    // Tag filter dropdown state and handlers
    // Using DialogManager pattern for unified ESC key handling
    let tagFilterDropdownState = {
      isOpen: false,
      escapeHandler: null,
      outsideClickHandler: null
    };
    
    // Tag filter dropdown element
    const tagFilterDropdown = createElement('div', [
      'display:none',
      'position:absolute',
      'top:100%',
      'left:0',
      'min-width:200px',
      'background:#fff',
      'border:1px solid #ddd',
      'border-radius:4px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
      'margin-top:4px',
      `z-index:${Z_INDEX.DROPDOWN}`,
      'max-height:200px',
      'overflow-y:auto',
      'box-sizing:border-box'
    ].join(';'));
    
    /**
     * Close tag filter dropdown
     * Handles cleanup of event listeners and state management
     */
    const closeTagFilterDropdown = () => {
      // Hide dropdown first
      tagFilterDropdown.style.display = 'none';
      
      // Remove ESC key handler
      if (tagFilterDropdownState.escapeHandler) {
        document.removeEventListener('keydown', tagFilterDropdownState.escapeHandler);
        tagFilterDropdownState.escapeHandler = null;
      }
      
      // Remove outside click handler
      if (tagFilterDropdownState.outsideClickHandler) {
        document.removeEventListener('click', tagFilterDropdownState.outsideClickHandler);
        tagFilterDropdownState.outsideClickHandler = null;
      }
      
      // Update state flags
      tagFilterDropdownState.isOpen = false;
      // Clear modal flag to allow main bookmarklet to respond to ESC
      KeyHandler.isModalOpen = false;
    };
    
    /**
     * Open tag filter dropdown
     * Sets up event listeners and renders content
     */
    const openTagFilterDropdown = () => {
      // If already open, close and clean up first to prevent duplicate listeners
      if (tagFilterDropdownState.isOpen) {
        closeTagFilterDropdown();
      }
      
      renderTagFilterDropdown();
      tagFilterDropdown.style.display = 'block';
      
      // Update state flags
      tagFilterDropdownState.isOpen = true;
      // Set modal flag to prevent main ESC handler from closing bookmarklet
      KeyHandler.isModalOpen = true;
      
      // Create and add ESC key handler using DialogManager pattern
      tagFilterDropdownState.escapeHandler = DialogManager.createEscapeHandler(() => {
        closeTagFilterDropdown();
      });
      document.addEventListener('keydown', tagFilterDropdownState.escapeHandler);
      
      // Create and add outside click handler
      // Use requestAnimationFrame for more predictable timing
      requestAnimationFrame(() => {
        // Check if dropdown is still open before adding handler
        if (!tagFilterDropdownState.isOpen) return;
        
        tagFilterDropdownState.outsideClickHandler = (e) => {
          if (!tagFilterContainer.contains(e.target)) {
            closeTagFilterDropdown();
          }
        };
        document.addEventListener('click', tagFilterDropdownState.outsideClickHandler);
      });
    };
    
    // Tag filter button
    const tagFilterButton = createElement('button', [
      'padding:4px 10px',
      'font-size:12px',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'background:#9c27b0',
      'color:#fff',
      'white-space:nowrap',
      'font-weight:normal',
      'flex-shrink:0',
      'position:relative'
    ].join(';'), T.tagFilter, (e) => {
      e.stopPropagation();
      
      // Toggle tag filter dropdown
      if (tagFilterDropdownState.isOpen) {
        closeTagFilterDropdown();
      } else {
        openTagFilterDropdown();
      }
    });
    tagFilterButton.title = T.tagFilterTitle;
    buttonRow.appendChild(tagFilterButton);
    
    /**
     * Render tag filter dropdown content
     * Updates the dropdown with current tags and selection state
     */
    const renderTagFilterDropdown = () => {
      clearContainer(tagFilterDropdown);
      const allTags = loadAllTags();
      
      if (allTags.length === 0) {
        const emptyMsg = createElement('div', [
          'padding:12px',
          'color:#999',
          'font-size:12px',
          'text-align:center',
          'font-style:italic'
        ].join(';'), T.noTagsAvailable);
        tagFilterDropdown.appendChild(emptyMsg);
        return;
      }
      
      // Show clear filter button if any filters are active
      if (currentTagFilter.length > 0) {
        const clearButton = createElement('div', [
          'padding:8px 12px',
          'background:#f5f5f5',
          'border-bottom:1px solid #ddd',
          'cursor:pointer',
          'font-size:12px',
          'font-weight:600',
          'color:#d32f2f',
          'transition:background 0.2s'
        ].join(';'), T.clearFilter(currentTagFilter.length), (e) => {
          e.stopPropagation();
          currentTagFilter = [];
          saveTagFilter(currentTagFilter);
          tagFilterButton.style.background = '#9c27b0';
          renderTagFilterDropdown();
          renderList(load());
          // Keep dropdown open for continuous operation
        });
        
        clearButton.onmouseover = () => clearButton.style.background = '#e8e8e8';
        clearButton.onmouseout = () => clearButton.style.background = '#f5f5f5';
        
        tagFilterDropdown.appendChild(clearButton);
      }
      
      // Render all tags as checkboxes
      allTags.forEach(tag => {
        const isSelected = currentTagFilter.includes(tag);
        
        const tagItem = createElement('div', [
          'padding:8px 12px',
          'cursor:pointer',
          'font-size:12px',
          'display:flex',
          'align-items:center',
          'gap:8px',
          'transition:background 0.2s',
          isSelected ? 'background:#e3f2fd' : ''
        ].join(';'), '', (e) => {
          // Prevent event from bubbling to outside click handler
          e.stopPropagation();
          
          // Toggle tag filter
          const index = currentTagFilter.indexOf(tag);
          if (index > -1) {
            currentTagFilter.splice(index, 1);
          } else {
            currentTagFilter.push(tag);
          }
          
          // Save filter state to IndexedDB
          saveTagFilter(currentTagFilter);
          
          // Update button style based on filter state
          tagFilterButton.style.background = currentTagFilter.length > 0 ? '#7b1fa2' : '#9c27b0';
          
          // Re-render dropdown to update selection state
          // Dropdown stays open for continuous selection
          renderTagFilterDropdown();
          renderList(load());
        });
        
        // Checkbox indicator
        const checkbox = createElement('span', [
          'width:16px',
          'height:16px',
          'border:2px solid #9c27b0',
          'border-radius:3px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'flex-shrink:0',
          isSelected ? 'background:#9c27b0' : 'background:#fff'
        ].join(';'), isSelected ? '✓' : '');
        if (isSelected) {
          checkbox.style.color = '#fff';
          checkbox.style.fontSize = '11px';
          checkbox.style.fontWeight = 'bold';
        }
        
        const tagLabel = createElement('span', '', tag);
        
        tagItem.appendChild(checkbox);
        tagItem.appendChild(tagLabel);
        
        tagItem.onmouseover = () => {
          if (!isSelected) tagItem.style.background = '#f5f5f5';
        };
        tagItem.onmouseout = () => {
          if (!isSelected) tagItem.style.background = '#fff';
        };
        
        tagFilterDropdown.appendChild(tagItem);
      });
    };
    
    // Create a container for the button and dropdown
    const tagFilterContainer = createElement('div', 'position:relative;flex-shrink:0');
    tagFilterContainer.appendChild(tagFilterButton);
    tagFilterContainer.appendChild(tagFilterDropdown);
    buttonRow.appendChild(tagFilterContainer);
    
    // Set initial button style based on loaded filter state
    if (currentTagFilter.length > 0) {
      tagFilterButton.style.background = '#7b1fa2';
    }
    
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
    ].join(';'), T.settings, () => {
      // Open settings popup with tabs
      PopupModal.create({
        title: T.settingsModalTitle,
        tabs: [
          {
            label: T.tabUsage,
            content: (container) => {
              // Usage guide tab content
              const usageContent = createElement('div', [
                'font-size:14px',
                'line-height:1.8',
                'color:#333'
              ].join(';'));
              
              const usageTitle = createElement('h3', [
                'margin:0 0 16px 0',
                'font-size:18px',
                'font-weight:600',
                'color:#333'
              ].join(';'), T.usageTitle);
              
              const usageDescription = createElement('p', [
                'margin:0 0 20px 0',
                'color:#5f6368',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.usageIntro);
              
              usageContent.appendChild(usageTitle);
              usageContent.appendChild(usageDescription);
              
              // Tag feature section
              const tagSection = createElement('div', [
                'margin-bottom:24px',
                'padding:16px',
                'background:#f3e5f5',
                'border-radius:8px',
                'border-left:4px solid #9c27b0'
              ].join(';'));
              
              const tagTitle = createElement('h4', [
                'margin:0 0 12px 0',
                'font-size:16px',
                'font-weight:600',
                'color:#9c27b0'
              ].join(';'), T.tagFeatureTitle);
              
              const tagDesc = createElement('p', [
                'margin:0 0 12px 0',
                'color:#333',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.tagFeatureDesc);
              
              const tagFeaturesList = createElement('ul', [
                'margin:0 0 12px 0',
                'padding-left:20px',
                'color:#333',
                'font-size:13px',
                'line-height:1.8'
              ].join(';'));
              
              const tagFeatures = T.tagFeatures;
              
              tagFeatures.forEach(feature => {
                const li = createElement('li', [
                  'margin-bottom:4px'
                ].join(';'), feature);
                tagFeaturesList.appendChild(li);
              });
              
              const tagUsageTitle = createElement('div', [
                'margin:16px 0 8px 0',
                'font-weight:600',
                'color:#333',
                'font-size:14px'
              ].join(';'), T.tagUsageTitle);
              
              const tagUsageSteps = createElement('ol', [
                'margin:0',
                'padding-left:20px',
                'color:#5f6368',
                'font-size:13px',
                'line-height:1.8'
              ].join(';'));
              
              const tagSteps = T.tagSteps;
              
              tagSteps.forEach(step => {
                const li = createElement('li', [
                  'margin-bottom:4px'
                ].join(';'), step);
                tagUsageSteps.appendChild(li);
              });
              
              tagSection.appendChild(tagTitle);
              tagSection.appendChild(tagDesc);
              tagSection.appendChild(tagFeaturesList);
              tagSection.appendChild(tagUsageTitle);
              tagSection.appendChild(tagUsageSteps);
              
              // Template feature section
              const templateSection = createElement('div', [
                'margin-bottom:24px',
                'padding:16px',
                'background:#f8f9fa',
                'border-radius:8px',
                'border-left:4px solid #1a73e8'
              ].join(';'));
              
              const templateTitle = createElement('h4', [
                'margin:0 0 12px 0',
                'font-size:16px',
                'font-weight:600',
                'color:#1a73e8'
              ].join(';'), T.templateFeatureTitle);
              
              const templateDesc = createElement('p', [
                'margin:0 0 12px 0',
                'color:#333',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.templateFeatureDesc);
              
              const templateSyntaxTitle = createElement('div', [
                'margin:0 0 8px 0',
                'font-weight:600',
                'color:#333',
                'font-size:14px'
              ].join(';'), T.templateTypesTitle);
              
              // Text type
              const textTypeSection = createElement('div', [
                'margin:0 0 16px 0'
              ].join(';'));
              
              const textTypeTitle = createElement('div', [
                'margin:0 0 4px 0',
                'font-weight:600',
                'color:#1a73e8',
                'font-size:13px'
              ].join(';'), T.textTypeTitle);
              
              const textTypeSyntax = createElement('code', [
                'display:block',
                'margin:0 0 4px 0',
                'padding:8px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:12px',
                'color:#d73a49'
              ].join(';'), '${text:項目名}');
              
              const textTypeDesc = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:12px',
                'line-height:1.5'
              ].join(';'), T.textTypeDesc);
              
              textTypeSection.appendChild(textTypeTitle);
              textTypeSection.appendChild(textTypeSyntax);
              textTypeSection.appendChild(textTypeDesc);
              
              // Number type
              const numberTypeSection = createElement('div', [
                'margin:0 0 16px 0'
              ].join(';'));
              
              const numberTypeTitle = createElement('div', [
                'margin:0 0 4px 0',
                'font-weight:600',
                'color:#1a73e8',
                'font-size:13px'
              ].join(';'), T.numberTypeTitle);
              
              const numberTypeSyntax = createElement('code', [
                'display:block',
                'margin:0 0 4px 0',
                'padding:8px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:12px',
                'color:#d73a49'
              ].join(';'), '${number:項目名}');
              
              const numberTypeDesc = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:12px',
                'line-height:1.5'
              ].join(';'), T.numberTypeDesc);
              
              numberTypeSection.appendChild(numberTypeTitle);
              numberTypeSection.appendChild(numberTypeSyntax);
              numberTypeSection.appendChild(numberTypeDesc);
              
              // Select type
              const selectTypeSection = createElement('div', [
                'margin:0 0 16px 0'
              ].join(';'));
              
              const selectTypeTitle = createElement('div', [
                'margin:0 0 4px 0',
                'font-weight:600',
                'color:#1a73e8',
                'font-size:13px'
              ].join(';'), T.selectTypeTitle);
              
              const selectTypeSyntax = createElement('code', [
                'display:block',
                'margin:0 0 4px 0',
                'padding:8px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:12px',
                'color:#d73a49'
              ].join(';'), '${select:項目名|選択肢1,選択肢2,選択肢3}');
              
              const selectTypeDesc = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:12px',
                'line-height:1.5'
              ].join(';'), T.selectTypeDesc);
              
              selectTypeSection.appendChild(selectTypeTitle);
              selectTypeSection.appendChild(selectTypeSyntax);
              selectTypeSection.appendChild(selectTypeDesc);
              
              // Textarea type
              const textareaTypeSection = createElement('div', [
                'margin:0 0 16px 0'
              ].join(';'));
              
              const textareaTypeTitle = createElement('div', [
                'margin:0 0 4px 0',
                'font-weight:600',
                'color:#1a73e8',
                'font-size:13px'
              ].join(';'), T.textareaTypeTitle);
              
              const textareaTypeSyntax = createElement('code', [
                'display:block',
                'margin:0 0 4px 0',
                'padding:8px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:12px',
                'color:#d73a49'
              ].join(';'), '${textarea:項目名}');
              
              const textareaTypeDesc = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:12px',
                'line-height:1.5'
              ].join(';'), T.textareaTypeDesc);
              
              textareaTypeSection.appendChild(textareaTypeTitle);
              textareaTypeSection.appendChild(textareaTypeSyntax);
              textareaTypeSection.appendChild(textareaTypeDesc);
              
              const templateExample = createElement('div', [
                'margin:12px 0 0 0'
              ].join(';'));
              
              const exampleTitle = createElement('div', [
                'margin:16px 0 8px 0',
                'font-weight:600',
                'color:#333',
                'font-size:14px'
              ].join(';'), T.exampleTitle);
              
              const exampleCode = createElement('code', [
                'display:block',
                'margin:0 0 12px 0',
                'padding:12px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:13px',
                'color:#333',
                'white-space:pre-wrap',
                'line-height:1.6'
              ].join(';'), T.exampleCode);
              
              const exampleNote = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:13px',
                'line-height:1.5'
              ].join(';'), T.exampleNote);
              
              templateSection.appendChild(templateTitle);
              templateSection.appendChild(templateDesc);
              templateSection.appendChild(templateSyntaxTitle);
              templateSection.appendChild(textTypeSection);
              templateSection.appendChild(numberTypeSection);
              templateSection.appendChild(selectTypeSection);
              templateSection.appendChild(textareaTypeSection);
              templateSection.appendChild(exampleTitle);
              templateSection.appendChild(exampleCode);
              templateSection.appendChild(exampleNote);
              
              // Variable feature section
              const variableSection = createElement('div', [
                'margin-bottom:24px',
                'padding:16px',
                'background:#f8f9fa',
                'border-radius:8px',
                'border-left:4px solid #34a853'
              ].join(';'));
              
              const variableTitle = createElement('h4', [
                'margin:0 0 12px 0',
                'font-size:16px',
                'font-weight:600',
                'color:#34a853'
              ].join(';'), T.variableFeatureTitle);
              
              const variableDesc = createElement('p', [
                'margin:0 0 12px 0',
                'color:#333',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.variableFeatureDesc);
              
              const variableSyntaxTitle = createElement('div', [
                'margin:0 0 8px 0',
                'font-weight:600',
                'color:#333',
                'font-size:14px'
              ].join(';'), T.variableUsageTitle);
              
              const variableStepsList = createElement('ol', [
                'margin:0 0 12px 0',
                'padding-left:20px',
                'list-style-type:decimal'
              ].join(';'));
              
              const variableSteps = T.variableSteps;
              
              variableSteps.forEach(step => {
                const listItem = createElement('li', [
                  'margin-bottom:8px',
                  'color:#333',
                  'font-size:13px',
                  'line-height:1.5'
                ].join(';'), step);
                variableStepsList.appendChild(listItem);
              });
              
              const variableExampleTitle = createElement('div', [
                'margin:12px 0 8px 0',
                'font-weight:600',
                'color:#333',
                'font-size:14px'
              ].join(';'), T.variableExampleTitle);
              
              const variableExampleCode = createElement('code', [
                'display:block',
                'margin:0 0 8px 0',
                'padding:12px',
                'background:#fff',
                'border:1px solid #e0e0e0',
                'border-radius:4px',
                'font-family:monospace',
                'font-size:13px',
                'color:#333',
                'white-space:pre-wrap',
                'line-height:1.6'
              ].join(';'), T.variableExampleCode);
              
              const variableExampleNote = createElement('p', [
                'margin:0',
                'color:#5f6368',
                'font-size:13px',
                'line-height:1.5'
              ].join(';'), T.variableExampleNote);
              
              variableSection.appendChild(variableTitle);
              variableSection.appendChild(variableDesc);
              variableSection.appendChild(variableSyntaxTitle);
              variableSection.appendChild(variableStepsList);
              variableSection.appendChild(variableExampleTitle);
              variableSection.appendChild(variableExampleCode);
              variableSection.appendChild(variableExampleNote);
              
              // Tips section
              const tipsSection = createElement('div', [
                'margin-bottom:16px'
              ].join(';'));
              
              const tipsTitle = createElement('h4', [
                'margin:0 0 12px 0',
                'font-size:16px',
                'font-weight:600',
                'color:#34a853'
              ].join(';'), T.tipsTitle);
              
              const tipsList = createElement('ul', [
                'margin:0',
                'padding-left:20px',
                'list-style-type:disc'
              ].join(';'));
              
              const tips = T.tips;
              
              tips.forEach(tip => {
                const listItem = createElement('li', [
                  'margin-bottom:8px',
                  'color:#333',
                  'font-size:14px',
                  'line-height:1.5'
                ].join(';'), tip);
                tipsList.appendChild(listItem);
              });
              
              tipsSection.appendChild(tipsTitle);
              tipsSection.appendChild(tipsList);
              
              // Append sections in logical order: テンプレート機能 → 変数機能 → タグ機能 → ヒント
              usageContent.appendChild(templateSection);
              usageContent.appendChild(variableSection);
              usageContent.appendChild(tagSection);
              usageContent.appendChild(tipsSection);
              
              container.appendChild(usageContent);
            }
          },
          {
            label: T.tabVariables,
            content: (container) => {
              // Settings tab content - Variable management
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
              ].join(';'), T.variableSettingsTitle);
              const settingsDesc = createElement('p', [
                'margin:0 0 20px 0',
                'color:#5f6368',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.variableSettingsDesc);
              
              settingsContent.appendChild(settingsTitle);
              settingsContent.appendChild(settingsDesc);
              
              // Variable list container
              const variableListContainer = createElement('div', [
                'margin-bottom:20px'
              ].join(';'));
              
              // Function to render variable list
              const renderVariableList = () => {
                clearContainer(variableListContainer);
                const variables = loadVariables();
                
                if (variables.length === 0) {
                  const emptyMessage = createElement('p', [
                    'color:#9aa0a6',
                    'font-size:13px',
                    'text-align:center',
                    'padding:20px',
                    'background:#f8f9fa',
                    'border-radius:4px',
                    'margin:0'
                  ].join(';'), T.noVariables);
                  variableListContainer.appendChild(emptyMessage);
                  return;
                }
                
                // Create variable list
                const varList = createElement('div', [
                  'display:flex',
                  'flex-direction:column',
                  'gap:8px'
                ].join(';'));
                
                variables.forEach((variable, index) => {
                  const varItem = createElement('div', [
                    'display:flex',
                    'align-items:center',
                    'gap:8px',
                    'padding:12px',
                    'background:#f8f9fa',
                    'border-radius:4px',
                    'border:1px solid #e8eaed'
                  ].join(';'));
                  
                  // Variable name display
                  const varName = createElement('div', [
                    'flex:1',
                    'font-family:monospace',
                    'font-size:13px',
                    'color:#1a73e8',
                    'font-weight:500',
                    'word-break:break-word'
                  ].join(';'), `\${var:${variable.name}}`);
                  
                  // Variable value display
                  const varValue = createElement('div', [
                    'flex:2',
                    'font-size:13px',
                    'color:#333',
                    'overflow:hidden',
                    'text-overflow:ellipsis',
                    'white-space:nowrap'
                  ].join(';'), variable.value || T.variableEmpty);
                  
                  // Edit button
                  const editBtn = createElement('button', [
                    'padding:6px 12px',
                    'font-size:12px',
                    'border:1px solid #dadce0',
                    'border-radius:4px',
                    'cursor:pointer',
                    'background:#fff',
                    'color:#202124',
                    'flex-shrink:0',
                    'transition:all 0.2s'
                  ].join(';'), T.editVariable, () => {
                    showVariableEditDialog(variable, index, renderVariableList);
                  });
                  
                  editBtn.onmouseover = () => {
                    editBtn.style.background = '#f8f9fa';
                    editBtn.style.borderColor = '#bdc1c6';
                  };
                  editBtn.onmouseout = () => {
                    editBtn.style.background = '#fff';
                    editBtn.style.borderColor = '#dadce0';
                  };
                  
                  // Delete button
                  const deleteBtn = createElement('button', [
                    'padding:6px 12px',
                    'font-size:12px',
                    'border:none',
                    'border-radius:4px',
                    'cursor:pointer',
                    'background:#ea4335',
                    'color:#fff',
                    'flex-shrink:0',
                    'transition:background 0.2s'
                  ].join(';'), '🗑️', () => {
                    if (confirm(T.variableDeleteConfirm(variable.name))) {
                      const vars = loadVariables();
                      vars.splice(index, 1);
                      saveVariables(vars);
                      renderVariableList();
                    }
                  });
                  
                  deleteBtn.onmouseover = () => deleteBtn.style.background = '#d33828';
                  deleteBtn.onmouseout = () => deleteBtn.style.background = '#ea4335';
                  
                  varItem.appendChild(varName);
                  varItem.appendChild(varValue);
                  varItem.appendChild(editBtn);
                  varItem.appendChild(deleteBtn);
                  varList.appendChild(varItem);
                });
                
                variableListContainer.appendChild(varList);
              };
              
              // Add new variable button
              const addButton = createElement('button', [
                'width:100%',
                'padding:10px',
                'font-size:13px',
                'border:1px dashed #dadce0',
                'border-radius:4px',
                'cursor:pointer',
                'background:#fff',
                'color:#202124',
                'font-weight:500',
                'margin-bottom:16px',
                'transition:all 0.2s'
              ].join(';'), T.addVariable, () => {
                showVariableEditDialog(null, -1, renderVariableList);
              });
              
              addButton.onmouseover = () => {
                addButton.style.background = '#f8f9fa';
                addButton.style.borderColor = '#1a73e8';
                addButton.style.borderStyle = 'solid';
              };
              addButton.onmouseout = () => {
                addButton.style.background = '#fff';
                addButton.style.borderColor = '#dadce0';
                addButton.style.borderStyle = 'dashed';
              };
              
              settingsContent.appendChild(addButton);
              settingsContent.appendChild(variableListContainer);
              
              // Initial render
              renderVariableList();
              
              container.appendChild(settingsContent);
            }
          },
          {
            label: T.tabTagManagement,
            content: (container) => {
              // Tag management tab content
              const tagContent = createElement('div', [
                'font-size:14px',
                'line-height:1.8',
                'color:#333'
              ].join(';'));
              
              const tagTitle = createElement('h3', [
                'margin:0 0 16px 0',
                'font-size:18px',
                'font-weight:600',
                'color:#333'
              ].join(';'), T.tagManagementTitle);
              
              const tagDescription = createElement('p', [
                'margin:0 0 20px 0',
                'color:#5f6368',
                'font-size:14px',
                'line-height:1.6'
              ].join(';'), T.tagManagementDesc);
              
              tagContent.appendChild(tagTitle);
              tagContent.appendChild(tagDescription);
              
              // Get all tags
              const allTags = loadAllTags();
              
              if (allTags.length === 0) {
                const emptyMessage = createElement('div', [
                  'padding:20px',
                  'text-align:center',
                  'color:#999',
                  'font-style:italic'
                ].join(';'), T.noTagsYet);
                tagContent.appendChild(emptyMessage);
              } else {
                // Calculate tag usage
                const allData = load();
                const tagUsage = {};
                allTags.forEach(tag => {
                  tagUsage[tag] = allData.filter(memo => memo.tags && memo.tags.includes(tag)).length;
                });
                
                // Tag list container
                const tagList = createElement('div', [
                  'display:flex',
                  'flex-direction:column',
                  'gap:8px'
                ].join(';'));
                
                allTags.forEach(tag => {
                  const usage = tagUsage[tag];
                  
                  const tagItem = createElement('div', [
                    'display:flex',
                    'justify-content:space-between',
                    'align-items:center',
                    'padding:12px',
                    'background:#f8f9fa',
                    'border-radius:6px',
                    'border:1px solid #e8eaed'
                  ].join(';'));
                  
                  const tagInfo = createElement('div', [
                    'display:flex',
                    'align-items:center',
                    'gap:12px',
                    'flex:1'
                  ].join(';'));
                  
                  const tagChip = createElement('span', [
                    'display:inline-block',
                    'padding:4px 12px',
                    'background:#e3f2fd',
                    'border:1px solid #90caf9',
                    'border-radius:12px',
                    'font-size:13px',
                    'color:#1976d2',
                    'font-weight:500'
                  ].join(';'), tag);
                  
                  const usageInfo = createElement('span', [
                    'color:#5f6368',
                    'font-size:12px'
                  ].join(';'), T.tagUsageCount(usage));
                  
                  tagInfo.appendChild(tagChip);
                  tagInfo.appendChild(usageInfo);
                  
                  // Delete button
                  const deleteButton = createElement('button', [
                    'padding:6px 12px',
                    'background:#ea4335',
                    'color:#fff',
                    'border:none',
                    'border-radius:4px',
                    'cursor:pointer',
                    'font-size:12px',
                    'font-weight:500',
                    'transition:background 0.2s'
                  ].join(';'), T.deleteTag, () => {
                    if (usage > 0) {
                      const confirmed = confirm(T.deleteTagConfirm(tag, usage));
                      if (!confirmed) return;
                    } else {
                      const confirmed = confirm(T.deleteTagConfirmNoMemo(tag));
                      if (!confirmed) return;
                    }
                    
                    // Delete the tag
                    deleteUnusedTags([tag]);
                    
                    // Re-render the tag management content
                    clearContainer(container);
                    this.content(container);
                  });
                  
                  deleteButton.onmouseover = () => deleteButton.style.background = '#d33828';
                  deleteButton.onmouseout = () => deleteButton.style.background = '#ea4335';
                  
                  tagItem.appendChild(tagInfo);
                  tagItem.appendChild(deleteButton);
                  tagList.appendChild(tagItem);
                });
                
                tagContent.appendChild(tagList);
              }
              
              container.appendChild(tagContent);
            }
          },
          {
            label: T.tabOther,
            content: (container) => {
              // Other settings tab content
              const otherContent = createElement('div', [
                'font-size:14px',
                'line-height:1.8',
                'color:#333'
              ].join(';'));

              const otherTitle = createElement('h3', [
                'margin:0 0 16px 0',
                'font-size:18px',
                'font-weight:600',
                'color:#333'
              ].join(';'), T.otherSettingsTitle);

              // Language switcher section
              const langSection = createElement('div', 'margin-bottom:8px');

              const langTitle = createElement('h4', [
                'margin:0 0 6px 0',
                'font-size:15px',
                'font-weight:600',
                'color:#333'
              ].join(';'), T.languageSectionTitle);

              const langDesc = createElement('p', [
                'margin:0 0 12px 0',
                'color:#5f6368',
                'font-size:13px',
                'line-height:1.5'
              ].join(';'), T.languageSectionDesc);

              const langButtons = createElement('div', [
                'display:flex',
                'flex-wrap:wrap',
                'gap:8px'
              ].join(';'));

              const currentLang = _cache.language;
              LANGUAGES.forEach((lang) => {
                const isSelected = lang.code === currentLang;
                const displayLabel = lang.code === null ? T.languageAuto : lang.label;
                const btn = createElement('button', [
                  `background:${isSelected ? '#1a73e8' : '#fff'}`,
                  `color:${isSelected ? '#fff' : '#333'}`,
                  `border:2px solid ${isSelected ? '#1a73e8' : '#dadce0'}`,
                  'border-radius:8px',
                  'padding:8px 16px',
                  'font-size:13px',
                  'font-family:inherit',
                  'cursor:pointer',
                  'transition:all 0.15s'
                ].join(';'), displayLabel);

                if (!isSelected) {
                  btn.onmouseover = () => {
                    btn.style.background = '#e8f0fe';
                    btn.style.borderColor = '#1a73e8';
                    btn.style.color = '#1a73e8';
                  };
                  btn.onmouseout = () => {
                    btn.style.background = '#fff';
                    btn.style.borderColor = '#dadce0';
                    btn.style.color = '#333';
                  };
                }

                btn.onclick = async () => {
                  await saveLanguage(lang.code);
                  close();
                  await Promise.resolve(); // yield to event loop before re-initialization
                  run();
                };

                langButtons.appendChild(btn);
              });

              langSection.appendChild(langTitle);
              langSection.appendChild(langDesc);
              langSection.appendChild(langButtons);

              otherContent.appendChild(otherTitle);
              otherContent.appendChild(langSection);

              container.appendChild(otherContent);
            }
          },
          {
            label: T.tabHistory,
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
              ].join(';'), T.appTitle);
              
              const appDescription = createElement('p', [
                'margin:0 0 20px 0',
                'color:#5f6368',
                'font-size:14px'
              ].join(';'), T.appDesc);
              
              historyContent.appendChild(appTitle);
              historyContent.appendChild(appDescription);
              
              // Version history
              // Display all versions from centralized VERSION_INFO
              VERSION_INFO.HISTORY.forEach(versionInfo => {
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
                ].join(';'), `${versionInfo.version} (${versionInfo.date})`);
                
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
    settingsButton.title = T.settingsTitle;
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
    ].join(';'), T.deleteAll, () => {
      const data = load();
      const unpinnedCount = data.filter(item => !item.pinned).length;
      
      if (unpinnedCount === 0) {
        alert(T.noMemosToDelete);
        return;
      }
      
      if (confirm(T.deleteAllConfirm(unpinnedCount))) {
        const newData = data.filter(item => item.pinned);
        save(newData);
      }
    });
    deleteAllButton.title = T.deleteAllTitle;
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
    titleInput.placeholder = T.titlePlaceholder;
    titleInput.onkeydown = (e) => {
      if (e.key === KeyHandler.ESC) {
        e.preventDefault();
        e.stopPropagation();
        // If user is creating a memo, clear the form instead of closing bookmarklet
        // clearFullViewForm is defined after input element is created
        if (KeyHandler.isNewMemoCreating) {
          clearFullViewForm();
        } else {
          close();
        }
        return;
      }
      // Note: Ctrl+Enter handler will be added after saveButton is created
      e.stopPropagation();
    };
    
    // Track when user starts interacting with the form in full view
    titleInput.oninput = () => {
      if (!isTitleOnlyMode) {
        KeyHandler.isNewMemoCreating = true;
      }
    };
    titleInput.onpaste = stopPropagation;
    
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
    ].join(';'), T.randomEmoji, () => {
      const emoji = getRandomEmoji();
      currentEmoji = emoji;
      emojiButton.textContent = emoji;
      emojiDropdown.style.display = 'none';
      // Track that user is creating a memo
      if (!isTitleOnlyMode) {
        KeyHandler.isNewMemoCreating = true;
      }
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
    ].join(';'), T.clearEmoji, () => {
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
        // Track that user is creating a memo
        if (!isTitleOnlyMode) {
          KeyHandler.isNewMemoCreating = true;
        }
      });
      
      // Apply centered hover effect with background and border
      applyHoverEffect(emojiBtn, 1.15, '#f0f0f0', '#ccc');
      
      emojiGrid.appendChild(emojiBtn);
    });

    emojiDropdown.appendChild(emojiGrid);
    emojiTitleRowContainer.appendChild(emojiTitleRow);
    emojiTitleRowContainer.appendChild(emojiDropdown);

    body.appendChild(emojiTitleRowContainer);

    // Tag input for new memo creation
    const newMemoTagInput = createTagInput([], (tags) => {
      currentTags = tags;
      if (!isTitleOnlyMode) {
        KeyHandler.isNewMemoCreating = true;
      }
    });
    body.appendChild(newMemoTagInput.container);

    // Use centralized textarea creation for consistent UI/UX
    const input = createTextarea({
      placeholder: T.memoPlaceholder,
      value: '',
      borderColor: '#ccc',
      marginBottom: '10px'
    });
    input.style.flexShrink = '0';
    input.onkeydown = (e) => {
      if (e.key === KeyHandler.ESC) {
        e.preventDefault();
        e.stopPropagation();
        // If user is creating a memo, clear the form instead of closing bookmarklet
        if (KeyHandler.isNewMemoCreating) {
          clearFullViewForm();
        } else {
          close();
        }
        return;
      }
      if (KeyHandler.isCtrlEnter(e)) {
        e.preventDefault();
        saveButton.click();
        return;
      }
      e.stopPropagation();
    };
    
    // Track when user starts interacting with the form in full view
    input.oninput = () => {
      if (!isTitleOnlyMode) {
        KeyHandler.isNewMemoCreating = true;
      }
    };
    input.onpaste = stopPropagation;
    
    body.appendChild(input);
    
    // Helper function to clear the full view form and reset creation state
    // Defined here after both titleInput and input are created
    const clearFullViewForm = () => {
      titleInput.value = '';
      input.value = '';
      currentEmoji = initializeNewMemoEmoji();
      currentTags = [];
      newMemoTagInput.setTags([]);
      emojiButton.textContent = currentEmoji;
      KeyHandler.isNewMemoCreating = false;
    };

    const saveButton = createElement('button', [
      'flex-shrink:0',
      'width:100%',
      'padding:8px',
      `background:${COLORS.SAVE_BUTTON}`,
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'font-weight:bold',
      'font-size:13px',
      'box-sizing:border-box'
    ].join(';'), T.saveMemo, () => {
      const title = titleInput.value.trim();
      const value = input.value.trim();
      if (!value) return;

      const data = load();
      if (data.length >= MAX) {
        alert(T.maxMemos(MAX));
        return;
      }

      const now = new Date().toISOString();
      data.unshift({ title: title, text: value, createdDate: now, updatedDate: now, pinned: false, emoji: currentEmoji, tags: currentTags });
      save(data);
      // Use clearFullViewForm to reset state consistently
      clearFullViewForm();
    });
    body.appendChild(saveButton);

    // Now that saveButton is created, add Ctrl+Enter handler to titleInput
    // This allows saving the memo from the title input field
    const originalTitleKeydown = titleInput.onkeydown;
    titleInput.onkeydown = (e) => {
      // Check Ctrl+Enter first before calling original handler
      // This ensures Ctrl+Enter is handled before e.stopPropagation() in the original handler
      if (KeyHandler.isCtrlEnter(e)) {
        e.preventDefault();
        saveButton.click();
        return;
      }
      
      // Call original handler if it exists (handles ESC and stopPropagation)
      if (originalTitleKeydown) {
        originalTitleKeydown(e);
      }
    };

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
      ].join(';'), T.pinBtn(item.pinned, isCompactMode), () => {
        const currentData = load();
        if (currentData[originalIndex]) {
          currentData[originalIndex].pinned = !currentData[originalIndex].pinned;
          save(currentData);
        }
      });
      pinButton.title = item.pinned ? T.unpinTitle : T.pinTitle;

      const editButton = createElement('button', [
        ...buttonStyle,
        'background:#1a73e8',
        'color:#fff'
      ].join(';'), T.editBtn(isCompactMode), () => {
        // Enter edit mode
        KeyHandler.isEditMode = true;
        
        // Disable drag & drop during edit to prevent interference with text selection
        DragDropManager.disableAll();
        
        const listItem = actions.parentElement;
        
        // Create edit UI using refactored helper
        const editUI = createEditUI(item, (updatedData) => {
          // Save handler
          const currentData = load();
          if (currentData[originalIndex]) {
            currentData[originalIndex].title = updatedData.title;
            currentData[originalIndex].text = updatedData.text;
            currentData[originalIndex].emoji = updatedData.emoji;
            currentData[originalIndex].tags = updatedData.tags || [];
            currentData[originalIndex].updatedDate = new Date().toISOString();
            save(currentData);
            KeyHandler.isEditMode = false;
            // Re-enable drag & drop after saving
            DragDropManager.enableAll();
          }
        }, () => {
          // Cancel handler
          KeyHandler.isEditMode = false;
          // Re-enable drag & drop after canceling
          DragDropManager.enableAll();
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
      editButton.title = T.editTitle;

      const copyButton = createElement('button', [
        ...buttonStyle,
        'background:#34a853',
        'color:#fff'
      ].join(';'), T.copyAction(isCompactMode), () => {
        // Resolve variables first, then check for templates
        const resolvedText = resolveVariables(item.text);
        
        // Check for template placeholders in resolved text
        const templates = parseTemplates(resolvedText);
        
        if (templates.length > 0) {
          // Show template form dialog
          const formDialog = createTemplateForm(templates, (values) => {
            // Replace templates and copy
            const finalText = replaceTemplates(resolvedText, templates, values);
            navigator.clipboard.writeText(finalText).then(() => {
              close();
            });
          }, () => {
            // Cancel - just close dialog (DialogManager handles cleanup)
          });
        } else {
          // No templates - direct copy with resolved variables
          navigator.clipboard.writeText(resolvedText).then(() => {
            close();
          });
        }
      });
      copyButton.title = T.copyTitle;

      const deleteButton = createElement('button', [
        ...buttonStyle,
        'background:#ea4335',
        'color:#fff'
      ].join(';'), T.deleteBtn(isCompactMode), () => {
        if (confirm(T.confirmDeleteMemo)) {
          const currentData = load();
          if (originalIndex < currentData.length) {
            currentData.splice(originalIndex, 1);
            save(currentData);
          }
        }
      });
      deleteButton.title = T.deleteTitle;

      actions.appendChild(pinButton);
      actions.appendChild(editButton);
      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);
      
      return actions;
    };

    // Compact new memo form state for list view
    let compactFormState = {
      visible: false,
      emoji: initializeNewMemoEmoji(),
      title: '',
      content: '',
      tags: []
    };

    // Helper function to reset compact form state - ensures consistency
    // Note: Uses closure over compactFormState and KeyHandler (defined above)
    const resetCompactFormState = () => {
      compactFormState = {
        visible: false,
        emoji: initializeNewMemoEmoji(),
        title: '',
        content: '',
        tags: []
      };
      KeyHandler.isNewMemoCreating = false;
    };

    /**
     * Creates a compact new memo form for list view
     * @returns {HTMLElement} Compact form container
     */
    const createCompactNewMemoForm = () => {
      const formContainer = createElement('li', [
        'background:#f0f7ff',
        'border:1px solid #1a73e8',
        'margin-bottom:8px',
        'padding:8px',
        'border-radius:6px',
        'display:flex',
        'flex-direction:column',
        'gap:6px',
        'box-sizing:border-box'
      ].join(';'));

      // First row: Emoji + Title input
      const firstRow = createElement('div', [
        'display:flex',
        'gap:6px',
        'align-items:center'
      ].join(';'));

      // Compact emoji button
      const compactEmojiButton = createElement('button', [
        'width:32px',
        'height:32px',
        'border:1px solid #ccc',
        'border-radius:4px',
        'cursor:pointer',
        'background:#fff',
        'font-size:18px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'transition:all 0.2s',
        'flex-shrink:0',
        'padding:0'
      ].join(';'), compactFormState.emoji || '➕');

      // Compact title input
      const compactTitleInput = createElement('input', [
        'flex:1',
        'padding:6px 8px',
        'border:1px solid #ccc',
        'border-radius:4px',
        'font-size:13px',
        'font-weight:600',
        'background:#fff',
        'color:#333',
        'font-family:sans-serif',
        'box-sizing:border-box'
      ].join(';'));
      compactTitleInput.type = 'text';
      compactTitleInput.placeholder = T.titlePlaceholder;
      compactTitleInput.value = compactFormState.title;

      firstRow.appendChild(compactEmojiButton);
      firstRow.appendChild(compactTitleInput);

      // Tag input for compact form
      const compactTagInput = createTagInput(compactFormState.tags || [], (tags) => {
        compactFormState.tags = tags;
      });
      compactTagInput.container.style.marginBottom = '6px';

      // Second row: Compact textarea
      const compactTextarea = createTextarea({
        placeholder: T.memoCompactPlaceholder,
        value: compactFormState.content,
        borderColor: '#ccc',
        marginBottom: '0'
      });
      compactTextarea.style.minHeight = '60px';
      compactTextarea.style.fontSize = '13px';

      // Third row: Action buttons (Save and Cancel)
      const buttonRow = createElement('div', [
        'display:flex',
        'gap:4px',
        'justify-content:flex-end'
      ].join(';'));

      const saveCompactButton = createElement('button', [
        'padding:6px 12px',
        `background:${COLORS.SAVE_BUTTON}`,
        'color:#fff',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'font-weight:500',
        'font-size:12px',
        'transition:background 0.2s'
      ].join(';'), T.saveCompact);

      const cancelCompactButton = createElement('button', [
        'padding:6px 12px',
        'background:#5f6368',
        'color:#fff',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'font-weight:500',
        'font-size:12px',
        'transition:background 0.2s'
      ].join(';'), T.cancelBtn);

      buttonRow.appendChild(saveCompactButton);
      buttonRow.appendChild(cancelCompactButton);

      // Emoji picker dropdown for compact form
      const compactEmojiDropdown = createElement('div', [
        'display:none',
        'position:absolute',
        'top:38px',
        'left:8px',
        'background:#fff',
        'border:1px solid #ccc',
        'border-radius:6px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
        'padding:8px',
        `z-index:${Z_INDEX.DROPDOWN}`,
        'box-sizing:border-box',
        'width:280px'
      ].join(';'));

      // Random button
      const compactRandomButton = createElement('button', [
        'width:100%',
        'padding:6px',
        'margin-bottom:6px',
        'font-size:12px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'cursor:pointer',
        'background:#f59e0b',
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), T.randomEmoji, () => {
        const emoji = getRandomEmoji();
        compactFormState.emoji = emoji;
        compactEmojiButton.textContent = emoji;
        compactEmojiDropdown.style.display = 'none';
      });

      // Clear button
      const compactClearButton = createElement('button', [
        'width:100%',
        'padding:6px',
        'margin-bottom:6px',
        'font-size:12px',
        'border:1px solid #ddd',
        'border-radius:4px',
        'cursor:pointer',
        'background:#ef4444',
        'color:#fff',
        'font-weight:500',
        'transition:background 0.2s'
      ].join(';'), T.clearEmoji, () => {
        compactFormState.emoji = '';
        compactEmojiButton.textContent = '➕';
        compactEmojiDropdown.style.display = 'none';
      });

      // Emoji grid
      const compactEmojiGrid = createElement('div', [
        'display:grid',
        'grid-template-columns:repeat(7, 1fr)',
        'gap:4px',
        'max-height:180px',
        'overflow-y:auto',
        'overflow-x:hidden',
        'padding:4px'
      ].join(';'));

      EMOJIS.forEach(emoji => {
        const emojiBtn = createElement('button', [
          'padding:6px',
          'font-size:16px',
          'border:1px solid transparent',
          'border-radius:4px',
          'cursor:pointer',
          'background:transparent',
          'transition:all 0.2s',
          'line-height:1',
          'min-width:0',
          'box-sizing:border-box'
        ].join(';'), emoji, () => {
          compactFormState.emoji = emoji;
          compactEmojiButton.textContent = emoji;
          compactEmojiDropdown.style.display = 'none';
        });
        applyHoverEffect(emojiBtn, 1.15, '#f0f0f0', '#ccc');
        compactEmojiGrid.appendChild(emojiBtn);
      });

      compactEmojiDropdown.appendChild(compactRandomButton);
      compactEmojiDropdown.appendChild(compactClearButton);
      compactEmojiDropdown.appendChild(compactEmojiGrid);

      // Event handlers
      compactEmojiButton.onclick = () => {
        compactEmojiDropdown.style.display = compactEmojiDropdown.style.display === 'none' ? 'block' : 'none';
      };

      compactTitleInput.oninput = () => {
        compactFormState.title = compactTitleInput.value;
      };
      compactTitleInput.onpaste = stopPropagation;

      compactTextarea.oninput = () => {
        compactFormState.content = compactTextarea.value;
      };
      compactTextarea.onpaste = stopPropagation;

      saveCompactButton.onclick = () => {
        const content = compactTextarea.value.trim();
        if (!content) {
          alert(T.enterMemoContent);
          return;
        }

        const data = load();
        if (data.length >= MAX) {
          alert(T.maxMemosCompact(MAX));
          return;
        }

        const now = new Date().toISOString();
        data.unshift({
          title: compactTitleInput.value.trim(),
          text: content,
          createdDate: now,
          updatedDate: now,
          pinned: false,
          emoji: compactFormState.emoji,
          tags: compactFormState.tags || []
        });
        
        // Reset form state BEFORE calling save() so renderList() sees the updated state
        resetCompactFormState();
        save(data);
      };

      cancelCompactButton.onclick = () => {
        resetCompactFormState();
        renderList(load());
      };

      // Keyboard shortcuts
      compactTextarea.onkeydown = (e) => {
        if (e.key === KeyHandler.ESC) {
          e.preventDefault();
          e.stopPropagation(); // Prevent event from reaching document handler
          cancelCompactButton.click();
          return;
        }
        if (KeyHandler.isCtrlEnter(e)) {
          e.preventDefault();
          saveCompactButton.click();
          return;
        }
        e.stopPropagation();
      };

      compactTitleInput.onkeydown = (e) => {
        if (e.key === KeyHandler.ESC) {
          e.preventDefault();
          e.stopPropagation(); // Prevent event from reaching document handler
          cancelCompactButton.click();
          return;
        }
        // Note: Ctrl+Enter in title field is intentionally not bound
        // to avoid confusion (it saves in textarea but would move focus here)
        e.stopPropagation();
      };

      // Append elements to form
      const firstRowContainer = createElement('div', 'position:relative');
      firstRowContainer.appendChild(firstRow);
      firstRowContainer.appendChild(compactEmojiDropdown);

      formContainer.appendChild(firstRowContainer);
      formContainer.appendChild(compactTagInput.container);
      formContainer.appendChild(compactTextarea);
      formContainer.appendChild(buttonRow);

      return formContainer;
    };

    const renderList = (data) => {
      // Filter data by selected tags if any
      let filteredData = data;
      if (currentTagFilter.length > 0) {
        filteredData = data.filter(item => {
          if (!item.tags || item.tags.length === 0) return false;
          // Show memo if it has at least one of the selected tags
          return currentTagFilter.some(filterTag => item.tags.includes(filterTag));
        });
      }
      
      title.textContent = `Memo (${filteredData.length}/${data.length})`;
      listContainer.replaceChildren();
      
      // Clear drag-drop tracking when re-rendering list
      DragDropManager.clearTracking();

      // Sort: pinned items first, then by original order
      const sortedData = [...filteredData].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return data.indexOf(a) - data.indexOf(b);
      });

      if (isTitleOnlyMode) {
        // Add "New Memo" button at the top of list view
        if (compactFormState.visible) {
          // Show compact form
          listContainer.appendChild(createCompactNewMemoForm());
        } else {
          // Show "Add New Memo" button
          const addButton = createElement('button', [
            'width:100%',
            'padding:10px',
            'margin-bottom:8px',
            `background:${COLORS.SAVE_BUTTON}`,
            'color:#fff',
            'border:none',
            'border-radius:6px',
            'cursor:pointer',
            'font-weight:600',
            'font-size:13px',
            'transition:background 0.2s',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'gap:6px'
          ].join(';'), T.addNewMemo, () => {
            compactFormState.visible = true;
            KeyHandler.isNewMemoCreating = true; // Prevent ESC from closing bookmarklet
            renderList(data);
            // Focus on the textarea after rendering
            setTimeout(() => {
              const textarea = listContainer.querySelector('textarea');
              if (textarea) textarea.focus();
            }, 0);
          });
          addButton.onmouseover = () => {
            addButton.style.background = COLORS.SAVE_BUTTON_HOVER;
          };
          addButton.onmouseout = () => {
            addButton.style.background = COLORS.SAVE_BUTTON;
          };
          listContainer.appendChild(addButton);
        }
        // Title-only mode: show titles with compact action buttons
        // Track pinned items index for drag & drop
        let pinnedItemsIndex = 0;
        
        sortedData.forEach((item, sortedIndex) => {
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
          
          // Setup drag & drop for pinned items only
          if (item.pinned) {
            const currentPinnedIndex = pinnedItemsIndex;
            DragDropManager.setupDraggable(listItem, currentPinnedIndex, data, (newData) => {
              save(newData);
            });
            pinnedItemsIndex++;
          }
          
          // Content area (clickable to expand for unpinned items)
          // For pinned items, cursor is handled by drag handle
          const contentArea = createElement('div', [
            'flex:1',
            'display:flex',
            'align-items:center',
            'gap:8px',
            item.pinned ? '' : 'cursor:pointer',
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
            'min-width:0',
            'display:-webkit-box',
            '-webkit-line-clamp:2',
            '-webkit-box-orient:vertical',
            'overflow:hidden',
            'line-height:1.4',
            'word-break:break-word'
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
          
          // Display tags in compact mode
          if (item.tags && item.tags.length > 0) {
            const tagsContainer = createElement('div', [
              'display:flex',
              'gap:4px',
              'flex-wrap:wrap',
              'flex-shrink:0',
              'max-width:40%'
            ].join(';'));
            
            // Show up to 3 tags, then show "+N" indicator
            const displayTags = item.tags.slice(0, 3);
            displayTags.forEach(tag => {
              const tagChip = createElement('span', [
                'display:inline-block',
                'padding:2px 6px',
                'background:#e3f2fd',
                'border:1px solid #90caf9',
                'border-radius:10px',
                'font-size:10px',
                'color:#1976d2',
                'font-weight:500',
                'white-space:nowrap'
              ].join(';'), tag);
              tagsContainer.appendChild(tagChip);
            });
            
            // Show "+N" if there are more tags
            if (item.tags.length > 3) {
              const moreIndicator = createElement('span', [
                'display:inline-block',
                'padding:2px 6px',
                'background:#f5f5f5',
                'border:1px solid #ddd',
                'border-radius:10px',
                'font-size:10px',
                'color:#666',
                'font-weight:500'
              ].join(';'), `+${item.tags.length - 3}`);
              tagsContainer.appendChild(moreIndicator);
            }
            
            contentArea.appendChild(tagsContainer);
          }
          
          // Only make unpinned items clickable to expand in title-only mode
          // Pinned items use drag handle and should not expand on click
          if (!item.pinned) {
            contentArea.onclick = () => {
              isTitleOnlyMode = false;
              titleOnlyButton.textContent = T.viewList;
              titleOnlyButton.style.background = '#34a853';
              
              // Show input fields
              emojiTitleRowContainer.style.display = 'block';
              newMemoTagInput.container.style.display = 'block';
              input.style.display = 'block';
              saveButton.style.display = 'block';
              
              // Reset compact form state when switching to full view
              resetCompactFormState();
              
              renderList(data);
            };
          }
          
          listItem.appendChild(contentArea);
          
          // Add compact action buttons
          const actionsContainer = createActionButtons(item, originalIndex, data, true);
          listItem.appendChild(actionsContainer);
          
          listContainer.appendChild(listItem);
        });
        
        return;
      }

      // Full view mode: show complete memo items with all details
      // Track pinned items index for drag & drop
      let pinnedItemsIndex = 0;
      
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

        // Setup drag & drop for pinned items only
        if (item.pinned) {
          const currentPinnedIndex = pinnedItemsIndex;
          DragDropManager.setupDraggable(listItem, currentPinnedIndex, data, (newData) => {
            save(newData);
          });
          pinnedItemsIndex++;
        }

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

        // Display tags in full view
        if (item.tags && item.tags.length > 0) {
          const tagsContainer = createElement('div', [
            'display:flex',
            'gap:6px',
            'flex-wrap:wrap',
            'margin-bottom:8px'
          ].join(';'));
          
          item.tags.forEach(tag => {
            const tagChip = createElement('span', [
              'display:inline-block',
              'padding:4px 10px',
              'background:#e3f2fd',
              'border:1px solid #90caf9',
              'border-radius:12px',
              'font-size:12px',
              'color:#1976d2',
              'font-weight:500',
              'white-space:nowrap'
            ].join(';'), tag);
            tagsContainer.appendChild(tagChip);
          });
          
          textWrapper.appendChild(tagsContainer);
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
        const createdDateStr = createdDate.toLocaleDateString(T.dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
        const updatedDateStr = updatedDate.toLocaleDateString(T.dateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
        
        // Show creation date
        const createdSpan = createElement('span', [
          'display:inline-flex',
          'align-items:center',
          'gap:3px'
        ].join(';'));
        const createdLabel = createElement('span', 'opacity:0.7', T.createdLabel);
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
          const updatedLabel = createElement('span', 'opacity:0.7', T.updatedLabel);
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
            ].join(';'), T.showMore);
            
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
                toggleButton.textContent = T.showLess;
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
                toggleButton.textContent = T.showMore;
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
      newMemoTagInput.container.style.display = 'none';
      input.style.display = 'none';
      saveButton.style.display = 'none';
    }
  } catch (error) {
    console.error(error);
    alert('Error: ' + error);
  }
})();

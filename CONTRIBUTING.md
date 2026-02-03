# 開発者向けドキュメント / Developer Documentation

このドキュメントは、ampm-bookmarklets プロジェクトの開発に参加する開発者向けの情報をまとめています。

## 📋 目次

- [プロジェクト概要](#プロジェクト概要)
- [技術スタック](#技術スタック)
- [プロジェクト構造](#プロジェクト構造)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [ビルドシステム](#ビルドシステム)
- [ブックマークレットの追加方法](#ブックマークレットの追加方法)
- [デプロイメント](#デプロイメント)
- [コーディング規約](#コーディング規約)
- [トラブルシューティング](#トラブルシューティング)

## プロジェクト概要

ampm-bookmarklets は、個人用のブックマークレットコレクションを管理し、GitHub Pages で公開するためのプロジェクトです。

### 主な機能

- ブックマークレットの一元管理
- 自動ビルドシステム
- GitHub Pages による公開
- GitHub Actions による自動デプロイ

## 技術スタック

- **言語**: JavaScript (Node.js)
- **ビルドツール**: Node.js (素の JavaScript、依存関係なし)
- **CI/CD**: GitHub Actions
- **ホスティング**: GitHub Pages
- **バージョン管理**: Git / GitHub

## プロジェクト構造

```
ampm-bookmarklets/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions デプロイワークフロー
├── bookmarklets/               # ブックマークレットのソースコード
│   ├── copy-markdown-link.js
│   ├── memo.js
│   └── translation-helper.js
├── build.js                    # ビルドスクリプト
├── index.html                  # 生成されるランディングページ (ビルド成果物)
├── package.json                # プロジェクト設定
├── README.md                   # ユーザー向けドキュメント
└── CONTRIBUTING.md             # 開発者向けドキュメント (このファイル)
```

## 開発環境のセットアップ

### 必要な環境

- Node.js 20.x 以上
- Git
- テキストエディタまたは IDE

### セットアップ手順

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/ampcpmgp/ampm-bookmarklets.git
   cd ampm-bookmarklets
   ```

2. Node.js がインストールされていることを確認:
   ```bash
   node --version
   # v20.x.x 以上が表示されることを確認
   ```

3. ビルドスクリプトを実行してテスト:
   ```bash
   npm run build
   # または
   node build.js
   ```

## 開発ワークフロー

### 新しいブックマークレットを追加する

1. 新しいブランチを作成:
   ```bash
   git checkout -b feature/new-bookmarklet
   ```

2. `bookmarklets/` ディレクトリに新しい `.js` ファイルを作成

3. ブックマークレットのコードを記述 (詳細は後述)

4. ローカルでビルドして動作確認:
   ```bash
   npm run build
   ```

5. 生成された `index.html` をブラウザで開いて確認

6. コミット＆プッシュ:
   ```bash
   git add .
   git commit -m "Add new bookmarklet: [名前]"
   git push origin feature/new-bookmarklet
   ```

7. GitHub で Pull Request を作成

### 既存のブックマークレットを修正する

1. 修正用ブランチを作成:
   ```bash
   git checkout -b fix/bookmarklet-name
   ```

2. `bookmarklets/` 内の該当ファイルを編集

3. バージョン番号と更新日時を更新

4. ローカルビルドで動作確認

5. コミット＆プッシュ＆PR作成

## ビルドシステム

### build.js の詳細

`build.js` は、`bookmarklets/` ディレクトリ内のすべての `.js` ファイルを読み込み、`index.html` を生成するシンプルなビルドスクリプトです。

#### 処理フロー

1. `bookmarklets/` ディレクトリから `.js` ファイルを読み込み
2. 各ファイルの最初の5行のコメントからメタデータを抽出:
   - 1行目: タイトル
   - 2行目: 説明
   - 3行目: 絵文字
   - 4行目: バージョン情報
   - 5行目: 更新日時
3. コメント行を削除してコードを抽出
4. `javascript:` プレフィックスを付けて URL エンコード
5. HTML テンプレートにデータを埋め込んで `index.html` を生成

#### 重要な関数

- `escapeHtml()`: XSS 対策のための HTML エスケープ処理
- `encodeURIComponent()`: ブックマークレット URL の生成

### ビルドコマンド

```bash
# ビルド実行
npm run build

# または
node build.js
```

成功すると以下のようなメッセージが表示されます:
```
✓ Generated index.html with 3 bookmarklet(s)
  - Copy Markdown Link
  - Memo
  - Translation Helper
```

## ブックマークレットの追加方法

### ファイル構造

```javascript
// タイトル
// 説明文
// 絵文字
// バージョン (v1, v2, v3 など)
// 更新日時 (YYYY-MM-DD 形式)

(function() {
  // ブックマークレットのコード
  // 即時実行関数で囲むことを推奨
})();
```

### 具体例

```javascript
// YouTube Time Stamper
// 現在の再生位置付きのYouTube URLをコピー
// 🎬
// v1
// 2026-02-03

(function() {
  if (window.location.hostname.includes('youtube.com')) {
    const video = document.querySelector('video');
    if (video) {
      const time = Math.floor(video.currentTime);
      const url = `${window.location.origin}${window.location.pathname}?t=${time}`;
      navigator.clipboard.writeText(url);
      alert('Copied: ' + url);
    }
  }
})();
```

### メタデータのガイドライン

#### タイトル (1行目)
- 簡潔でわかりやすい名前
- 日本語または英語
- 機能を直感的に表現

#### 説明 (2行目)
- 機能の簡単な説明
- 1〜2文で簡潔に
- 使用シーンがわかるように

#### 絵文字 (3行目)
- 機能を表す絵文字1つ
- 省略した場合は 📎 が使用される
- おすすめ絵文字:
  - 📋 コピー系
  - 🔍 検索系
  - 🎨 デザイン系
  - 🎬 動画系
  - 📝 メモ系
  - 🌐 翻訳系

#### バージョン (4行目)
- `v1`, `v2`, `v3` などの形式
- 機能追加時にインクリメント
- 後方互換性のない変更時は大きくインクリメント

#### 更新日時 (5行目)
- `YYYY-MM-DD` 形式
- 例: `2026-02-03`
- バージョン変更時に更新

### コーディングのベストプラクティス

1. **即時実行関数で囲む**
   ```javascript
   (function() {
     // コード
   })();
   ```

2. **グローバルスコープを汚染しない**
   - 変数は `const` または `let` で宣言
   - 関数はローカルスコープ内で定義

3. **エラーハンドリングを実装**
   ```javascript
   try {
     // メインロジック
   } catch (error) {
     console.error('Bookmarklet error:', error);
     alert('エラーが発生しました');
   }
   ```

4. **DOM操作の前に要素の存在確認**
   ```javascript
   const element = document.querySelector('.target');
   if (element) {
     // 処理
   }
   ```

5. **ユーザーフィードバックを提供**
   - `alert()` や `confirm()` で結果を通知
   - コンソールログも活用

## デプロイメント

### GitHub Actions による自動デプロイ

`.github/workflows/deploy.yml` に定義されたワークフローが、`main` ブランチへのプッシュ時に自動実行されます。

#### ワークフロー構成

1. **Build ジョブ**
   - リポジトリをチェックアウト
   - Node.js 20 をセットアップ
   - `node build.js` を実行して `index.html` を生成
   - GitHub Pages 用のアーティファクトをアップロード

2. **Deploy ジョブ**
   - ビルド成果物を GitHub Pages にデプロイ

#### デプロイの確認

1. GitHub リポジトリの Actions タブで実行状況を確認
2. デプロイ完了後、https://ampcpmgp.github.io/ampm-bookmarklets/ にアクセス

### 初回セットアップ

GitHub Pages を有効化するには:

1. リポジトリの Settings > Pages に移動
2. **Source** を `GitHub Actions` に設定
3. 変更を保存

これにより、ワークフローが GitHub Pages へのデプロイ権限を持つようになります。

### 手動デプロイ

必要に応じて、GitHub の Actions タブから手動でワークフローを実行できます:

1. Actions タブを開く
2. "Build and Deploy" ワークフローを選択
3. "Run workflow" ボタンをクリック

## コーディング規約

### JavaScript スタイル

- **インデント**: 2スペース
- **セミコロン**: 必須
- **クォート**: シングルクォート推奨
- **変数宣言**: `const` 優先、必要に応じて `let`
- **関数**: アロー関数または関数式を使用

### コメント

- ブックマークレットファイルの最初の5行は必須メタデータ
- コード内のコメントは必要最小限に
- 複雑なロジックには説明コメントを追加

### ファイル命名

- ケバブケース (kebab-case) を使用
- 例: `copy-markdown-link.js`, `translation-helper.js`
- 機能を明確に表す名前を選択

## トラブルシューティング

### ビルドエラー

#### `build.js` が動作しない

```bash
# Node.js のバージョン確認
node --version

# 再実行
node build.js
```

#### `bookmarklets/` ディレクトリが見つからない

リポジトリのルートディレクトリにいることを確認:
```bash
pwd
# /path/to/ampm-bookmarklets が表示されるべき

ls -la
# bookmarklets/ ディレクトリが表示されるべき
```

### デプロイエラー

#### GitHub Actions が失敗する

1. Actions タブでエラーログを確認
2. 主な原因:
   - Node.js バージョンの問題
   - `build.js` の構文エラー
   - GitHub Pages の設定未完了

#### Pages が表示されない

1. Settings > Pages で Source が `GitHub Actions` になっているか確認
2. 最新のデプロイが成功しているか Actions タブで確認
3. キャッシュクリアとページリロード

### ブックマークレットが動作しない

#### ブックマークレットをクリックしても何も起きない

1. ブラウザのコンソールでエラーを確認 (F12)
2. ターゲットページの Content Security Policy (CSP) を確認
3. コードの構文エラーをチェック

#### 一部のサイトで動作しない

- CSP (Content Security Policy) により制限されている可能性
- `eval` や `Function` コンストラクタは避ける
- サイト固有の DOM 構造に依存している可能性

## 開発のヒント

### デバッグ方法

1. **ブラウザコンソールの活用**
   ```javascript
   console.log('Debug:', variable);
   console.table(data);
   ```

2. **アラートでの確認**
   ```javascript
   alert(JSON.stringify(data, null, 2));
   ```

3. **段階的テスト**
   - コードを小さい部分に分けてテスト
   - 各段階で動作確認

### テスト方法

1. ローカルでビルド
2. 生成された `index.html` をブラウザで開く
3. ブックマークレットをブックマークバーにドラッグ
4. 対象サイトで実行してテスト

### 既存コードの参考

`bookmarklets/` 内の既存ファイルを参考にしてください:

- `copy-markdown-link.js`: シンプルなコピー機能
- `translation-helper.js`: DOM 操作の例
- `memo.js`: より複雑な UI 作成の例

## ライセンス

MIT License - 詳細は LICENSE ファイルを参照

## サポート

質問や問題がある場合は、GitHub Issues で報告してください。

---

**Happy Coding! 🚀**

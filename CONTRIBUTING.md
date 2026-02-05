# 開発者向けドキュメント

このドキュメントでは、ブックマークレットの追加方法やビルド方法など、開発者向けの情報を記載しています。

## セットアップ

### GitHub Pages の有効化

初回のみ、リポジトリの Settings > Pages で以下を設定してください：

- **Source**: GitHub Actions

この設定により、GitHub Actions ワークフローが自動的にデプロイできるようになります。

## ブックマークレットの追加方法

1. `bookmarklets/` ディレクトリに新しい `.js` ファイルを作成
2. 最初の5行にタイトル、説明、絵文字、バージョン、更新日時をコメントで記述
3. コミット＆プッシュすると自動的にビルド＆デプロイされます

### ファイル形式の例

```javascript
// My Bookmarklet Title
// This is a description of what this bookmarklet does
// 🚀
// v1
// 2026-01-27

(function() {
  // Your code here
  alert('Hello!');
})();
```

### メタデータの説明

#### 絵文字（3行目）
- コメントに絵文字を記述すると、GitHub Pages のリンクボタンに表示されます
- 絵文字を省略した場合は、デフォルトの 📎 が使用されます

#### バージョン情報（4行目）
- バージョン情報（v1, v2, v3 など）を記述します
- バージョン情報は GitHub Pages のタイトル横にバッジとして表示されます
- 機能を更新した際は、バージョン番号を上げることで変更履歴を管理できます

#### 更新日時情報（5行目）
- 更新日時（YYYY-MM-DD形式）を記述します
- 更新日時はバージョン情報と共に GitHub Pages のタイトル横に表示されます
- バージョン情報と更新日時を分けて管理することで、修正の履歴を明確に追跡できます

#### 更新履歴（6行目以降、オプション）
- 6行目以降に更新履歴を記述できます（オプション）
- フォーマット: `// vX: 更新内容の説明`（vの後に数字、コロン、説明）
- 更新履歴は GitHub Pages の各カードに「更新履歴」セクションとして表示されます
- クリックすることで展開/折りたたみが可能です
- バージョンが増えるたびに、最新の変更内容を追加することで、変更履歴を詳細に管理できます

### 更新履歴を含むファイル形式の例

```javascript
// My Bookmarklet Title
// This is a description of what this bookmarklet does
// 🚀
// v3
// 2026-02-04
// v3: Added support for dark mode - UI now automatically adapts to system theme
// v2: Fixed bug with special characters - now properly handles Unicode
// v1: Initial release - basic functionality implemented

(function() {
  // Your code here
  alert('Hello!');
})();
```

## ビルド

ローカルでビルドする場合:

```bash
node build.js
```

`index.html` が生成されます。

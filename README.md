# ampm-bookmarklets

個人作成の Bookmarklet コードを置く場所です。

## 特徴

- 📚 ブックマークレットの一元管理
- 🌐 GitHub Pages で即利用可能
- 🚀 シンプルで高速なビルドシステム
- 🔄 GitHub Actions による自動デプロイ

## セットアップ

### GitHub Pages の有効化

初回のみ、リポジトリの Settings > Pages で以下を設定してください：

- **Source**: GitHub Actions

この設定により、GitHub Actions ワークフローが自動的にデプロイできるようになります。

## 使い方

### ブックマークレットを使う

[GitHub Pages](https://ampcpmgp.github.io/ampm-bookmarklets/) にアクセスして、お好みのブックマークレットをブックマークバーにドラッグ&ドロップしてください。

### ブックマークレットを追加する

1. `bookmarklets/` ディレクトリに新しい `.js` ファイルを作成
2. 最初の5行にタイトル、説明、絵文字、バージョン、更新日時をコメントで記述
3. コミット＆プッシュすると自動的にビルド＆デプロイされます

例:
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

**絵文字について:**
- 3行目のコメントに絵文字を記述すると、GitHub Pages のリンクボタンに表示されます
- 絵文字を省略した場合は、デフォルトの 📎 が使用されます

**バージョン情報について:**
- 4行目のコメントにバージョン情報（v1, v2, v3 など）を記述します
- バージョン情報は GitHub Pages のタイトル横にバッジとして表示されます
- 機能を更新した際は、バージョン番号を上げることで変更履歴を管理できます

**更新日時情報について:**
- 5行目のコメントに更新日時（YYYY-MM-DD形式）を記述します
- 更新日時はバージョン情報と共に GitHub Pages のタイトル横に表示されます
- バージョン情報と更新日時を分けて管理することで、修正の履歴を明確に追跡できます

## ビルド

ローカルでビルドする場合:

```bash
node build.js
```

`index.html` が生成されます。

## ライセンス

MIT
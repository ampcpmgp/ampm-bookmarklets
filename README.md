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
2. 最初の2行にタイトルと説明をコメントで記述
3. コミット＆プッシュすると自動的にビルド＆デプロイされます

例:
```javascript
// My Bookmarklet Title
// This is a description of what this bookmarklet does

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

## ライセンス

MIT
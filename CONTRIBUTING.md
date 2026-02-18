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

## ビルド

ローカルでビルドする場合:

```bash
node build.js
```

`index.html` が生成されます。

## GitHub Actions ワークフロー

このリポジトリでは、以下のワークフローが自動実行されます：

### デプロイワークフロー（deploy.yml）

- **トリガー**: `main` ブランチへのプッシュ、または手動実行
- **処理内容**:
  1. ブックマークレットをビルド（`node build.js`）
  2. GitHub Pages へデプロイ

### PR ビルドワークフロー（pr-build.yml）

- **トリガー**: Pull Request の作成・更新
- **処理内容**:
  1. ブックマークレットをビルド（`node build.js`）
  2. `pr-preview.html` を PR ブランチにコミット
  3. ビルドされた `index.html` を Artifact としてアップロード
  4. PR にビルド結果のコメントを自動投稿

#### PR での成果物の確認方法

Pull Request を作成すると、自動的にビルドワークフローが実行され、2つの方法で動作確認できます：

##### 方法1: ブラウザで即座に確認（推奨）

1. PR のコメントに自動投稿される「PR Preview を開く」リンクをクリック
2. ブラウザで直接ブックマークレットのページが開きます
3. ブックマークをブックマークバーにドラッグ&ドロップして動作確認

この方法では、ファイルをダウンロードせずに即座にテストできます。

##### 方法2: Artifact からダウンロード（従来の方法）

1. PR の「Checks」タブから「PR Build and Artifact」を選択
2. 「Summary」セクションの「Artifacts」からビルドされた HTML ファイルをダウンロード
3. ダウンロードした HTML ファイルをブラウザで開いて動作確認

この機能により、PR をマージする前にビルド結果を確認できます。

## セキュリティガイドライン

### innerHTML の使用禁止

ブックマークレットでは、セキュリティ上の理由から **innerHTML の直接使用を禁止** しています。

#### 理由

- innerHTML は XSS (クロスサイトスクリプティング) 攻撃のリスクがあります
- 最近のブラウザでは Trusted Types API が有効な場合、innerHTML への代入でエラーが発生します
  - エラー例: `Error: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.`

#### 推奨される代替方法

1. **DOM API を使用した安全な要素作成**
   ```javascript
   // ❌ 悪い例
   element.innerHTML = '<div>' + userInput + '</div>';
   
   // ✅ 良い例
   const div = document.createElement('div');
   div.textContent = userInput;
   element.appendChild(div);
   ```

2. **ヘルパー関数の活用**
   ```javascript
   // 要素を安全に作成するヘルパー関数
   function createElementWithText(tag, text, className = '') {
     const element = document.createElement(tag);
     if (className) element.className = className;
     if (text) element.textContent = text;
     return element;
   }
   
   // template 要素を使った HTML 構造の作成
   function createElementsFromHTML(htmlString) {
     const template = document.createElement('template');
     template.innerHTML = htmlString;  // template 内では安全
     return template.content;
   }
   ```

3. **textContent と appendChild の組み合わせ**
   ```javascript
   // 複数の要素を組み立てる
   const container = document.createElement('div');
   const title = document.createElement('h1');
   title.textContent = 'タイトル';
   const content = document.createElement('p');
   content.textContent = 'コンテンツ';
   
   container.appendChild(title);
   container.appendChild(content);
   ```

### エスケープ処理

ユーザー入力や外部データを表示する際は、必ずエスケープ処理を行ってください。

```javascript
// HTML エスケープ関数の例
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### Shadow DOM の活用

Shadow DOM を使用することで、ページのスタイルや JavaScript から隔離された安全な環境を作成できます。

```javascript
const host = document.createElement('div');
const root = host.attachShadow({ mode: 'open' });
// root 内で安全に DOM 操作を行う
```

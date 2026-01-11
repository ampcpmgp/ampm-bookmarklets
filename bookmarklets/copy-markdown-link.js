// Markdownリンクをコピー
// 現在のページのタイトルとURLをMarkdown形式のリンク [title](url) でクリップボードにコピー
// 📋

(function() {
  var title = document.querySelector("title").textContent.trim();
  navigator.clipboard.writeText(`[${title}](${location.href})`);
})();

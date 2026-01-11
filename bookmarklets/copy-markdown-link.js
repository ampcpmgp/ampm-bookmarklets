// Markdownリンクをコピー
// 現在のページのタイトルとURLをMarkdown形式のリンク [title](url) でクリップボードにコピー
// 📋

(function() {
  try {
    var titleElement = document.querySelector("title");
    var title = titleElement ? titleElement.textContent.trim() : document.location.pathname;
    navigator.clipboard.writeText(`[${title}](${location.href})`).catch(function() {
      alert('Failed to copy to clipboard');
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
})();

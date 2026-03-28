// タイトルをコピー
// 現在のページのタイトルをクリップボードにコピー
// 📝
// v1
// 2026-03-28

(function() {
  try {
    var titleElement = document.querySelector("title");
    var title = titleElement ? titleElement.textContent.trim() : document.location.pathname;
    navigator.clipboard.writeText(title).catch(function() {
      alert('Failed to copy to clipboard');
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
})();

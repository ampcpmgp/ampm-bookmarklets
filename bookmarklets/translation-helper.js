// 翻訳補助
// コードブロックの構造を調整し、翻訳サービスで適切に処理されるよう最適化するブックマークレット
// 🌐
// v1
// 2026-01-27

(function() {
  "use strict";

  // コードブロックを含むpreタグをcodeタグで囲む
  // (HTMLタグや改行を含むものが対象)
  const preElements = Array.from(document.querySelectorAll("pre"));
  preElements
    .filter(function(element) {
      const hasHtmlTags = element.innerHTML.match(/<.*>/);
      const hasNewlines = element.innerHTML.match(/\n/);
      return hasHtmlTags || hasNewlines;
    })
    .forEach(function(element) {
      element.outerHTML = "<code>" + element.outerHTML + "</code>";
    });

  // 特定のクラスを持つpreタグもcodeタグで囲む
  const geistScrollElements = Array.from(document.querySelectorAll("pre.geist-overflow-scroll-y"));
  geistScrollElements.forEach(function(element) {
    element.outerHTML = "<code>" + element.outerHTML + "</code>";
  });

  // インラインコードのcodeタグをspanタグに変換
  // (HTMLタグを含まないものが対象)
  const codeElements = Array.from(document.querySelectorAll("code, .editor-wrapper"));
  codeElements
    .filter(function(element) {
      const hasHtmlTags = element.innerHTML.match(/<.*>/);
      return !hasHtmlTags;
    })
    .forEach(function(element) {
      element.outerHTML = element.outerHTML.replace(/code/g, "span");
    });
})();

// 翻訳のためのコードブロック調整
// preタグとcodeタグの構造を調整し、適切な翻訳がしやすくなるよう最適化するブックマークレット
// 🌐

(function() {
  "use strict";
  
  // Pre elements that contain HTML tags or newlines - wrap with code tags
  Array.from(document.querySelectorAll("pre"))
    .filter(function(element) {
      return element.innerHTML.match(/<.*>/) || element.innerHTML.match(/\n/);
    })
    .forEach(function(element) {
      element.outerHTML = "<code>" + element.outerHTML + "</code>";
    });
  
  // Pre elements with geist-overflow-scroll-y class - wrap with code tags
  Array.from(document.querySelectorAll("pre.geist-overflow-scroll-y"))
    .forEach(function(element) {
      element.outerHTML = "<code>" + element.outerHTML + "</code>";
    });
  
  // Code elements and editor-wrapper elements without HTML tags - convert to span
  Array.from(document.querySelectorAll("code, .editor-wrapper"))
    .filter(function(element) {
      return !element.innerHTML.match(/<.*>/);
    })
    .forEach(function(element) {
      element.outerHTML = element.outerHTML.replace(/code/g, "span");
    });
})();

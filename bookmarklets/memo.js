// ローカルメモ
// localStorageにメモを保存し、コピーと削除ができるフローティングメモウィジェット

(function() {
  try {
    const ID = 'ls-memo-final';
    const old = document.getElementById(ID);
    if (old) {
      old._close ? old._close() : old.remove();
      return;
    }

    const host = document.createElement('div');
    host.id = ID;
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      'z-index:2147483647',
      'border:none',
      'outline:none',
      'background:transparent',
      'isolation:isolate'
    ].join(';');
    document.body.appendChild(host);

    const close = () => {
      document.removeEventListener('keydown', docKey);
      host.remove();
    };
    
    host._close = close;

    const docKey = (e) => {
      if (e.key === 'Escape') close();
    };
    
    document.addEventListener('keydown', docKey);

    const shadow = host.attachShadow({ mode: 'open' });
    const KEY = 'my_local_storage_notes';
    const MAX = 100;

    const load = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch {
        return [];
      }
    };

    const save = (data) => {
      localStorage.setItem(KEY, JSON.stringify(data));
      renderList(data);
    };

    const createElement = (tag, css = '', text = '', clickHandler) => {
      const element = document.createElement(tag);
      if (css) element.style.cssText = css;
      if (text) element.textContent = text;
      if (clickHandler) element.onclick = clickHandler;
      return element;
    };

    const wrap = createElement('div', [
      'position:fixed',
      'z-index:2147483647',
      'top:20px',
      'right:20px',
      'width:320px',
      'max-height:85vh',
      'background:#fff',
      'color:#333',
      'border:1px solid #999',
      'box-shadow:0 8px 30px rgba(0,0,0,0.3)',
      'border-radius:8px',
      'display:flex',
      'flex-direction:column',
      'font-family:sans-serif',
      'font-size:14px',
      'box-sizing:border-box',
      'line-height:1.5'
    ].join(';'));

    const header = createElement('div', [
      'background:#f1f3f4',
      'padding:12px',
      'border-bottom:1px solid #ddd',
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'font-weight:bold',
      'border-radius:8px 8px 0 0',
      'box-sizing:border-box'
    ].join(';'));
    const title = createElement('span', '', 'Memo');
    header.appendChild(title);
    header.appendChild(createElement('span', [
      'cursor:pointer',
      'font-size:24px',
      'line-height:1',
      'padding:0 8px',
      'color:#5f6368'
    ].join(';'), '×', close));
    wrap.appendChild(header);

    const body = createElement('div', [
      'padding:12px',
      'overflow-y:auto',
      'display:flex',
      'flex-direction:column',
      'flex:1',
      'box-sizing:border-box'
    ].join(';'));

    const input = createElement('textarea', [
      'width:100%',
      'height:80px',
      'min-height:80px',
      'flex-shrink:0',
      'padding:10px',
      'margin-bottom:10px',
      'border:1px solid #ccc',
      'border-radius:4px',
      'resize:vertical',
      'font-size:14px',
      'background:#fff',
      'color:#333',
      'font-family:sans-serif',
      'box-sizing:border-box'
    ].join(';'));
    input.placeholder = 'テキストを入力...';
    input.onkeydown = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      e.stopPropagation();
    };
    body.appendChild(input);

    const saveButton = createElement('button', [
      'flex-shrink:0',
      'width:100%',
      'padding:8px',
      'background:#1a73e8',
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'font-weight:bold',
      'font-size:13px',
      'box-sizing:border-box'
    ].join(';'), '保存', () => {
      const value = input.value.trim();
      if (!value) return;

      const data = load();
      if (data.length >= MAX) {
        alert(`最大${MAX}件です`);
        return;
      }

      data.unshift({ text: value, date: new Date().toISOString() });
      save(data);
      input.value = '';
    });
    body.appendChild(saveButton);

    const listContainer = createElement('ul', [
      'list-style:none',
      'margin-top:15px',
      'padding:0',
      'box-sizing:border-box'
    ].join(';'));
    body.appendChild(listContainer);
    wrap.appendChild(body);

    shadow.appendChild(wrap);

    const renderList = (data) => {
      title.textContent = `Memo (${data.length}/${MAX})`;
      listContainer.replaceChildren();

      data.forEach((item, index) => {
        const listItem = createElement('li', [
          'background:#fff',
          'border:1px solid #eee',
          'margin-bottom:8px',
          'padding:10px',
          'border-radius:4px',
          'display:flex',
          'align-items:flex-start',
          'box-sizing:border-box'
        ].join(';'));

        const textElement = createElement('div', [
          'flex:1',
          'margin-right:8px',
          'word-break:break-all',
          'white-space:pre-wrap',
          'font-size:13px',
          'color:#333'
        ].join(';'), item.text);
        listItem.appendChild(textElement);

        const actions = createElement('div', 'display:flex;gap:5px;');

        const copyButton = createElement('button', [
          'padding:4px 8px',
          'font-size:12px',
          'border:none',
          'border-radius:3px',
          'cursor:pointer',
          'background:#34a853',
          'color:#fff',
          'min-width:45px',
          'white-space:nowrap'
        ].join(';'), 'Copy', () => {
          navigator.clipboard.writeText(item.text).then(close);
        });

        const deleteButton = createElement('button', [
          'padding:4px 8px',
          'font-size:12px',
          'border:none',
          'border-radius:3px',
          'cursor:pointer',
          'background:#ea4335',
          'color:#fff',
          'white-space:nowrap'
        ].join(';'), 'Del', () => {
          const currentData = load();
          currentData.splice(index, 1);
          save(currentData);
        });

        actions.appendChild(copyButton);
        actions.appendChild(deleteButton);
        listItem.appendChild(actions);
        listContainer.appendChild(listItem);
      });
    };

    renderList(load());
  } catch (error) {
    console.error(error);
    alert('Error: ' + error);
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // 1. 目录展开与折叠
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.parentElement.classList.toggle('open');
    });
  });

  // 加载 MD 文件
  const contentEl = document.getElementById('content');
  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const filePath = link.getAttribute('data-src');
      try {
        const res = await fetch(filePath);
        if(!res.ok) throw new Error('字幕文件未找到');
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
      } catch (err) {
        contentEl.innerHTML = `<p style="color:red">加载失败: ${err.message}</p>`;
      }
    });
  });

  // 2. 调整右侧字体大小
  let currentFontSize = 16;
  const fontValEl = document.getElementById('font-size-val');
  document.getElementById('btn-inc').addEventListener('click', () => {
    if(currentFontSize < 32) {
      currentFontSize += 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });
  document.getElementById('btn-dec').addEventListener('click', () => {
    if(currentFontSize > 12) {
      currentFontSize -= 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });

  // 3. 选词定位与半透明菜单
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;

  document.addEventListener('selectionchange', handleSelection);

  function handleSelection() {
    const selection = window.getSelection();
    if (selection.isCollapsed || !selection.toString().trim()) {
      menu.classList.add('hidden');
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!contentEl.contains(anchorNode)) return;

    currentRange = selection.getRangeAt(0);
    const rects = currentRange.getClientRects();
    if (rects.length === 0) return;

    const lastRect = rects[rects.length - 1];
    const firstRect = rects[0];
    const boundingTop = firstRect.top;
    const centerLeft = (firstRect.left + lastRect.right) / 2;

    menu.style.top = `${boundingTop + window.scrollY - 40}px`;
    menu.style.left = `${centerLeft + window.scrollX - (menu.offsetWidth / 2)}px`;
    menu.classList.remove('hidden');
  }

  // 4. 高亮与清除高亮
  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;
    const mark = document.createElement('mark');
    mark.className = 'user-highlight';
    try {
      currentRange.surroundContents(mark);
    } catch (e) {
      const fragment = currentRange.extractContents();
      mark.appendChild(fragment);
      currentRange.insertNode(mark);
    }
    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    let node = selection.anchorNode;
    if (node) {
      if (node.nodeType === 3) node = node.parentNode;
      const markEl = node.closest('mark.user-highlight');
      if (markEl) {
        const parent = markEl.parentNode;
        while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
        parent.removeChild(markEl);
      }
    }
    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

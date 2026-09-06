document.addEventListener('DOMContentLoaded', () => {
  // 1. 目录展开/收起
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.parentElement.classList.toggle('open');
    });
  });

  const contentEl = document.getElementById('content');
  let currentFilePath = '';

  // 2. 字幕文件读取与切换
  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      
      document.querySelectorAll('.file-link').forEach(item => item.classList.remove('active'));
      link.classList.add('active');

      const filePath = link.getAttribute('data-src');
      currentFilePath = filePath;

      try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error('字幕文件未找到');
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
        
        // 渲染文本后恢复高亮
        restoreHighlights();
      } catch (err) {
        contentEl.innerHTML = `<p style="color:red">加载失败: ${err.message}</p>`;
      }
    });
  });

  // 3. 字号调整功能（恢复%控制逻辑）
  let currentZoom = 100;
  const fontValEl = document.getElementById('font-size-val');

  document.getElementById('btn-inc').addEventListener('click', () => {
    if (currentZoom < 200) {
      currentZoom += 10;
      contentEl.style.fontSize = `${currentZoom}%`;
      fontValEl.textContent = `${currentZoom}%`;
    }
  });

  document.getElementById('btn-dec').addEventListener('click', () => {
    if (currentZoom > 70) {
      currentZoom -= 10;
      contentEl.style.fontSize = `${currentZoom}%`;
      fontValEl.textContent = `${currentZoom}%`;
    }
  });

  // 4. 高亮与取消高亮逻辑
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;
  let activeRanges = [];
  const isHighlightAPISupported = typeof CSS !== 'undefined' && CSS.highlights;

  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('keyup', handleSelection);

  function handleSelection(e) {
    if (menu.contains(e.target)) return;

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      menu.classList.add('hidden');
      return;
    }

    if (!contentEl.contains(selection.anchorNode)) {
      menu.classList.add('hidden');
      return;
    }

    currentRange = selection.getRangeAt(0).cloneRange();
    const rect = currentRange.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      menu.classList.add('hidden');
      return;
    }

    const centerX = rect.left + (rect.width / 2);
    const topY = rect.top;

    menu.classList.remove('hidden');
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    let leftPos = centerX - (menuWidth / 2);
    let topPos = topY - menuHeight - 8;

    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > window.innerWidth - 10) {
      leftPos = window.innerWidth - menuWidth - 10;
    }

    if (topPos < 10) {
      topPos = rect.bottom + 8;
    }

    menu.style.left = `${leftPos}px`;
    menu.style.top = `${topPos}px`;
  }

  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target) && !contentEl.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  function updateHighlightRegistry() {
    if (isHighlightAPISupported) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
    saveHighlights();
  }

  function getNodePath(node) {
    const path = [];
    while (node && node !== contentEl) {
      const parent = node.parentNode;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.childNodes, node);
      path.unshift(index);
      node = parent;
    }
    return path;
  }

  function getNodeFromPath(path) {
    let node = contentEl;
    for (const index of path) {
      if (node && node.childNodes[index]) {
        node = node.childNodes[index];
      } else {
        return null;
      }
    }
    return node;
  }

  function saveHighlights() {
    if (!currentFilePath) return;
    const serialized = activeRanges.map(range => ({
      startPath: getNodePath(range.startContainer),
      startOffset: range.startOffset,
      endPath: getNodePath(range.endContainer),
      endOffset: range.endOffset
    }));
    localStorage.setItem(`highlights_${currentFilePath}`, JSON.stringify(serialized));
  }

  function restoreHighlights() {
    activeRanges = [];
    if (!currentFilePath) return;

    const data = localStorage.getItem(`highlights_${currentFilePath}`);
    if (!data) {
      updateHighlightRegistry();
      return;
    }

    try {
      const serialized = JSON.parse(data);
      serialized.forEach(item => {
        const startNode = getNodeFromPath(item.startPath);
        const endNode = getNodeFromPath(item.endPath);

        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, item.startOffset);
          range.setEnd(endNode, item.endOffset);
          activeRanges.push(range);
        }
      });
    } catch (e) {
      console.error('恢复高亮失败:', e);
    }

    updateHighlightRegistry();
  }

  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;

    if (isHighlightAPISupported) {
      activeRanges.push(currentRange.cloneRange());
      updateHighlightRegistry();
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const clearRange = selection.getRangeAt(0);

    if (isHighlightAPISupported) {
      let newRanges = [];

      activeRanges.forEach(existingRange => {
        if (
          clearRange.compareBoundaryPoints(Range.END_TO_START, existingRange) >= 0 ||
          clearRange.compareBoundaryPoints(Range.START_TO_END, existingRange) <= 0
        ) {
          newRanges.push(existingRange);
        } else {
          if (clearRange.compareBoundaryPoints(Range.START_TO_START, existingRange) > 0) {
            const leftRange = existingRange.cloneRange();
            leftRange.setEnd(clearRange.startContainer, clearRange.startOffset);
            if (!leftRange.collapsed) newRanges.push(leftRange);
          }
          if (clearRange.compareBoundaryPoints(Range.END_TO_END, existingRange) < 0) {
            const rightRange = existingRange.cloneRange();
            rightRange.setStart(clearRange.endContainer, clearRange.endOffset);
            if (!rightRange.collapsed) newRanges.push(rightRange);
          }
        }
      });

      activeRanges = newRanges;
      updateHighlightRegistry();
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

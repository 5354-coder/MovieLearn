document.addEventListener('DOMContentLoaded', () => {
  // 1. 三级目录折叠与展开
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.parentElement.classList.toggle('open');
    });
  });

  const contentEl = document.getElementById('content');
  let currentFilePath = ''; // 记录当前打开的文件路径

  // 加载 MD 文件
  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const filePath = link.getAttribute('data-src');
      currentFilePath = filePath;
      try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error('字幕文件未找到');
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
        
        // 文件加载完成后，自动恢复该文件之前保存的高亮
        restoreHighlights();
      } catch (err) {
        contentEl.innerHTML = `<p style="color:red">加载失败: ${err.message}</p>`;
      }
    });
  });

  // 2. 调整右侧字体大小
  let currentFontSize = 16;
  const fontValEl = document.getElementById('font-size-val');
  document.getElementById('btn-inc').addEventListener('click', () => {
    if (currentFontSize < 32) {
      currentFontSize += 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });
  document.getElementById('btn-dec').addEventListener('click', () => {
    if (currentFontSize > 12) {
      currentFontSize -= 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });

  // 3. 选词精准定位与菜单显示
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;

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

  // -------------------------------------------------------------
  // 4. 高亮引擎 + 本地持久化 (localStorage)
  // -------------------------------------------------------------
  const isHighlightAPISupported = typeof CSS !== 'undefined' && CSS.highlights;
  let activeRanges = [];

  function updateHighlightRegistry() {
    if (isHighlightAPISupported) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
    // 每次高亮或清除变更时自动持久化保存
    saveHighlights();
  }

  // 获取节点在 contentEl 中的相对 DOM 路径
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

  // 根据 DOM 路径还原节点
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

  // 保存当前文件的所有高亮选区到 localStorage
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

  // 从 localStorage 读取并恢复高亮
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

  // 点击【高亮】按钮
  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;

    if (isHighlightAPISupported) {
      activeRanges.push(currentRange.cloneRange());
      updateHighlightRegistry();
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  // 点击【清除高亮】按钮
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const clearRange = selection.getRangeAt(0);

    if (isHighlightAPISupported) {
      let newRanges = [];

      activeRanges.forEach(existingRange => {
        // 判断清除选区与现有高亮是否有重叠
        if (
          clearRange.compareBoundaryPoints(Range.END_TO_START, existingRange) >= 0 ||
          clearRange.compareBoundaryPoints(Range.START_TO_END, existingRange) <= 0
        ) {
          newRanges.push(existingRange);
        } else {
          // 有交集，切除选区部分
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

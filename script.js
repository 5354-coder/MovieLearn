document.addEventListener('DOMContentLoaded', () => {
  // 1. 三级目录折叠与展开
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
        if (!res.ok) throw new Error('字幕文件未找到');
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
        // 切换文档时重置当前高亮
        clearAllHighlights();
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
  // 4. 高亮引擎（使用 Web 标准 Highlight API，不碰 DOM 节点）
  // -------------------------------------------------------------
  const isHighlightAPISupported = typeof CSS !== 'undefined' && CSS.highlights;
  let activeRanges = []; // 保存所有高亮的 Range 对象

  function updateHighlightRegistry() {
    if (isHighlightAPISupported) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
  }

  function clearAllHighlights() {
    activeRanges = [];
    if (isHighlightAPISupported) {
      CSS.highlights.delete('user-highlight');
    } else {
      contentEl.querySelectorAll('mark.user-highlight').forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
      });
    }
  }

  // 点击【高亮】按钮
  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;

    if (isHighlightAPISupported) {
      // 绝对不侵入/改变 DOM，直接将选区加入注册表
      activeRanges.push(currentRange.cloneRange());
      updateHighlightRegistry();
    } else {
      // 降级方案：跨节点安全包裹
      safeDomHighlight(currentRange);
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
      // 使用选区数学计算，将当前选区从已有的高亮 Range 中“切除”
      let newRanges = [];

      activeRanges.forEach(existingRange => {
        // 如果两个 Range 没有交集，保留原高亮
        if (
          clearRange.compareBoundaryPoints(Range.END_TO_START, existingRange) >= 0 ||
          clearRange.compareBoundaryPoints(Range.START_TO_END, existingRange) <= 0
        ) {
          newRanges.push(existingRange);
        } else {
          // 有交集，需要切分 existingRange
          // 1. 保留清除选区左边的部分
          if (clearRange.compareBoundaryPoints(Range.START_TO_START, existingRange) > 0) {
            const leftRange = existingRange.cloneRange();
            leftRange.setEnd(clearRange.startContainer, clearRange.startOffset);
            if (!leftRange.collapsed) newRanges.push(leftRange);
          }
          // 2. 保留清除选区右边的部分
          if (clearRange.compareBoundaryPoints(Range.END_TO_END, existingRange) < 0) {
            const rightRange = existingRange.cloneRange();
            rightRange.setStart(clearRange.endContainer, clearRange.endOffset);
            if (!rightRange.collapsed) newRanges.push(rightRange);
          }
        }
      });

      activeRanges = newRanges;
      updateHighlightRegistry();
    } else {
      // 降级清除方案
      contentEl.querySelectorAll('mark.user-highlight').forEach(mark => {
        if (selection.containsNode(mark, true)) {
          const parent = mark.parentNode;
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
          parent.removeChild(mark);
        }
      });
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  // 旧版浏览器降级高亮函数
  function safeDomHighlight(range) {
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToProcess = [];
    while (treeWalker.nextNode()) {
      nodesToProcess.push(treeWalker.currentNode);
    }

    nodesToProcess.forEach(node => {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);

      if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
        nodeRange.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) < 0) {
        nodeRange.setEnd(range.endContainer, range.endOffset);
      }

      if (!nodeRange.collapsed && nodeRange.toString().trim()) {
        const mark = document.createElement('mark');
        mark.className = 'user-highlight';
        try {
          nodeRange.surroundContents(mark);
        } catch (e) {
          // 忽略单个非法交界的文本节点包裹
        }
      }
    });
  }
});

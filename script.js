document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. 三级菜单展开/收起控制
  // ==========================================
  document.querySelectorAll('.tree-toggle').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentNode = toggleBtn.parentElement;
      parentNode.classList.toggle('open');
    });
  });

  // ==========================================
  // 2. 第三级目录跳转并加载字幕文件 (.md)
  // ==========================================
  const contentEl = document.getElementById('content');
  let currentFileSrc = '';

  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();

      // 设置选中状态样式
      document.querySelectorAll('.file-link').forEach(el => el.classList.remove('active'));
      link.classList.add('active');

      currentFileSrc = link.getAttribute('data-src');

      try {
        const response = await fetch(currentFileSrc);
        if (!response.ok) {
          throw new Error(`无法加载文件: ${response.status}`);
        }
        const markdownText = await response.text();
        
        // 渲染 Markdown
        contentEl.innerHTML = marked.parse(markdownText);
        // 强制重新应用当前的字号
        applyFontSize(currentFontSize);

        // 尝试从 localStorage 还原高亮记录
        loadHighlightsForCurrentFile();

      } catch (err) {
        contentEl.innerHTML = `<p style="color: #e53e3e; text-align: center;">⚠️ 加载字幕失败：${err.message}<br>请确保本地已有对应路径的文件。</p>`;
      }
    });
  });

  // ==========================================
  // 3. 右上角文章字号独立调整功能
  // ==========================================
  let currentFontSize = 16; // 默认 16px
  const fontIndicator = document.getElementById('font-size-indicator');

  function applyFontSize(size) {
    contentEl.style.fontSize = `${size}px`;
    fontIndicator.textContent = `${size}px`;
  }

  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    if (currentFontSize < 32) {
      currentFontSize += 2;
      applyFontSize(currentFontSize);
    }
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    if (currentFontSize > 12) {
      currentFontSize -= 2;
      applyFontSize(currentFontSize);
    }
  });

  // ==========================================
  // 4. 双击选词 / 拖拽选区 + 选区上方居中浮动菜单
  // ==========================================
  const menuEl = document.getElementById('selection-menu');
  let savedRange = null;

  document.addEventListener('mouseup', handleSelectionUpdate);
  document.addEventListener('keyup', handleSelectionUpdate);

  function handleSelectionUpdate(e) {
    if (menuEl.contains(e.target)) return;

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      menuEl.classList.add('hidden');
      return;
    }

    if (!contentEl.contains(selection.anchorNode)) {
      menuEl.classList.add('hidden');
      return;
    }

    savedRange = selection.getRangeAt(0).cloneRange();
    const rect = savedRange.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      menuEl.classList.add('hidden');
      return;
    }

    menuEl.classList.remove('hidden');
    const menuWidth = menuEl.offsetWidth;
    const menuHeight = menuEl.offsetHeight;

    let left = rect.left + (rect.width / 2) - (menuWidth / 2);
    let top = rect.top - menuHeight - 10;

    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (top < 10) {
      top = rect.bottom + 10;
    }

    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${top}px`;
  }

  document.addEventListener('mousedown', (e) => {
    if (!menuEl.contains(e.target) && !contentEl.contains(e.target)) {
      menuEl.classList.add('hidden');
    }
  });

  // ==========================================
  // 5. 高亮与记忆存储算法（CSS Custom Highlight + localStorage）
  // ==========================================
  let activeRanges = [];

  function updateCSSHighlight() {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
  }

  // --- Range 坐标序列化与反序列化（基于纯文本字符位置偏移） ---
  function getRangeOffset(range, root) {
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(root);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;

    return {
      start: start,
      end: start + range.toString().length
    };
  }

  function createRangeFromOffset(root, startOffset, endOffset) {
    let charCount = 0;
    const range = document.createRange();
    range.setStart(root, 0);
    range.collapse(true);

    const nodeStack = [root];
    let node, foundStart = false, foundEnd = false;

    while (!foundEnd && (node = nodeStack.pop())) {
      if (node.nodeType === 3) { // 文本节点
        const nextCharCount = charCount + node.length;
        if (!foundStart && startOffset >= charCount && startOffset <= nextCharCount) {
          range.setStart(node, startOffset - charCount);
          foundStart = true;
        }
        if (foundStart && endOffset >= charCount && endOffset <= nextCharCount) {
          range.setEnd(node, endOffset - charCount);
          foundEnd = true;
        }
        charCount = nextCharCount;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
    return range;
  }

  // --- 保存到 localStorage ---
  function saveHighlightsForCurrentFile() {
    if (!currentFileSrc) return;
    const serializedData = activeRanges.map(range => getRangeOffset(range, contentEl));
    localStorage.setItem(`subtitle_highlights_${currentFileSrc}`, JSON.stringify(serializedData));
  }

  // --- 从 localStorage 恢复 ---
  function loadHighlightsForCurrentFile() {
    activeRanges = [];
    if (!currentFileSrc) {
      updateCSSHighlight();
      return;
    }

    const dataStr = localStorage.getItem(`subtitle_highlights_${currentFileSrc}`);
    if (dataStr) {
      try {
        const offsets = JSON.parse(dataStr);
        offsets.forEach(offset => {
          const range = createRangeFromOffset(contentEl, offset.start, offset.end);
          if (range) activeRanges.push(range);
        });
      } catch (err) {
        console.error("加载持久化高亮失败:", err);
      }
    }
    updateCSSHighlight();
  }

  // --- 点击“高亮” ---
  document.getElementById('btn-do-highlight').addEventListener('click', () => {
    if (!savedRange || savedRange.collapsed) return;

    activeRanges.push(savedRange.cloneRange());
    updateCSSHighlight();
    saveHighlightsForCurrentFile(); // 写入存储

    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

  // --- 点击“清除高亮” ---
  document.getElementById('btn-remove-highlight').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const clearRange = selection.getRangeAt(0);
    let newRanges = [];

    activeRanges.forEach(existingRange => {
      // 若无重叠则直接保留
      if (
        clearRange.compareBoundaryPoints(Range.END_TO_START, existingRange) >= 0 ||
        clearRange.compareBoundaryPoints(Range.START_TO_END, existingRange) <= 0
      ) {
        newRanges.push(existingRange);
      } else {
        // 拆分切除选区重叠部分
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
    updateCSSHighlight();
    saveHighlightsForCurrentFile(); // 写入存储

    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

});

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
  // 2. 第三级目录跳转、记忆与精准位置定位
  // ==========================================
  const contentEl = document.getElementById('content');
  let currentFileSrc = '';

  // 核心业务：加载指定的字幕文件
  async function loadSubtitleFile(fileSrc, isInitialLoad = false) {
    const link = document.querySelector(`.file-link[data-src="${fileSrc}"]`);
    if (!link) return;

    // 更新菜单激活态
    document.querySelectorAll('.file-link').forEach(el => el.classList.remove('active'));
    link.classList.add('active');

    // 确保所在季度的父级菜单被展开
    let parentNode = link.closest('.tree-node');
    while (parentNode) {
      parentNode.classList.add('open');
      parentNode = parentNode.parentElement.closest('.tree-node');
    }

    currentFileSrc = fileSrc;
    localStorage.setItem('last_opened_file', fileSrc); // 记住当前文件

    try {
      const response = await fetch(fileSrc);
      if (!response.ok) throw new Error(`无法加载文件: ${response.status}`);
      
      const markdownText = await response.text();
      contentEl.innerHTML = marked.parse(markdownText);
      applyFontSize(currentFontSize);

      // 还原高亮记录
      loadHighlightsForCurrentFile();

      // 记忆跳转：恢复上次滚动阅读高度
      const savedScrollTop = localStorage.getItem(`scroll_pos_${fileSrc}`);
      if (savedScrollTop) {
        // 稍作延迟确保 DOM 渲染计算完毕后精准滚动
        setTimeout(() => {
          contentEl.scrollTop = parseInt(savedScrollTop, 10);
        }, 50);
      } else {
        contentEl.scrollTop = 0;
      }

    } catch (err) {
      contentEl.innerHTML = `<p style="color: #e53e3e; text-align: center;">⚠️ 加载字幕失败：${err.message}<br>请确保本地已有对应路径的文件。</p>`;
    }
  }

  // 监听目录菜单点击
  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const fileSrc = link.getAttribute('data-src');
      loadSubtitleFile(fileSrc);
    });
  });

  // 监听右侧区域滚动，并防抖记忆当前的滚动位置
  let scrollTimer = null;
  contentEl.addEventListener('scroll', () => {
    if (!currentFileSrc) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      localStorage.setItem(`scroll_pos_${currentFileSrc}`, contentEl.scrollTop);
    }, 200);
  });

  // 自动还原：打开页面时加载上次关闭前看到的文件
  const lastOpenedFile = localStorage.getItem('last_opened_file');
  if (lastOpenedFile) {
    loadSubtitleFile(lastOpenedFile, true);
  }

  // ==========================================
  // 3. 右上角悬浮字号独立调整功能
  // ==========================================
  let currentFontSize = parseInt(localStorage.getItem('user_font_size') || '16', 10);
  const fontIndicator = document.getElementById('font-size-indicator');

  function applyFontSize(size) {
    contentEl.style.fontSize = `${size}px`;
    fontIndicator.textContent = `${size}px`;
    localStorage.setItem('user_font_size', size);
  }

  applyFontSize(currentFontSize);

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
  // 5. 高亮与持久化（CSS Custom Highlight + localStorage）
  // ==========================================
  let activeRanges = [];

  function updateCSSHighlight() {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
  }

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
      if (node.nodeType === 3) {
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

  function saveHighlightsForCurrentFile() {
    if (!currentFileSrc) return;
    const serializedData = activeRanges.map(range => getRangeOffset(range, contentEl));
    localStorage.setItem(`subtitle_highlights_${currentFileSrc}`, JSON.stringify(serializedData));
  }

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

  // 点击“高亮”
  document.getElementById('btn-do-highlight').addEventListener('click', () => {
    if (!savedRange || savedRange.collapsed) return;

    activeRanges.push(savedRange.cloneRange());
    updateCSSHighlight();
    saveHighlightsForCurrentFile();

    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

  // 点击“清除高亮”
  document.getElementById('btn-remove-highlight').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const clearRange = selection.getRangeAt(0);
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
    updateCSSHighlight();
    saveHighlightsForCurrentFile();

    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

});

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
  
  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();

      // 设置选中状态样式
      document.querySelectorAll('.file-link').forEach(el => el.classList.remove('active'));
      link.classList.add('active');

      const fileSrc = link.getAttribute('data-src');

      try {
        const response = await fetch(fileSrc);
        if (!response.ok) {
          throw new Error(`无法加载文件: ${response.status}`);
        }
        const markdownText = await response.text();
        
        // 切换文章时，清空之前的高亮集合
        activeRanges = [];
        updateCSSHighlight();

        // 渲染 Markdown
        contentEl.innerHTML = marked.parse(markdownText);
        // 强制重新应用当前的字号
        applyFontSize(currentFontSize);
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

  // 监听选区变化与鼠标抬起
  document.addEventListener('mouseup', handleSelectionUpdate);
  document.addEventListener('keyup', handleSelectionUpdate);

  function handleSelectionUpdate(e) {
    // 如果点击的是菜单本身，不关闭菜单
    if (menuEl.contains(e.target)) return;

    const selection = window.getSelection();

    // 如果未选中内容，或选中的文本为空，隐藏菜单
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      menuEl.classList.add('hidden');
      return;
    }

    // 确保选区在右侧文章内容区域内部
    if (!contentEl.contains(selection.anchorNode)) {
      menuEl.classList.add('hidden');
      return;
    }

    // 保存当前的选区 Range
    savedRange = selection.getRangeAt(0).cloneRange();
    const rect = savedRange.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      menuEl.classList.add('hidden');
      return;
    }

    // 计算菜单位置：选区顶部水平居中
    menuEl.classList.remove('hidden');
    const menuWidth = menuEl.offsetWidth;
    const menuHeight = menuEl.offsetHeight;

    let left = rect.left + (rect.width / 2) - (menuWidth / 2);
    let top = rect.top - menuHeight - 10; // 选区上方留出 10px 间距

    // 边缘安全检查
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (top < 10) {
      top = rect.bottom + 10; // 上方空间不足转到下方
    }

    menuEl.style.left = `${left}px`;
    menuEl.style.top = `${top}px`;
  }

  // 点击页面空白处隐藏菜单
  document.addEventListener('mousedown', (e) => {
    if (!menuEl.contains(e.target) && !contentEl.contains(e.target)) {
      menuEl.classList.add('hidden');
    }
  });

  // ==========================================
  // 5. 高亮与清除高亮（基于 CSS Custom Highlight API，零修改 DOM，绝对不吞字）
  // ==========================================
  let activeRanges = [];

  function updateCSSHighlight() {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      const userHighlight = new Highlight(...activeRanges);
      CSS.highlights.set('user-highlight', userHighlight);
    }
  }

  // 点击“高亮”
  document.getElementById('btn-do-highlight').addEventListener('click', () => {
    if (!savedRange || savedRange.collapsed) return;

    activeRanges.push(savedRange.cloneRange());
    updateCSSHighlight();

    // 清除当前的鼠标蓝底选中状态，显示高亮
    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

  // 点击“清除高亮”
  document.getElementById('btn-remove-highlight').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const clearRange = selection.getRangeAt(0);
    let newRanges = [];

    // 对已有高亮选区进行物理裁切/拆分，移除覆盖区域
    activeRanges.forEach(existingRange => {
      // 如果完全不相交，直接保留
      if (
        clearRange.compareBoundaryPoints(Range.END_TO_START, existingRange) >= 0 ||
        clearRange.compareBoundaryPoints(Range.START_TO_END, existingRange) <= 0
      ) {
        newRanges.push(existingRange);
      } else {
        // 如果左侧有重叠外的部分，保留左侧
        if (clearRange.compareBoundaryPoints(Range.START_TO_START, existingRange) > 0) {
          const leftRange = existingRange.cloneRange();
          leftRange.setEnd(clearRange.startContainer, clearRange.startOffset);
          if (!leftRange.collapsed) newRanges.push(leftRange);
        }
        // 如果右侧有重叠外的部分，保留右侧
        if (clearRange.compareBoundaryPoints(Range.END_TO_END, existingRange) < 0) {
          const rightRange = existingRange.cloneRange();
          rightRange.setStart(clearRange.endContainer, clearRange.endOffset);
          if (!rightRange.collapsed) newRanges.push(rightRange);
        }
      }
    });

    activeRanges = newRanges;
    updateCSSHighlight();

    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

});

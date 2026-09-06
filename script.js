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
    // 仅作用于右侧文章内容区
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

    // 边缘安全检查（防止菜单超出屏幕四周）
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (top < 10) {
      top = rect.bottom + 10; // 若上方空间不足，转显示在选区下方
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
  // 5. 高亮与清除高亮（绝不吞字的核心 DOM 算法）
  // ==========================================

  // A. 执行高亮
  document.getElementById('btn-do-highlight').addEventListener('click', () => {
    if (!savedRange || savedRange.collapsed) return;

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);

    const markNode = document.createElement('mark');
    markNode.className = 'highlight';

    try {
      // 用 mark 节点包裹选区内容
      markNode.appendChild(savedRange.extractContents());
      savedRange.insertNode(markNode);
    } catch (err) {
      console.warn('高亮跨越了复杂的 DOM 结构，回退到降级处理', err);
    }

    // 清理选择状态并隐藏菜单
    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

  // B. 执行清除高亮（防吞字：还原原文字）
  document.getElementById('btn-remove-highlight').addEventListener('click', () => {
    if (!savedRange) return;

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);

    // 找出选区涉及到的所有高亮 mark 标签
    const highlights = contentEl.querySelectorAll('mark.highlight');

    highlights.forEach(mark => {
      // 判断高亮标签是否与选区存在相交关系
      if (selection.containsNode(mark, true)) {
        const parent = mark.parentNode;
        // 将高亮标签内的所有子节点（文本/标签）移动到外面
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        // 安全移除 mark 标签本身
        parent.removeChild(mark);
        // 合并相邻的纯文本节点，防止 DOM 碎裂
        parent.normalize();
      }
    });

    // 清理选择状态并隐藏菜单
    window.getSelection().removeAllRanges();
    menuEl.classList.add('hidden');
  });

});

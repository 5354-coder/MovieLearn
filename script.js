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

  // 3. 选词精准定位与半透明菜单
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;

  // 监听 mouseup 确保选词/双击动作完成后精准计算位置
  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('keyup', handleSelection);

  function handleSelection(e) {
    // 如果点击在菜单本身的按钮上，不触发重新计算或隐藏逻辑
    if (menu.contains(e.target)) return;

    const selection = window.getSelection();

    // 如果没有选中文本或选区为空，隐藏菜单
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      menu.classList.add('hidden');
      return;
    }

    // 限制只能在右侧字幕内容区触发选词
    if (!contentEl.contains(selection.anchorNode)) {
      menu.classList.add('hidden');
      return;
    }

    currentRange = selection.getRangeAt(0);
    const rect = currentRange.getBoundingClientRect();

    // 如果未获取到有效尺寸，隐藏菜单
    if (rect.width === 0 || rect.height === 0) {
      menu.classList.add('hidden');
      return;
    }

    // 计算选中文本顶部的水平中心位置 (Viewport 物理视口坐标)
    const centerX = rect.left + (rect.width / 2);
    const topY = rect.top;

    // 先显示以获取真实宽高
    menu.classList.remove('hidden');
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    // 计算菜单最终坐标（顶部居中，向上偏离 8px）
    let leftPos = centerX - (menuWidth / 2);
    let topPos = topY - menuHeight - 8;

    // 防止弹出菜单超出屏幕左侧或右侧边界
    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > window.innerWidth - 10) {
      leftPos = window.innerWidth - menuWidth - 10;
    }

    // 如果选中文本靠顶部太近，将菜单放在文本下方
    if (topPos < 10) {
      topPos = rect.bottom + 8;
    }

    menu.style.left = `${leftPos}px`;
    menu.style.top = `${topPos}px`;
  }

  // 点击页面其他无文字空白区域时隐藏菜单
  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target) && !contentEl.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // 解包辅助函数：清除 mark 标签但保留文本内容
  function unwrapMark(mark) {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }

  // 4. 高亮功能实现
  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;

    const mark = document.createElement('mark');
    mark.className = 'user-highlight';

    try {
      currentRange.surroundContents(mark);
    } catch (e) {
      // 应对跨节点选中的情况
      const fragment = currentRange.extractContents();
      mark.appendChild(fragment);
      currentRange.insertNode(mark);
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  // 5. 增强版清除高亮功能（支持多选、局部清除与历史高亮）
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    // 查找选区范围内的所有高亮节点
    const container = range.commonAncestorContainer;
    const parentEl = container.nodeType === 3 ? container.parentElement : container;
    const allMarks = Array.from(parentEl.querySelectorAll('mark.user-highlight'));

    let cleared = false;

    // A. 清除完全包含或相交的高亮块
    allMarks.forEach(mark => {
      if (selection.containsNode(mark, true)) {
        unwrapMark(mark);
        cleared = true;
      }
    });

    // B. 若未匹配到完整/跨节点 mark（说明是光标在单块高亮内，或只选了高亮的一小部分）
    if (!cleared) {
      let node = selection.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      const markEl = node ? node.closest('mark.user-highlight') : null;

      if (markEl) {
        // 提取选中的部分，剥离高亮后重新插回
        const extracted = range.extractContents();
        const innerMarks = extracted.querySelectorAll ? extracted.querySelectorAll('mark.user-highlight') : [];
        innerMarks.forEach(m => unwrapMark(m));

        range.insertNode(extracted);

        // 如果原来的 mark 已经空了，将其删除
        if (markEl.textContent.trim() === '') {
          unwrapMark(markEl);
        }
      }
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

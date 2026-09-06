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

  // 3. 选词精准定位与弹出菜单
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;

  // 监听 mouseup 确保选词/双击动作完成后精准计算位置
  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('keyup', handleSelection);

  function handleSelection(e) {
    // 如果点击在菜单本身的按钮上，不触发隐藏逻辑
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

    // 先移除 hidden 以获取真实渲染宽高
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

  // 点击页面其他无文字区域时隐藏菜单
  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target) && !contentEl.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

 // 4. 增强版清除高亮功能（支持清除部分高亮、跨节点高亮及历史高亮）
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    // 辅助函数：将指定的 mark 元素解包（清除高亮样式，保留内部文本）
    function unwrapMark(mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }

    // A. 先检查选区内包含的所有 <mark.user-highlight> 节点（应对一次选中多个高亮的情况）
    const container = range.commonAncestorContainer;
    const parentEl = container.nodeType === 3 ? container.parentElement : container;
    const allMarks = Array.from(parentEl.querySelectorAll('mark.user-highlight'));

    let clearedCount = 0;
    allMarks.forEach(mark => {
      // 判断该 mark 是否与当前选区有重叠/被包含
      if (selection.containsNode(mark, true)) {
        unwrapMark(mark);
        clearedCount++;
      }
    });

    // B. 如果没有包含完整的 mark 节点，说明可能是光标停留在高亮内部，或者只选中了高亮的一部分
    if (clearedCount === 0) {
      let node = selection.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      const markEl = node ? node.closest('mark.user-highlight') : null;

      if (markEl) {
        // 使用 CSS 提取与重新包裹策略，仅将选中的文字移除 mark 标签
        const markRange = document.createRange();
        markRange.selectNodeContents(markEl);

        const startComp = range.compareBoundaryPoints(Range.START_TO_START, markRange);
        const endComp = range.compareBoundaryPoints(Range.END_TO_END, markRange);

        // 情况 1: 选中了这块高亮文件的全部
        if (startComp <= 0 && endComp >= 0) {
          unwrapMark(markEl);
        } else {
          // 情况 2: 只选中了这块高亮的一部分 -> 提取选中的文本，把选中的部分设为非高亮
          const extracted = range.extractContents(); // 提取被选中的部分
          
          // 清除提取出来的文档片段里的 mark 标签
          const innerMarks = extracted.querySelectorAll ? extracted.querySelectorAll('mark.user-highlight') : [];
          innerMarks.forEach(m => unwrapMark(m));

          // 将提取部分重新插入
          range.insertNode(extracted);

          // 清理可能产生的空 mark 标签
          if (markEl.textContent === '') {
            unwrapMark(markEl);
          }
        }
      }
    }

    // 清除选区状态与浮动菜单
    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

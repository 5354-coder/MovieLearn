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

    currentRange = selection.getRangeAt(0);
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

  // 辅助函数：解包 mark 标签但保留文本内容
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
      const fragment = currentRange.extractContents();
      mark.appendChild(fragment);
      currentRange.insertNode(mark);
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  // 5. 零丢字、无 Bug 的精准局部/全部清除高亮功能
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    // 辅助函数：安全地移除某个 mark 节点对 range 选区的包含，仅去掉高亮样式
    function safeClearMarkInRange(mark, range) {
      const markRange = document.createRange();
      markRange.selectNodeContents(mark);

      const isStartBefore = range.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0;
      const isEndAfter = range.compareBoundaryPoints(Range.END_TO_END, markRange) >= 0;

      // 1. 如果选区完全覆盖了这个高亮 -> 直接解除 mark 包裹
      if (isStartBefore && isEndAfter) {
        unwrapMark(mark);
        return;
      }

      // 2. 如果只选中了高亮的一部分 -> 提取内部文本并重构，保证不掉字
      const parent = mark.parentNode;
      const text = mark.textContent;
      
      // 计算选区相对于当前 mark 文本的起始和结束字符索引
      let startIdx = 0;
      let endIdx = text.length;

      if (range.startContainer === mark.firstChild) {
        startIdx = range.startOffset;
      } else if (!isStartBefore) {
        startIdx = 0;
      }

      if (range.endContainer === mark.firstChild) {
        endIdx = range.endOffset;
      }

      // 防止索引超界
      startIdx = Math.max(0, Math.min(startIdx, text.length));
      endIdx = Math.max(startIdx, Math.min(endIdx, text.length));

      const before = text.substring(0, startIdx);
      const selected = text.substring(startIdx, endIdx);
      const after = text.substring(endIdx);

      const frag = document.createDocumentFragment();

      // 前半段：保留高亮
      if (before) {
        const m1 = document.createElement('mark');
        m1.className = 'user-highlight';
        m1.textContent = before;
        frag.appendChild(m1);
      }

      // 被选中清除的中间段：作为纯文本（去高亮）
      if (selected) {
        frag.appendChild(document.createTextNode(selected));
      }

      // 后半段（如 hello world 里面的 rld）：保留高亮
      if (after) {
        const m2 = document.createElement('mark');
        m2.className = 'user-highlight';
        m2.textContent = after;
        frag.appendChild(m2);
      }

      // 用全新的节点集安全的替换掉旧 mark，字符一个不少
      parent.insertBefore(frag, mark);
      parent.removeChild(mark);
    }

    // 获取选区涉及的容器元素
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;

    // 获取所有的 mark 节点
    let marks = Array.from(ancestor.querySelectorAll('mark.user-highlight'));
    
    // 如果选区本身就在一个 mark 内部
    const closestMark = ancestor.closest('mark.user-highlight');
    if (closestMark && !marks.includes(closestMark)) {
      marks.push(closestMark);
    }

    // 筛选出确实与当前鼠标选区重叠的 mark 节点进行处理
    marks.forEach(mark => {
      if (selection.containsNode(mark, true)) {
        safeClearMarkInRange(mark, range);
      }
    });

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

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

  // 解包辅助函数：清除单个 mark 标签但保留内部文本
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

  // 5. 精准部分清除高亮功能（完美支持切割高亮节点）
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parentEl = container.nodeType === 3 ? container.parentElement : container;
    
    // 寻找选区内涉及的所有 <mark> 标签
    const allMarks = Array.from(parentEl.querySelectorAll('mark.user-highlight'));

    allMarks.forEach(mark => {
      // 如果 mark 与当前选区有交集
      if (selection.containsNode(mark, true)) {
        const markRange = document.createRange();
        markRange.selectNodeContents(mark);

        const startOverlap = range.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0;
        const endOverlap = range.compareBoundaryPoints(Range.END_TO_END, markRange) >= 0;

        // 情况 1：选中区域完全覆盖了该高亮块 -> 直接整个取消高亮
        if (startOverlap && endOverlap) {
          unwrapMark(mark);
        } else {
          // 情况 2：只选中了该高亮块的一部分 -> 进行 DOM 节点切分
          const textNode = mark.firstChild;
          if (textNode && textNode.nodeType === 3) {
            const textContent = textNode.nodeValue;
            
            // 计算选区相对于当前 mark 内部文本的起止偏移量
            let startOffset = 0;
            let endOffset = textContent.length;

            if (range.startContainer === textNode) {
              startOffset = range.startOffset;
            } else if (range.compareBoundaryPoints(Range.START_TO_START, markRange) > 0) {
              startOffset = 0;
            }

            if (range.endContainer === textNode) {
              endOffset = range.endOffset;
            }

            // 切分为三段：前保留高亮部分、中清除部分、后保留高亮部分
            const beforeText = textContent.slice(0, startOffset);
            const clearedText = textContent.slice(startOffset, endOffset);
            const afterText = textContent.slice(endOffset);

            const fragment = document.createDocumentFragment();

            // 前半部分（保留高亮）
            if (beforeText) {
              const beforeMark = document.createElement('mark');
              beforeMark.className = 'user-highlight';
              beforeMark.textContent = beforeText;
              fragment.appendChild(beforeMark);
            }

            // 中间选中的部分（取消高亮，直接作为普通文本节点）
            if (clearedText) {
              fragment.appendChild(document.createTextNode(clearedText));
            }

            // 后半部分（保留高亮，如 hello world 里的 rld）
            if (afterText) {
              const afterMark = document.createElement('mark');
              afterMark.className = 'user-highlight';
              afterMark.textContent = afterText;
              fragment.appendChild(afterMark);
            }

            // 用新生成的节点替换旧的 mark 节点
            mark.parentNode.replaceChild(fragment, mark);
          } else {
            // 兜底降级处理
            unwrapMark(mark);
          }
        }
      }
    });

    // 如果选区在单个 mark 内部，且没被上面的全集 selector 匹配到的情况
    let singleNode = selection.anchorNode;
    if (singleNode && singleNode.nodeType === 3) singleNode = singleNode.parentNode;
    const singleMark = singleNode ? singleNode.closest('mark.user-highlight') : null;
    
    if (singleMark && !allMarks.includes(singleMark)) {
      const textNode = singleMark.firstChild;
      if (textNode && textNode.nodeType === 3) {
        const textContent = textNode.nodeValue;
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;

        const beforeText = textContent.slice(0, startOffset);
        const clearedText = textContent.slice(startOffset, endOffset);
        const afterText = textContent.slice(endOffset);

        const fragment = document.createDocumentFragment();

        if (beforeText) {
          const beforeMark = document.createElement('mark');
          beforeMark.className = 'user-highlight';
          beforeMark.textContent = beforeText;
          fragment.appendChild(beforeMark);
        }

        if (clearedText) {
          fragment.appendChild(document.createTextNode(clearedText));
        }

        if (afterText) {
          const afterMark = document.createElement('mark');
          afterMark.className = 'user-highlight';
          afterMark.textContent = afterText;
          fragment.appendChild(afterMark);
        }

        singleMark.parentNode.replaceChild(fragment, singleMark);
      }
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

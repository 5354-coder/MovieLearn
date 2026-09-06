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

  // 4. 高亮功能实现
  document.getElementById('btn-highlight').addEventListener('click', () => {
    if (!currentRange) return;

    const mark = document.createElement('mark');
    mark.className = 'user-highlight';

    try {
      currentRange.surroundContents(mark);
    } catch (e) {
      // 跨段落/跨多行时的安全包裹
      const fragment = currentRange.extractContents();
      mark.appendChild(fragment);
      currentRange.insertNode(mark);
    }

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });

  // 5. 跨行/多行安全清除高亮（100% 绝不吞字）
  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;

    // 查找选区覆盖到的所有 mark 节点
    let marks = Array.from(ancestor.querySelectorAll('mark.user-highlight'));
    const closestMark = ancestor.closest('mark.user-highlight');
    if (closestMark && !marks.includes(closestMark)) {
      marks.push(closestMark);
    }

    marks.forEach(mark => {
      if (selection.containsNode(mark, true)) {
        const markRange = document.createRange();
        markRange.selectNodeContents(mark);

        const isStartBefore = range.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0;
        const isEndAfter = range.compareBoundaryPoints(Range.END_TO_END, markRange) >= 0;

        if (isStartBefore && isEndAfter) {
          // 情况 A: 选区彻底覆盖了这个 mark -> 移除 mark 标签，保留内容
          const parent = mark.parentNode;
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
        } else {
          // 情况 B: 部分选中 mark（单行或多行）-> 使用 CSS 范围提取技术安全剥离，绝不丢字
          try {
            const subRange = range.cloneRange();
            
            // 限制裁剪范围严格在当前 mark 内部
            if (subRange.compareBoundaryPoints(Range.START_TO_START, markRange) < 0) {
              subRange.setStart(markRange.startContainer, markRange.startOffset);
            }
            if (subRange.compareBoundaryPoints(Range.END_TO_END, markRange) > 0) {
              subRange.setEnd(markRange.endContainer, markRange.endOffset);
            }

            // 提取被选中的部分
            const extracted = subRange.extractContents();
            
            // 将提取出来的片段中的 mark 标签全解包
            const innerMarks = extracted.querySelectorAll ? Array.from(extracted.querySelectorAll('mark.user-highlight')) : [];
            innerMarks.forEach(m => {
              const p = m.parentNode;
              while (m.firstChild) p.insertBefore(m.firstChild, m);
              p.removeChild(m);
            });

            // 重新插回提取位置
            subRange.insertNode(extracted);

            // 清理可能产生的空 mark 标签
            if (mark.textContent.trim() === '') {
              mark.parentNode.removeChild(mark);
            }
          } catch (err) {
            // 兜底方案：如果跨行 DOM 极为复杂，直接安全解包 mark，确保文本不丢失
            const parent = mark.parentNode;
            if (parent) {
              while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
              parent.removeChild(mark);
            }
          }
        }
      }
    });

    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

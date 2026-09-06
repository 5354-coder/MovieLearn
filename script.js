document.addEventListener('DOMContentLoaded', () => {
  // 1. 三级目录折叠与展开
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.parentElement.classList.toggle('open');
    });
  });

  // 加载 MD 文件
  const contentEl = document.getElementById('content');
  const mainContent = document.querySelector('.main-content'); // 获取右侧滚动容器

  document.querySelectorAll('.file-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const filePath = link.getAttribute('data-src');
      try {
        const res = await fetch(filePath);
        if(!res.ok) throw new Error('字幕文件未找到');
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
    if(currentFontSize < 32) {
      currentFontSize += 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });
  document.getElementById('btn-dec').addEventListener('click', () => {
    if(currentFontSize > 12) {
      currentFontSize -= 2;
      contentEl.style.fontSize = currentFontSize + 'px';
      fontValEl.textContent = currentFontSize + 'px';
    }
  });

  // 3. 选词定位与半透明菜单（精准居中修正版）
  const menu = document.getElementById('highlight-menu');
  let currentRange = null;

  document.addEventListener('selectionchange', handleSelection);

  function handleSelection() {
    const selection = window.getSelection();
    
    // 如果没有选中文字，隐藏菜单
    if (selection.isCollapsed || !selection.toString().trim()) {
      menu.classList.add('hidden');
      return;
    }

    const anchorNode = selection.anchorNode;
    // 限制只能在右侧字幕内容区触发选词
    if (!contentEl.contains(anchorNode)) return;

    currentRange = selection.getRangeAt(0);
    const rangeRect = currentRange.getBoundingClientRect();
    const containerRect = mainContent.getBoundingClientRect();

    // 如果选中文本完全不在视口内，隐藏菜单
    if (rangeRect.width === 0 && rangeRect.height === 0) return;

    // 计算相对于右侧主容器（.main-content）的居中位置
    // 水平居中：选中文本的中心点 - 容器左边距 - 菜单本身一半宽度
    const menuWidth = menu.offsetWidth || 120; // 初始宽度容错
    const menuHeight = menu.offsetHeight || 35;
    
    const textCenterX = rangeRect.left + (rangeRect.width / 2);
    const leftPos = textCenterX - containerRect.left - (menuWidth / 2) + mainContent.scrollLeft;

    // 垂直位置：放在选中文本上方 8px 处
    const topPos = rangeRect.top - containerRect.top - menuHeight - 8 + mainContent.scrollTop;

    menu.style.left = `${leftPos}px`;
    menu.style.top = `${topPos}px`;
    menu.classList.remove('hidden');
  }

  // 4. 高亮与清除高亮
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

  document.getElementById('btn-clear').addEventListener('click', () => {
    const selection = window.getSelection();
    let node = selection.anchorNode;
    if (node) {
      if (node.nodeType === 3) node = node.parentNode;
      const markEl = node.closest('mark.user-highlight');
      if (markEl) {
        const parent = markEl.parentNode;
        while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
        parent.removeChild(markEl);
      }
    }
    window.getSelection().removeAllRanges();
    menu.classList.add('hidden');
  });
});

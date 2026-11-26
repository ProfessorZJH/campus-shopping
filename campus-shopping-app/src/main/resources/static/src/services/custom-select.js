/**
 * 大厂级（飞书 / Arco / Ant Design 风格）全局下拉选择器增强层：
 * - 保留真实 <select> 节点在 DOM 中，100% 兼容表单语义与自动化 select_option()；
 * - 真实用户鼠标点击或键盘展开时拦截丑陋的系统原生弹窗，渲染丝滑浮层菜单（超过 6 项自动提供搜索过滤）。
 */
export function installCustomSelects() {
  if (typeof window === 'undefined' || window.__campusCustomSelectInstalled) return;
  window.__campusCustomSelectInstalled = true;

  let activeSelect = null;
  let popoverEl = null;
  let listEl = null;
  let searchInputEl = null;
  let activeIndex = -1;
  let visibleOptions = [];

  function closePopover({ restoreFocus = false } = {}) {
    if (!popoverEl) return;
    const prev = activeSelect;
    if (prev) prev.classList.remove('cs-select-open');
    popoverEl.remove();
    popoverEl = null;
    listEl = null;
    searchInputEl = null;
    activeSelect = null;
    activeIndex = -1;
    visibleOptions = [];
    if (restoreFocus && prev && prev.isConnected) {
      prev.focus();
    }
  }

  function commitChoice(optionEl) {
    if (!activeSelect || !optionEl || optionEl.disabled) return;
    const target = activeSelect;
    const nextVal = optionEl.value;
    const changed = target.value !== nextVal;
    target.value = nextVal;
    closePopover({ restoreFocus: true });
    if (changed) {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function highlightItem(idx) {
    if (!listEl || !visibleOptions.length) return;
    const clamped = Math.max(0, Math.min(visibleOptions.length - 1, idx));
    activeIndex = clamped;
    const nodes = listEl.querySelectorAll('.cs-select-option');
    nodes.forEach((node, i) => {
      node.classList.toggle('is-highlighted', i === clamped);
      if (i === clamped) {
        node.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function renderOptions(filterText = '') {
    if (!activeSelect || !listEl) return;
    const q = String(filterText || '')
      .trim()
      .toLowerCase();
    const all = [...activeSelect.options];
    visibleOptions = all.filter((opt) => {
      if (opt.disabled && opt.value === '') return false;
      if (!q) return true;
      return (opt.textContent || '').toLowerCase().includes(q);
    });

    listEl.innerHTML = '';
    if (!visibleOptions.length) {
      const empty = document.createElement('div');
      empty.className = 'cs-select-empty';
      empty.textContent = '无匹配选项';
      listEl.appendChild(empty);
      activeIndex = -1;
      return;
    }

    const currentVal = activeSelect.value;
    let selectedIdx = 0;
    visibleOptions.forEach((opt, idx) => {
      const isSelected = opt.value === currentVal;
      if (isSelected) selectedIdx = idx;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-select-option' + (isSelected ? ' is-selected' : '');
      btn.disabled = opt.disabled;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');

      const label = document.createElement('span');
      label.className = 'cs-select-option-label';
      label.textContent = (opt.textContent || '').trim();
      btn.appendChild(label);

      if (isSelected) {
        const check = document.createElement('span');
        check.className = 'cs-select-option-check';
        check.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.appendChild(check);
      }

      btn.addEventListener('mouseenter', () => highlightItem(idx));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        commitChoice(opt);
      });
      listEl.appendChild(btn);
    });
    highlightItem(selectedIdx);
  }

  function positionPopover() {
    if (!activeSelect || !popoverEl) return;
    const anchor = activeSelect.closest('.topbar-merchant-select') || activeSelect;
    const rect = anchor.getBoundingClientRect();
    const minW = Math.max(rect.width, 176);
    popoverEl.style.minWidth = `${Math.round(minW)}px`;
    popoverEl.style.maxWidth = `${Math.min(420, window.innerWidth - 24)}px`;

    const popRect = popoverEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const placeAbove = spaceBelow < Math.min(popRect.height || 220, 220) && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + minW > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minW - 12);
    }
    popoverEl.style.left = `${Math.round(left)}px`;
    if (placeAbove) {
      popoverEl.style.top = 'auto';
      popoverEl.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
    } else {
      popoverEl.style.bottom = 'auto';
      popoverEl.style.top = `${Math.round(rect.bottom + 6)}px`;
    }
  }

  function openPopover(selectEl) {
    if (selectEl.disabled) return;
    if (activeSelect === selectEl) {
      closePopover();
      return;
    }
    closePopover();
    activeSelect = selectEl;
    selectEl.classList.add('cs-select-open');

    popoverEl = document.createElement('div');
    popoverEl.className = 'cs-select-popover';
    popoverEl.setAttribute('role', 'listbox');

    const realOptionCount = [...selectEl.options].filter(
      (o) => !(o.disabled && o.value === ''),
    ).length;
    if (realOptionCount > 6) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'cs-select-search';
      searchInputEl = document.createElement('input');
      searchInputEl.type = 'text';
      searchInputEl.placeholder = '搜索选项…';
      searchInputEl.autocomplete = 'off';
      searchInputEl.addEventListener('input', () => renderOptions(searchInputEl.value));
      searchWrap.appendChild(searchInputEl);
      popoverEl.appendChild(searchWrap);
    }

    listEl = document.createElement('div');
    listEl.className = 'cs-select-list';
    popoverEl.appendChild(listEl);
    document.body.appendChild(popoverEl);

    renderOptions('');
    positionPopover();

    if (searchInputEl) {
      searchInputEl.focus();
    } else {
      selectEl.focus();
    }
  }

  document.addEventListener(
    'mousedown',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (popoverEl && popoverEl.contains(target)) return;

      const labelWrap = target.closest('.topbar-merchant-select');
      const selectEl =
        target.closest('select') || (labelWrap ? labelWrap.querySelector('select') : null);
      if (selectEl && !selectEl.multiple && selectEl.size <= 1) {
        if (selectEl.disabled) return;
        event.preventDefault();
        openPopover(selectEl);
        return;
      }
      if (popoverEl) closePopover();
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (popoverEl) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closePopover({ restoreFocus: true });
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          highlightItem(activeIndex + 1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          highlightItem(activeIndex - 1);
          return;
        }
        if (event.key === 'Enter' && activeIndex >= 0 && visibleOptions[activeIndex]) {
          event.preventDefault();
          commitChoice(visibleOptions[activeIndex]);
          return;
        }
      } else if (
        document.activeElement instanceof HTMLSelectElement &&
        !document.activeElement.disabled &&
        (event.key === ' ' || event.key === 'Enter' || (event.altKey && event.key === 'ArrowDown'))
      ) {
        event.preventDefault();
        openPopover(document.activeElement);
      }
    },
    true,
  );

  window.addEventListener('resize', () => {
    if (popoverEl) positionPopover();
  });
  window.addEventListener(
    'scroll',
    (ev) => {
      if (!popoverEl) return;
      if (ev.target instanceof Node && popoverEl.contains(ev.target)) return;
      positionPopover();
    },
    true,
  );
  window.addEventListener('hashchange', () => closePopover());
}

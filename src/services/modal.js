/** 对话框保留键盘焦点；关闭后返回触发控件。 */
export const modal = {
  mounted(element, binding) {
    const previous = document.activeElement;
    const dialog =
      element.querySelector('[role="dialog"]') || element.querySelector('form') || element;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    const controls = () =>
      [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(
        (el) => !el.disabled && el.getClientRects().length,
      );
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        binding.value?.();
      }
      if (event.key !== 'Tab') return;
      const list = controls(),
        first = list[0] || dialog,
        last = list.at(-1) || dialog;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    element.addEventListener('keydown', keydown);
    (controls()[0] || dialog).focus();
    element.__disposeModal = () => {
      element.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  },
  unmounted(element) {
    element.__disposeModal?.();
  },
};

"""等待契约替身的绑定回调完成后关闭页面，避免测试退出时遗留异步通道任务。"""


def track_bindings(page):
    page.evaluate('''() => {
      const invoke = window.__contractApi;
      window.__contractBindingsPending = 0;
      window.__contractApi = (...args) => {
        window.__contractBindingsPending++;
        return invoke(...args).finally(() => window.__contractBindingsPending--);
      };
    }''')


def close_page(page):
    if not page.is_closed():
        page.wait_for_function('() => (window.__contractBindingsPending || 0) === 0')
        page.close()


def close_browser(browser):
    for context in browser.contexts:
        for page in context.pages:
            close_page(page)
    browser.close()

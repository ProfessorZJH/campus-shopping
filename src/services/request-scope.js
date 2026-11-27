import { store } from './store.js';

/** 页面卸载或身份/路由/商户变化后，旧请求不得写回界面。写请求仍可能在服务端完成。 */
export function requestScope() {
  let alive = true,
    epoch = 0,
    controller;
  Vue.onBeforeUnmount(() => {
    alive = false;
    controller?.abort();
  });
  function capture() {
    const identity = store.identityVersion,
      route = store.route,
      merchant = store.merchantId;
    return () =>
      alive &&
      identity === store.identityVersion &&
      route === store.route &&
      merchant === store.merchantId;
  }
  function begin() {
    controller?.abort();
    controller = new AbortController();
    const stamp = ++epoch,
      valid = capture();
    return { signal: controller.signal, current: () => stamp === epoch && valid() };
  }
  return { capture, begin };
}

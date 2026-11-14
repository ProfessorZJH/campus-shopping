/// <reference types="vite/client" />

declare global {
  /** 旧 JS 页面与组件未走 ESM import，直接读取全局 Vue 运行时；此处为 checkJs 提供类型。 */
  const Vue: typeof import('vue');
  interface Window {
    /** 兼容入口在旧 JS 组件求值前写入的唯一 Vue 运行时。 */
    Vue: typeof import('vue');
    __CAMPUS_TEST_DEMO__?: boolean;
    __CAMPUS_TEST_ROUTE__?: string;
    __CAMPUS_UI_TEST_IMAGES__?: Record<string, string>;
  }
}

export {};

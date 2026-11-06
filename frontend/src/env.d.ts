/// <reference types="vite/client" />

declare global {
  interface Window {
    /** 兼容入口在旧 JS 组件求值前写入的唯一 Vue 运行时。 */
    Vue: typeof import('vue');
    __CAMPUS_TEST_DEMO__?: boolean;
    __CAMPUS_TEST_ROUTE__?: string;
    __CAMPUS_UI_TEST_IMAGES__?: Record<string, string>;
  }
}

export {};

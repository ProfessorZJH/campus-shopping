// 兼容入口必须最先求值：旧 JS 组件在模块顶层读取全局 Vue，
// 这里把打包的唯一运行时暴露出去，避免再加载 vendor 全局副本。
import * as Vue from 'vue';

window.Vue = Vue;

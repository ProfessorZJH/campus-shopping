import { parse } from 'acorn';
import { compile } from '@vue/compiler-dom';
import MagicString from 'magic-string';

// 编译真实 JS 语法树中的静态 Vue 模板；运行时不调用 eval/new Function。
export function precompileTemplates() {
  return {
    name: 'campus-vue-template-precompile',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').includes('/src/') || !id.endsWith('.js')) return null;
      const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
      const output = new MagicString(source);
      function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (
          node.type === 'Property' &&
          !node.computed &&
          (node.key.name || node.key.value) === 'template'
        ) {
          const value = node.value;
          const template =
            value.type === 'TemplateLiteral' && value.expressions.length === 0
              ? value.quasis[0].value.cooked
              : value.type === 'Literal' && typeof value.value === 'string'
                ? value.value
                : null;
          if (template === null) throw new Error(`Vue template must be static: ${id}`);
          const result = compile(template, {
            mode: 'function',
            prefixIdentifiers: true,
            hoistStatic: false,
            cacheHandlers: false,
          });
          output.overwrite(node.start, node.end, `render: (() => {\n${result.code}\n})()`);
          return;
        }
        for (const [key, child] of Object.entries(node)) {
          if (key === 'start' || key === 'end') continue;
          if (Array.isArray(child)) child.forEach(visit);
          else if (child && typeof child === 'object') visit(child);
        }
      }
      visit(ast);
      return { code: output.toString(), map: output.generateMap({ hires: true }) };
    },
  };
}

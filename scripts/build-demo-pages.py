#!/usr/bin/env python3
"""构建零后端 GitHub Pages 静态交互演示站点（含 4 套消费端 × 3 套后台大厂 1:1 复刻导览页）。"""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / 'frontend'
DEFAULT_OUT = ROOT / 'var/verify/gh-pages-site'

GALLERY_CSS = """* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f6f8;
  color: #1d2129;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: 36px 20px 64px;
}

.hero {
  background: linear-gradient(135deg, #1d2129 0%, #2b3446 60%, #ff5000 160%);
  color: #ffffff;
  border-radius: 18px;
  padding: 34px 36px;
  margin-bottom: 30px;
  box-shadow: 0 18px 40px rgba(29, 33, 41, 0.14);
}

.hero-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 12px;
}

.hero h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 10px;
}

.hero p {
  font-size: 14.5px;
  color: rgba(255, 255, 255, 0.86);
  max-width: 760px;
  margin-bottom: 20px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: #ff5000;
  color: #ffffff;
  box-shadow: 0 6px 18px rgba(255, 80, 0, 0.32);
}

.btn-primary:hover {
  background: #e64500;
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.24);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.22);
}

.section {
  margin-bottom: 32px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-head h2 {
  font-size: 19px;
  font-weight: 700;
}

.section-head span {
  font-size: 12.5px;
  color: #6b7280;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 2px 8px rgba(29, 33, 41, 0.04);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.card:hover {
  transform: translateY(-3px);
  border-color: #ff5000;
  box-shadow: 0 12px 28px rgba(29, 33, 41, 0.09);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.swatch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff2e8;
  color: #ff5000;
}

.tag-alt {
  background: #f2f3f5;
  color: #4e5969;
}

.card h3 {
  font-size: 16px;
  font-weight: 700;
}

.card p {
  font-size: 13px;
  color: #4e5969;
  flex: 1;
}

.card-foot {
  font-size: 12.5px;
  font-weight: 600;
  color: #ff5000;
  padding-top: 4px;
}

.dot-tb-a { background: #ff5000; }
.dot-tb-b { background: #ff9900; }
.dot-jd-a { background: #e1251b; }
.dot-jd-b { background: #ff7a18; }
.dot-yp-a { background: #333333; }
.dot-yp-b { background: #845f3f; }
.dot-xhs-a { background: #ff2442; }
.dot-xhs-b { background: #171717; }
.dot-antd-a { background: #1677ff; }
.dot-antd-b { background: #001529; }
.dot-arco-a { background: #165dff; }
.dot-arco-b { background: #14c9c9; }
.dot-mt-a { background: #1b2432; }
.dot-mt-b { background: #ffbd00; }

.note {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 13px;
  color: #4e5969;
}

@media (max-width: 980px) {
  .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .hero { padding: 24px 20px; }
  .hero h1 { font-size: 22px; }
  .grid-4, .grid-3 { grid-template-columns: 1fr; }
}
"""

GALLERY_HTML = """<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>青柠校园 · 大厂 1:1 界面复刻交互演示画廊</title>
    <link rel="stylesheet" href="./gallery.css" />
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <span class="hero-badge">GitHub Pages 纯前端交互演示 · 零后端直开</span>
        <h1>青柠校园 · 4 套消费端 × 3 套后台大厂 1:1 结构复刻</h1>
        <p>
          正式版默认锁定为 <strong>淘宝 2025 PC + 阿里 Ant Design Pro / 千牛工作台</strong>；
          本演示站完整保留了设计探索阶段的 4 套国内一线消费端结构与 3 套后台工作台，点击下方任意卡片即可进入实时可交互界面，并可在顶栏右上角「切换大厂版」随时切换端侧与风格。
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="./index.html?ct=taobao&amp;at=antd#/">直接体验默认版（淘宝 2025）</a>
          <a class="btn btn-ghost" href="./index.html?ct=taobao&amp;at=antd#/merchant">商家后台（阿里 AntD / 千牛）</a>
          <a class="btn btn-ghost" href="./index.html?ct=taobao&amp;at=antd#/admin">平台监管台（双 Redis 监控）</a>
          <a class="btn btn-ghost" href="./index.html?ct=taobao&amp;at=antd#/ai">AI 智能导购</a>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>消费端 1:1 大厂结构复刻（4 套完整布局）</h2>
          <span>支持搜索筛选、分类切换、价格区间、多规格抽屉与 1920/1440/1280/390 全端自适应</span>
        </div>
        <div class="grid-4">
          <a class="card" href="./index.html?ct=taobao&amp;at=antd#/">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-tb-a"></i><i class="dot dot-tb-b"></i></span>
              <span class="tag">正式版默认</span>
            </div>
            <h3>淘宝 2025 PC</h3>
            <p>32px 浅灰顶栏 + 淘宝橙胶囊大搜索 + 三栏一体白卡首屏 + 6 列紧致高密「猜你喜欢」货架。</p>
            <span class="card-foot">立即打开体验 →</span>
          </a>

          <a class="card" href="./index.html?ct=jd&amp;at=antd#/">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-jd-a"></i><i class="dot dot-jd-b"></i></span>
              <span class="tag tag-alt">精选存档</span>
            </div>
            <h3>京东 PC 版</h3>
            <p>银灰顶栏 + 方正红框搜索 + 我的购物车白盒 + 校内秒杀横条 + 5 列白底内缩精拍自营货架。</p>
            <span class="card-foot">立即打开体验 →</span>
          </a>

          <a class="card" href="./index.html?ct=youpin&amp;at=antd#/">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-yp-a"></i><i class="dot dot-yp-b"></i></span>
              <span class="tag tag-alt">精选存档</span>
            </div>
            <h3>小米有品 PC</h3>
            <p>40px 深黑顶栏 + 1080px 经典居中版心 + 深棕半透明悬浮分类大图 + 4 列居中留白画廊。</p>
            <span class="card-foot">立即打开体验 →</span>
          </a>

          <a class="card" href="./index.html?ct=xiaohongshu&amp;at=antd#/">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-xhs-a"></i><i class="dot dot-xhs-b"></i></span>
              <span class="tag tag-alt">精选存档</span>
            </div>
            <h3>小红书 Web</h3>
            <p>224px 左侧固定白底竖向导航 + 居中无框搜索吸顶头 + 去横幅 6 列 5:6 轻盈笔记瀑布流。</p>
            <span class="card-foot">立即打开体验 →</span>
          </a>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>商家与平台后台 1:1 大厂工作台复刻（3 套完整架构）</h2>
          <span>内含经营统计图表、双 Redis 隔离监控、库存流水、自提核销与 15 项细粒度 RBAC 预览</span>
        </div>
        <div class="grid-3">
          <a class="card" href="./index.html?ct=taobao&amp;at=antd#/merchant">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-antd-a"></i><i class="dot dot-antd-b"></i></span>
              <span class="tag">正式版默认</span>
            </div>
            <h3>阿里 Ant Design Pro / 千牛</h3>
            <p>深海蓝通栏顶栏 + 左侧白底蓝条高亮菜单 + 4 张独立分析 ChartCard + 65/35 趋势与热销双拼卡。</p>
            <span class="card-foot">进入商家工作台 →</span>
          </a>

          <a class="card" href="./index.html?ct=taobao&amp;at=arco#/merchant">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-arco-a"></i><i class="dot dot-arco-b"></i></span>
              <span class="tag tag-alt">精选存档</span>
            </div>
            <h3>字节 Arco Design Pro</h3>
            <p>通栏白顶栏 + 分组白侧栏 + 左 7 右 3 非对称 Workplace 布局 + 一体式竖线指标卡与快捷入口。</p>
            <span class="card-foot">进入商家工作台 →</span>
          </a>

          <a class="card" href="./index.html?ct=taobao&amp;at=meituan#/merchant">
            <div class="card-top">
              <span class="swatch"><i class="dot dot-mt-a"></i><i class="dot dot-mt-b"></i></span>
              <span class="tag tag-alt">精选存档</span>
            </div>
            <h3>美团商家版 PC</h3>
            <p>全高深蓝灰侧栏 + 营业中状态白顶栏 + 顶部全宽深灰暖金核销指挥条 + 暖琥珀经营图表。</p>
            <span class="card-foot">进入商家工作台 →</span>
          </a>
        </div>
      </section>

      <div class="note">
        <strong>说明：</strong>本静态演示站运行在纯前端只读预览模式（不连接后端数据库与真实支付），所有交易写操作均按安全契约禁用；完整全栈体验（Java 17 + MySQL 8.0 + 双物理 Redis + FastAPI 混合 RAG 智能导购）请按仓库 README 使用 Docker 或源码本地启动。
      </div>
    </main>
  </body>
</html>
"""


def build_pages(out_dir: Path) -> None:
    out_dir = out_dir.resolve()
    with tempfile.TemporaryDirectory(prefix='campus-gh-pages-') as tmp:
        stage = Path(tmp) / 'site'
        subprocess.run(
            ['node', str(UI / 'scripts/build.mjs'), '--out=' + str(stage)],
            check=True,
            cwd=ROOT,
        )
        index_html = (stage / 'index.html').read_text(encoding='utf-8')
        showcase_html = index_html.replace(
            '<html lang="zh-CN">',
            '<html lang="zh-CN" data-demo-entry="1" data-showcase-entry="1">',
            1,
        )
        assert 'data-showcase-entry="1"' in showcase_html, 'Failed to inject showcase attributes'
        (stage / 'index.html').write_text(showcase_html, encoding='utf-8', newline='\n')
        (stage / 'gallery.html').write_text(GALLERY_HTML, encoding='utf-8', newline='\n')
        (stage / 'gallery.css').write_text(GALLERY_CSS, encoding='utf-8', newline='\n')
        (stage / '.nojekyll').write_text('', encoding='utf-8')

        if out_dir.exists():
            shutil.rmtree(out_dir)
        shutil.copytree(stage, out_dir)
    print(f'DEMO_PAGES_BUILT {out_dir}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    build_pages(args.out)


if __name__ == '__main__':
    main()

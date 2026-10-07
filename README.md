# QUI Theme

本地化的 QQ QUI 风格组件画廊与 Vue 3 组件包。画廊包含色彩、图标和 36 个组件示例；图标、主题令牌、地区数据和图片均随项目提供。

```sh
pnpm install
pnpm dev
```

```sh
pnpm typecheck
pnpm build
```

## 组件库

```ts
import { createApp } from 'vue'
import { QuiButton, QuiDialog } from '@qui-theme/ui'
import '@qui-theme/ui/style.css'

createApp(App).mount('#app')
```

也可以全局安装 `QuiUI` 插件。按需导入组件可保留构建器的 tree shaking；图标组件、轻量图标索引、487 个图标数据、图标分类、主题令牌和图片分别从 `@qui-theme/ui/icon`、`/icon-index`、`/icons`、`/icon-groups`、`/theme` 与 `/assets` 导入。图标按批次懒加载；所有组件通过 Vue props、事件和 `v-model` 暴露交互。

构建产物位于 `packages/qui-ui/dist` 和 `apps/demo/dist`。应用运行时不请求腾讯 CDN。

原始快照位于 `apps/demo/reference`；构建与类型检查会自动运行确定性的预处理，生成去重后的 `.cache/public`。部署时上传整个 `apps/demo/dist`，服务器对 HTML/CSS/JS/JSON 启用 gzip 或 Brotli；不需要为 `.gz` URL 配置特殊响应头。默认相对 base 支持子目录部署。

`@qui-theme/ui/regions` 提供 `QuiDistrict` 类型和异步 `loadRegions()`；仅使用时才请求地区 JSON。按钮通过 `nativeType="submit"` 或 `nativeType="reset"` 参与表单，默认是 `button`。图标 JSON 按组加载；加载失败后可通过组件模板引用的 `retry()` 重试。

## 验证

```sh
pnpm check                 # types, production build, browser/resource tests, published API/bundle checks
pnpm baseline:build <ref>  # rebuild a Git baseline without changing the checkout
pnpm baseline:capture      # 39 routes × 2 widths × 2 themes
pnpm verify:replica        # static screenshot comparison, <=0.1% differing pixels
pnpm verify:interactions   # 48 interaction captures at a fixed 200ms animation time
pnpm verify:performance    # five cold runs per route, 4x CPU + Slow 4G
```

`baseline:build` 用于本轮快照迁移前的提交；后续版本可保存构建产物，通过 `verify:replica --capture --source <directory>` 建立新基线。在相同浏览器、字体、系统和视口下生成并比较基线；测试脚本仅启动临时静态文件服务器，结束时关闭。原始构建、截图和测量数据保存在忽略的 `artifacts/local`。CI 执行 `pnpm check`，视觉和性能检查单独运行，避免把不同主机的字体和 CPU 差异计入回归。

详细评价、测量环境、优化结果和验证范围见 [质量审计](docs/quality-audit.md)。

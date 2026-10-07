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

# @qui-theme/ui

Reusable Vue 3 components and local design assets for the QQ QUI gallery.

```ts
import { createApp } from 'vue'
import { QuiButton, QuiDialog } from '@qui-theme/ui'
import '@qui-theme/ui/style.css'

createApp(App).mount('#app')
```

For global registration, install the `QuiUI` plugin. Components use typed props, declared events and `v-model` where appropriate. Theme values are CSS custom properties and can be overridden by the consuming app.

Public subpaths expose the icon component (`/icon`), a lightweight icon index (`/icon-index`), the 487 local SVG icons (`/icons`), icon categories (`/icon-groups`), design tokens (`/theme`) and local images (`/assets`). Icon SVGs are split into lazy chunks. The package includes its styles and region data; it makes no runtime requests to Tencent hosts.

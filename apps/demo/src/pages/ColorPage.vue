<script setup lang="ts">
import { computed } from 'vue'
import tokens from '@qui-theme/ui/theme'

const groupNames: Record<string, string> = {
  brand: '品牌色', text: '文本色', icon: '图标色', feedback: '反馈色', bg: '通用背景色',
  fill: '填充色', overlay: '叠加色', border: '分割色', bubble: '气泡色', button: '按钮色',
  progressbar: '进度条颜色', other: '其他颜色',
}
const groups = computed(() => {
  const result = new Map<string, typeof tokens>()
  for (const token of tokens) {
    const prefix = token.name.slice(2).split('_')[0]
    const key = groupNames[prefix] ? prefix : 'other'
    result.set(key, [...(result.get(key) ?? []), token])
  }
  return [...result.entries()].map(([key, items]) => ({ title: groupNames[key], items }))
})
</script>

<template>
  <main class="qui-demo-page">
    <section v-for="group in groups" :key="group.title" class="qui-demo-section">
      <h2 class="qui-demo-section__heading">{{ group.title }}</h2>
      <div class="qui-demo-section__content qui-demo-card" style="padding: 0 16px">
        <div v-for="token in group.items" :key="token.name" class="qui-token-card">
          <span class="qui-token-card__swatch" :style="{ background: `var(${token.name})` }" />
          <div>
            <div class="qui-token-card__name">{{ token.name }}</div>
            <div class="qui-token-card__value">{{ token.value }}</div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

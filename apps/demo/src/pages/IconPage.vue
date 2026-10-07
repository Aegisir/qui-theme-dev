<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import QuiIcon from '@qui-theme/ui/icon'
import iconIndex from '@qui-theme/ui/icon-index'
import groups from '@qui-theme/ui/icon-groups'
import QuiToast from './ToastMessage.vue'

const search = ref('')
const copied = ref(false)
const pageSize = ref(120)
let copyTimer: number | undefined
const names = Object.keys(iconIndex)
const categoryNames: Record<string, string> = { common: '通用型', aio: '消息', brand: '品牌', file: '文件', qzone: '空间' }
const list = computed(() => Object.entries(groups).map(([group, keys]) => ({
  title: categoryNames[group] ?? '其他',
  names: names.filter((name) => keys.includes(name.toLowerCase())),
})).concat([{ title: '其他', names: names.filter((name) => !Object.values(groups).flat().includes(name.toLowerCase())) }]).map((group) => ({
  ...group,
  names: group.names.filter((name) => name.toLowerCase().includes(search.value.toLowerCase())),
})).filter((group) => group.names.length))
const visibleGroups = computed(() => {
  if (search.value) return list.value
  let remaining = pageSize.value
  return list.value.map((group) => {
    const visible = group.names.slice(0, remaining)
    remaining -= visible.length
    return { ...group, names: visible }
  }).filter((group) => group.names.length)
})
const hasMore = computed(() => list.value.reduce((total, group) => total + group.names.length, 0) > pageSize.value && !search.value)

async function copy(name: string) {
  try { await navigator.clipboard?.writeText(`<${name} />`) } catch { /* Clipboard access may be denied by the browser. */ }
  copied.value = true
  window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => { copied.value = false }, 1500)
}
onBeforeUnmount(() => window.clearTimeout(copyTimer))
</script>

<template>
  <main class="qui-demo-page">
    <section class="qui-demo-section">
      <h2 class="qui-demo-section__heading">全部图标</h2>
      <label class="qui-search is-white"><span class="qui-search__icon">⌕</span><input v-model="search" placeholder="搜索图标" /></label>
    </section>
    <section v-for="group in visibleGroups" :key="group.title" class="qui-demo-section">
      <h2 class="qui-demo-section__heading">{{ group.title }}</h2>
      <div class="qui-icon-grid">
        <button v-for="name in group.names" :key="name" class="qui-icon-card" @click="copy(name)">
          <QuiIcon :name="name" size="28" />
          <span>{{ name }}</span>
        </button>
      </div>
    </section>
    <div class="qui-demo-section">
      <button v-if="hasMore" class="qui-link-button" @click="pageSize += 120">加载更多图标</button>
    </div>
    <QuiToast :show="copied" message="已复制到剪贴板" type="success" :duration="1500" />
  </main>
</template>

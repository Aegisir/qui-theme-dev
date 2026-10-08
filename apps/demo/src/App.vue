<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ReferencePage from './pages/ReferencePage.vue'

const route = ref(window.location.hash.slice(1) || '/index')
const syncRoute = () => { route.value = window.location.hash.slice(1) || '/index' }
const slug = computed(() => route.value.replace(/^\//, '').split('?')[0] || 'index')
const themes = ['default-white', 'default-dark', 'white', 'dark', 'grey', 'green', 'yellow', 'pink', 'purple', 'blue', 'red']

function onThemeMessage({ data }: MessageEvent<{ themeId?: string; isSave?: boolean }>) {
  const { themeId, isSave = true } = data ?? {}
  if (!themeId || (themeId !== 'default' && !themes.includes(themeId))) return
  document.body.classList.remove(...themes)
  if (themeId !== 'default') document.body.classList.add(themeId)
  try {
    if (themeId === 'default') localStorage.removeItem('qui_themeId')
    else if (isSave) localStorage.setItem('qui_themeId', themeId)
  } catch {}
}

onMounted(() => {
  window.addEventListener('hashchange', syncRoute)
  window.addEventListener('message', onThemeMessage)
})
onUnmounted(() => {
  window.removeEventListener('hashchange', syncRoute)
  window.removeEventListener('message', onThemeMessage)
})
</script>

<template>
  <ReferencePage :slug="slug" />
</template>

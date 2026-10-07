<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'

const route = ref(window.location.hash.slice(1) || '/index')
const syncRoute = () => { route.value = window.location.hash.slice(1) || '/index' }
const slug = computed(() => route.value.replace(/^\//, '').split('?')[0] || 'index')
const page = defineAsyncComponent(() => import('./pages/ReferencePage.vue'))
onMounted(() => window.addEventListener('hashchange', syncRoute))
onUnmounted(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template>
  <component :is="page" :slug="slug" />
</template>

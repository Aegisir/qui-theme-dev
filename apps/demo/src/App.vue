<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ReferencePage from './pages/ReferencePage.vue'

const route = ref(window.location.hash.slice(1) || '/index')
const syncRoute = () => { route.value = window.location.hash.slice(1) || '/index' }
const slug = computed(() => route.value.replace(/^\//, '').split('?')[0] || 'index')

onMounted(() => window.addEventListener('hashchange', syncRoute))
onUnmounted(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template>
  <ReferencePage :slug="slug" />
</template>

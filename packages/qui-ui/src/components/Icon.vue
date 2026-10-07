<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { loadIcon } from '../icon-loader'

const props = withDefaults(defineProps<{ name: string; size?: string | number; color?: string }>(), { size: '24px' })
const svg = ref('')
let request = 0
watch(() => props.name, async (name) => {
  const current = ++request
  try {
    const markup = await loadIcon(name)
    if (current === request) svg.value = markup
  } catch {
    if (current === request) svg.value = ''
  }
}, { immediate: true })
const style = computed(() => ({ fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size, color: props.color ?? 'var(--icon_primary)' }))
</script>

<template>
  <span class="qui-icon" :style="style" :aria-label="name" role="img" v-html="svg" />
</template>

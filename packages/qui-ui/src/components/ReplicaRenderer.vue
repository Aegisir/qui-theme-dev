<script setup lang="ts">
import { computed, ref } from 'vue'

interface ReplicaTarget {
  element: Element
  buttonIndex: number
  controlIndex: number
  text: string
}

const controlSelector = 'button, [role="button"], [role="tab"], [role="switch"], .q-tabbar-item, .q-checkbox__icon, .q-index__indicator > li, .qui-icon_item'

const props = defineProps<{ markup: string; portals?: string }>()
const emit = defineEmits<{
  click: [target: ReplicaTarget]
  input: [element: HTMLInputElement | HTMLTextAreaElement]
  change: [element: HTMLInputElement | HTMLSelectElement]
}>()
const root = ref<HTMLElement>()
const markup = computed(() => {
  const opening = '<div class="container">'
  if (!props.markup.startsWith(opening)) return props.markup
  const end = props.markup.lastIndexOf('</div>')
  return end > opening.length ? props.markup.slice(opening.length, end) : props.markup
})

function handleClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (!target || !root.value) return
  const link = target.closest('a')
  if (link) event.preventDefault()
  const button = target.closest('button')
  const control = target.closest(controlSelector)
  emit('click', {
    element: target,
    buttonIndex: button ? [...root.value.querySelectorAll('button')].indexOf(button) : -1,
    controlIndex: control ? [...root.value.querySelectorAll(controlSelector)].indexOf(control) : -1,
    text: (button?.textContent ?? target.textContent ?? '').trim().replace(/\s+/g, ' '),
  })
}

function handleInput(event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) emit('input', input)
}

function handleChange(event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) emit('change', input)
}
</script>

<template>
  <div ref="root" class="container" v-html="markup" @click="handleClick" @input="handleInput" @change="handleChange" />
  <div v-if="portals" class="qui-replica-portals" style="display: contents" v-html="portals" @click="handleClick" @input="handleInput" @change="handleChange" />
</template>

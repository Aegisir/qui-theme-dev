<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { quiMotionKey } from './motion-context'

const props = withDefaults(defineProps<{
  show?: boolean
  modelValue?: boolean
  placement?: 'center' | 'bottom' | 'top'
  mask?: boolean
  maskClosable?: boolean
  zIndex?: number
}>(), { placement: 'center', mask: true, maskClosable: true, zIndex: 1000 })
const emit = defineEmits<{ 'update:show': [value: boolean]; 'update:modelValue': [value: boolean]; close: [] }>()
const open = computed(() => props.show ?? props.modelValue ?? false)
const providedMotion = inject(quiMotionKey, undefined)
const motion = computed(() => providedMotion ?? (props.placement === 'center' ? 'zoom' : props.placement === 'bottom' ? 'slide-bottom' : 'slide-top'))
const transitionDuration = computed(() => motion.value === 'zoom' ? 350 : 300)
let scrollLocks = 0
let locked = false
const syncLock = (value: boolean) => {
  if (value === locked || typeof document === 'undefined') return
  locked = value
  scrollLocks = Math.max(0, scrollLocks + (value ? 1 : -1))
  document.body.classList.toggle('qui-overlay-open', scrollLocks > 0)
}
const close = () => {
  emit('update:show', false)
  emit('update:modelValue', false)
  emit('close')
}
const onKey = (event: KeyboardEvent) => event.key === 'Escape' && open.value && close()
watch(open, syncLock)
onMounted(() => { window.addEventListener('keydown', onKey); syncLock(open.value) })
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  syncLock(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="qui-motion-fade" :duration="transitionDuration">
      <div v-if="open" class="qui-overlay" :class="[`is-${placement}`, { 'has-mask': mask }]" :style="{ zIndex }" @click.self="maskClosable && close()">
        <span v-if="mask" class="qui-overlay__mask" aria-hidden="true" @click="maskClosable && close()" />
        <Transition :name="`qui-motion-${motion}`" appear>
          <section class="qui-overlay__panel" role="dialog" aria-modal="true"><slot :close="close" /></section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

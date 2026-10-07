<script setup lang="ts">
defineProps<{ title: string; plain?: boolean }>()
</script>

<template>
  <section class="qui-demo-section">
    <h2 class="qui-demo-section__heading">{{ title }}</h2>
    <div :class="['qui-demo-section__content', { 'qui-demo-card': !plain }]">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ show: boolean; message: string; type?: string; duration?: number }>()
</script>

<template>
  <div v-if="show" class="qui-copy-toast" role="status">{{ message }}</div>
</template>

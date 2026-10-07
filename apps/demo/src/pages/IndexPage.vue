<script setup lang="ts">
import { catalog, routeFor } from '../catalog'
</script>

<template>
  <main class="qui-demo-page qui-demo-index">
    <section v-for="group in catalog" :key="group.title" class="qui-demo-group">
      <h2 class="qui-demo-group__title">{{ group.title }}</h2>
      <div class="qui-demo-group__card">
        <a v-for="entry in group.entries" :key="entry.slug" class="qui-demo-link" :href="routeFor(entry.slug)">
          <span class="qui-demo-link__label">{{ entry.label }}</span>
          <span class="qui-demo-link__arrow" aria-hidden="true">›</span>
        </a>
      </div>
    </section>
  </main>
</template>

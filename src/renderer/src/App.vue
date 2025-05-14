<script setup lang="ts">
import MainForm from './MainForm.vue'
import Footer from './components/Footer.vue'
import { URL_UPDATES_LOG, URL_VISIT_WEBSITE } from '@common/constants'
import odinLogo from './assets/odin.png'
</script>

<template>
  <img :src="odinLogo" class="w-16 h-16" />
  <div class="p-4 flex items-center">
    <a
      class="hover:text-[var(--primary)] text-gray-400 text-sm font-semibold transition-all duration-300"
      :href="URL_VISIT_WEBSITE"
      target="_blank"
      rel="noopener noreferrer"
      >Visit Website</a
    >
    <span class="mx-3 text-gray-500">•</span>
    <a
      class="hover:text-[var(--primary)] text-gray-400 text-sm font-semibold transition-all duration-300"
      :href="URL_UPDATES_LOG"
      target="_blank"
      rel="noopener noreferrer"
      >What's new?</a
    >
  </div>
  <MainForm />
  <Footer />
</template>

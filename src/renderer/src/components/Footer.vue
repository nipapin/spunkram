<script setup lang="ts">
import { URL_REPORT_BUG, URL_HELP_CENTER } from '@common/constants'
const appVersion = process.env.PACKAGE_VERSION
</script>
<template>
  <div
    class="flex items-center absolute bottom-6 px-2 z-10 font-mono bg-gray-800/50 text-gray-400 backdrop-blur-sm text-sm rounded-full"
  >
    <a
      class="hover:underline px-3 py-2 rounded-full"
      :href="URL_REPORT_BUG"
      target="_blank"
      >Bug Report</a
    >
    <div class="h-5 w-px bg-gray-500/50"></div>
    <a
      class="hover:underline px-3 py-2 rounded-full"
      :href="URL_HELP_CENTER"
      target="_blank"
      >Help Center</a
    >
  </div>
</template>

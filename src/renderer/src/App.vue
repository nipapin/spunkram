<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MainForm from './MainForm.vue'

const linksMap = ref<Record<string, string>>({})

onMounted(() => {
  window.api.fetchLinks().then((links) => {
    linksMap.value = links
  })
  window.addEventListener('keyup', (event) => {
    if (event.keyCode === 82 && (event.ctrlKey || event.metaKey)) {
      window.location.reload()
    }
  })
})
</script>

<template>
  <main class="w-full max-w-[560px] mx-auto">
    <MainForm :links-map="linksMap" />
  </main>
</template>

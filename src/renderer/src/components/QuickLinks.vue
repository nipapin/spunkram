<script setup lang="ts">
const props = defineProps<{
  linksMap: Record<string, string>
}>()

const links = [
  {
    id: 'docs',
    labelKey: 'quickLinks.docs',
    key: 'help_center',
    iconPath:
      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'
  },
  {
    id: 'changelog',
    labelKey: 'quickLinks.changelog',
    key: 'updates_log',
    iconPath: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'
  },
  {
    id: 'bug',
    labelKey: 'quickLinks.bug',
    key: 'bug_report',
    iconPath:
      'M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1M12 20v-9M9 11H4M4 4l3 6.5M9 17H4l-3-3M15 11h5M20 4l-3 6.5M15 17h5l3-3'
  },
  {
    id: 'website',
    labelKey: 'quickLinks.website',
    key: 'marketplace',
    iconPath:
      'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10zM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'
  }
] as const

const getHref = (key: string) => props.linksMap[key] ?? '#'
</script>

<template>
  <div class="grid grid-cols-4 gap-1">
    <a
      v-for="link in links"
      :key="link.id"
      :href="getHref(link.key)"
      target="_blank"
      rel="noopener"
      class="quick-link"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-4 h-4 opacity-80 group-hover:opacity-100"
      >
        <path :d="link.iconPath" />
      </svg>
      <span>{{ $t(link.labelKey) }}</span>
    </a>
  </div>
</template>

<style scoped>
.quick-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.15s;
}
.quick-link:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  transform: translateY(-1px);
}
</style>

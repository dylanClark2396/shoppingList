<template>
  <!-- header section -->
  <div>
    <span class="topbar-title">
      Project Name - Space Name
    </span>
  </div>
  
  
  <!-- Main content section -->
  <div>
    <!-- space navigation menu -->
     <div class="card flex" style="border-color: red; border-radius: 1rem;">
      <Menu :model="items" />
     </div>

     <!-- measurement module section -->
     <div class="w-full h-full" style="border-color: red; border-radius: 1rem;">
      <span>Test</span>
     </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from "vue";

const items = ref([
    { label: 'New', icon: 'pi pi-plus' },
    { label: 'Search', icon: 'pi pi-search' }
]);

</script>

<style scoped>
.topbar-title {
    font-size: 1.25rem;
    font-weight: 300;
    color: var(--p-surface-700);
    line-height: 1;
}

.card {
    padding: 2rem;
    margin-bottom: 1rem;
}

</style>

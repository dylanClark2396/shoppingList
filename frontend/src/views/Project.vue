<template>
  <!-- header section -->
  <div style="margin-bottom: 2rem;">
    <span class="topbar-title">
      Project Name - Space Name
    </span>
  </div>
  
  <!-- Main content section -->
  <div class="layout">
    <!-- space navigation menu -->
     <div class="space-menu left">
      <Menu :model="items" />
     </div>

     <!-- measurement module section -->
     <div class="right">
      <div class="cards-container">
        <Card class="new-module">
          <template #content>
              <Button icon="pi pi-plus" size="large" aria-label="Filter" outlined />
          </template>
        </Card>
        <div v-for="value in measurmentModules">
          <MeasurementCard :name="value" :all-products="allProducts"/>
        </div>
      </div>
     </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from "vue";
import MeasurementCard from "./components/MeasurementCard.vue";

const items = ref([
    { label: 'Kitchen'},
    { label: 'Pantry'}
]);

const allProducts = ref<string[]>(["insert", "small insert", "big insert"]);

const measurmentModules = ref(["top drawer", "middle drawer", "bottom drawer"])

</script>

<style scoped>
.topbar-title {
    font-size: 3rem;
    font-weight: 500;
    color: var(--p-surface-700);
    line-height: 1;
    margin-left: 1rem;
}

.space-menu {
  margin: 0 1rem 0 1rem;
}

.layout {
  display: flex;
  width: 100%;
}

.left {
  flex: 0 0 250px; /* fixed sidebar */
}

.right {
  flex: 1;
}

.new-module {
  --p-card-shadow: none;
  border-style: solid;
  border-color: lightgrey;
  border-width: 1px;
  padding: 1rem;
  justify-content: center;
}

/* Container for all cards */
.cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

</style>

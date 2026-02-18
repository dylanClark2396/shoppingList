<template>
    <Card class="card">
        <template #title>{{ props.name }}</template>
        <template #subtitle>Quantity, Dimensions, Category</template>
        <template #content>
            <!-- dynamic list of addable product -->
             <div style="margin-bottom: 0.5rem;">
                 <AutoComplete v-model="chosenProduct" forceSelection :suggestions="filteredProducts" @complete="search" @option-select="addTolist"/>
             </div>
            <PanelMenu :model="listItems" multiple/>
        </template>
    </Card>
</template>

<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import type { MenuItem } from 'primevue/menuitem';
import { ref } from 'vue';

const props = defineProps<{
  allProducts?: string[];
  name?: string;
}>()

const listItems = ref<MenuItem[]>([{label: '3x6 Insert', items: [{label: "something here"}]}, {label: '3x3 Insert', items: [{label: "something here"}]}])

const chosenProduct = ref(null);
const products = ref(props.allProducts?.length ? props.allProducts : [])
const filteredProducts = ref()

const search = (event: AutoCompleteCompleteEvent) => {
    setTimeout(() => {
        if (!event.query.trim().length) {
            filteredProducts.value = [...products.value];
        } else {
            filteredProducts.value = products.value.filter((product) => {
                return product.toLowerCase().includes(event.query.toLowerCase());
            });
        }
    }, 250);
}

const addTolist = () => {
    if(chosenProduct.value) {
        listItems.value.push({label: chosenProduct.value})
    }
} 
</script>

<style scoped>

.card {
    width:20rem;
    --p-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    flex: 1 1 250px;     /* min width 250px, grow as needed */
    display: flex;
    flex-direction: column; /* stack content vertically */
    justify-content: space-between; /* push button to bottom */
    padding: 1rem;
}

</style>
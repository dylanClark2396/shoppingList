<template>
    <Card class="card">
        <template #title>
            <div class="measurement-header">
                <span class="measurement-title">
                    {{ props.measurement?.name }}
                </span>

                <Button icon="pi pi-pencil" size="small" outlined severity="warning" aria-label="Edit" />
            </div>
        </template>
        <template #subtitle>{{ props.measurement?.quantity }},
            {{ props.measurement?.dimensions?.depth }}x{{ props.measurement?.dimensions?.width }}x{{
                props.measurement?.dimensions?.height }},
            {{ props.measurement?.category }}</template>
        <template #content>
            <!-- dynamic list of addable product -->
            <div style="margin-bottom: 0.5rem;">
                <AutoComplete v-model="chosenProduct" @complete="search" :suggestions="filteredProducts"
                    optionLabel="item" dataKey="sku" placeholder="Add Product" @option-select="addTolist" />
            </div>
            <Accordion :value="activePanels" multiple>
                <AccordionPanel v-for="product in props.measurement?.products" :key="product.sku" :value="product.sku">
                    <AccordionHeader>
                        <div class="flex justify-between w-full items-center">
                            <span class="font-semibold">{{ product.item }}</span>
                            <span v-if="product.price" class="text-primary font-medium">
                                ${{ product.price }}
                            </span>
                        </div>
                    </AccordionHeader>
                    <AccordionContent>
                        <div class="flex flex-col gap-4">

                            <!-- Image -->
                            <img v-if="product.images?.length" :src="`/${product.images[0]}`"
                                class="w-40 rounded-xl shadow-md" />

                            <!-- Tags Container -->
                            <div class="flex flex-wrap gap-2">

                                <Tag :value="`SKU: ${product.sku}`" severity="info" />

                                <Tag v-if="product.vendor" :value="product.vendor" severity="info" />

                                <Tag v-if="product.sheetName" :value="product.sheetName" severity="secondary" />

                                <Tag v-if="product.dimensions" :value="product.dimensions" />

                                <Tag v-if="product.quantity" :value="`Qty: ${product.quantity}`" severity="info" />

                            </div>

                            <!-- Notes -->
                            <div v-if="product.notes">
                                <Tag severity="secondary" icon="pi pi-comment" value="Notes" class="mb-2" />
                                <div class="text-sm text-muted-color">
                                    {{ product.notes }}
                                </div>
                            </div>

                        </div>
                    </AccordionContent>
                </AccordionPanel>
            </Accordion>
        </template>
    </Card>
</template>

<script setup lang="ts">
import type { Measurement, Product } from '@/models';
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import { computed, ref } from 'vue';

const props = defineProps<{
    allProducts?: Product[];
    measurement?: Measurement;
}>()

const emit = defineEmits<{
    (e: 'add-product', payload: { measurementId: number; product: Product }): void
}>()

const activePanels = ref<string[]>([])

const chosenProduct = ref();

const products = computed<Product[]>(() => props.allProducts ?? [])

const filteredProducts = ref<Product[]>([])

const search = ({ query }: AutoCompleteCompleteEvent) => {
    const q = (query || '').trim().toLowerCase()

    filteredProducts.value = !q
        ? [...products.value]
        : products.value.filter(p =>
            (p.item || '').toLowerCase().includes(q)
        )
}

const addTolist = () => {
    if (!chosenProduct.value || !props.measurement) return

    emit('add-product', {
        measurementId: props.measurement.id,
        product: chosenProduct.value
    })

    chosenProduct.value = ''
}
</script>

<style scoped>
.card {
    width: 25rem;
    --p-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    flex: 1 1 250px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1rem;
}

.measurement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.measurement-title {
    font-weight: 600;
}
</style>
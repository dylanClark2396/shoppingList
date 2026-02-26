<template>
    <Card class="card">
        <template #title>
            <div class="measurement-header">

                <!-- DISPLAY MODE -->
                <template v-if="!isEditing">
                    <span class="measurement-title">
                        {{ props.measurement?.name }}
                    </span>
                    <div>
                        <Button icon="pi pi-times" size="small" outlined severity="danger" aria-label="Remove"
                            @click="console.log('removed')" style="margin-right: 1rem;" />
                        <Button icon="pi pi-pencil" size="small" outlined severity="warning" aria-label="Edit"
                            @click="toggleEdit" />
                    </div>
                </template>

                <!-- EDIT MODE -->
                <template v-else>
                    <IftaLabel>
                        <InputText id="name" v-model="editable.name" class="w-full" />
                        <label for="name">Name</label>
                    </IftaLabel>

                    <Button icon="pi pi-times" size="small" severity="danger" @click="toggleEdit" />
                    <Button icon="pi pi-check" size="small" severity="success" @click="saveMeasurementEdit" />
                </template>

            </div>
        </template>
        <template #subtitle>

            <!-- DISPLAY MODE -->
            <template v-if="!isEditing">
                <div>
                    {{ props.measurement?.quantity }},
                    {{ props.measurement?.dimensions?.depth }} x
                    {{ props.measurement?.dimensions?.width }} x
                    {{ props.measurement?.dimensions?.height }},
                    {{ props.measurement?.category }}
                </div>
                <div>
                    {{ props.measurement?.note }}
                </div>
            </template>

            <!-- EDIT MODE -->
            <template v-else>
                <div class="measurement-grid">
                    <!-- ROW 1 -->
                    <div class="measurement-row row-top">
                        <IftaLabel>
                            <InputNumber id="quantity" class="compact-input" placeholder="Quantity"
                                v-model="editable.quantity" />
                            <label for="quantity">Quantity</label>
                        </IftaLabel>
                        <Select v-model="editable.category" :options="categoryOptions" optionLabel="label"
                            optionValue="value" placeholder="Category" class="category-dropdown" />
                    </div>

                    <!-- ROW 2 -->
                    <div class="measurement-row row-bottom">
                        <IftaLabel>
                            <InputText id="depth" class="compact-input" placeholder="Depth" v-model="editable.depth" />
                            <label for="depth">Depth</label>
                        </IftaLabel>
                        <IftaLabel>
                            <InputText id="width" class="compact-input" placeholder="Width" v-model="editable.width" />
                            <label for="width">Width</label>
                        </IftaLabel>
                        <IftaLabel>
                            <InputText id="height" class="compact-input" placeholder="Height"
                                v-model="editable.height" />
                            <label for="height">Height</label>
                        </IftaLabel>
                    </div>

                    <div class="measurement-row">
                        <Textarea v-model="editable.note" placeholder="Notes!" autoResize rows="5" cols="30" />
                    </div>
                </div>
            </template>

        </template>
        <template #content>
            <!-- dynamic list of addable product -->
            <div style="margin-bottom: 0.5rem;">
                <AutoComplete v-model="chosenProduct" @complete="search" :suggestions="filteredProducts"
                    optionLabel="item" dataKey="sku" placeholder="Add Product" @option-select="handleAddTolist">
                    <template #option="slotProps">
                        <div class="flex items-center">
                            <div>{{ slotProps.option.item }}</div>
                            <div>{{ slotProps.option.dimensions }}</div>
                        </div>
                    </template>
                </AutoComplete>
            </div>
            <Accordion :value="activePanels" multiple>
                <AccordionPanel v-for="product in props.measurement?.products" :key="product.sku" :value="product.sku"
                    style="display: flex; justify-content:left;">
                    <AccordionHeader>
                        <Button style="margin-right: .5rem; max-width: 1.5rem;" outlined icon="pi pi-times"
                            severity="danger" @click.stop="handleRemove(product.sku)" />

                        <span class="font-bold whitespace-nowrap">
                            {{ product.item }}
                        </span>

                    </AccordionHeader>
                    <AccordionContent>
                        <div class="accordion-row">
                            <div class="accordion-left">
                                <div class="flex items-start">
                                    <InputNumber v-model="product.quantity" showButtons buttonLayout="vertical"
                                        style="width: 3rem" size="small" :min="0" :max="99"
                                        @update:model-value="val => handleProductUpdate(product.sku, val ?? 0)">
                                        <template #incrementicon>
                                            <span class="pi pi-plus" />
                                        </template>
                                        <template #decrementicon>
                                            <span class="pi pi-minus" />
                                        </template>
                                    </InputNumber>
                                </div>
                            </div>
                            <div class="accordion-right">
                                <div class="flex justify-center" v-if="product.images?.length">
                                    <Image v-for="value in product.images" :key="value" :src="'/' + value" alt="Image"
                                        width="50" preview />
                                </div>

                                <div class="flex flex-wrap tag-spacing">
                                    <Tag class="mr-2 mb-2" :value="`${product.sku}`" severity="info" />
                                    <Tag class="mr-2 mb-2" :value="`$${product.price}`" severity="info" />
                                    <Tag v-if="product.vendor" class="mr-2 mb-2" :value="product.vendor"
                                        severity="info" />
                                    <Tag v-if="product.sheetName" class="mr-2 mb-2" :value="product.sheetName"
                                        severity="secondary" />
                                    <Tag v-if="product.dimensions" class="mr-2 mb-2" :value="product.dimensions" />
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
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
    allProducts?: Product[];
    measurement?: Measurement;
}>()

const emit = defineEmits<{
    (e: 'add-product', payload: { measurementId: number; product: Product }): void
    (e: 'remove-product', payload: { measurementId: number; sku: number }): void
    (e: 'update-product-quantity', payload: { measurementId: number; sku: number, updates: Partial<Product> }): void
    (e: 'update-measurement', value: Measurement): void
}>()

const isEditing = ref(false)

// Create a local editable copy
const editable = reactive({
    name: '',
    quantity: 0,
    depth: '',
    width: '',
    height: '',
    category: '',
    note: ''
})

const categoryOptions = [
    { label: 'Drawer', value: 'Drawer' },
    { label: 'Cabinet', value: 'Cabinet' },
    { label: 'Shelf', value: 'Shelf' }
]

const activePanels = ref<string[]>([])

const chosenProduct = ref<Product>();

const products = computed<Product[]>(() => props.allProducts ?? [])

const filteredProducts = ref<Product[]>([])

watch(
    () => props.measurement,
    (val) => {
        if (!val) return
        editable.name = val.name
        editable.quantity = val.quantity ?? 0
        editable.depth = val.dimensions?.depth ?? ''
        editable.width = val.dimensions?.width ?? ''
        editable.height = val.dimensions?.height ?? ''
        editable.category = val.category ?? ''
        editable.note = val.note ?? ''
    },
    { immediate: true }
)

function saveMeasurementEdit() {
    if (!props.measurement) return

    emit('update-measurement', {
        ...props.measurement,
        name: editable.name,
        quantity: editable.quantity,
        category: editable.category,
        dimensions: {
            depth: editable.depth,
            width: editable.width,
            height: editable.height
        },
        note: editable.note
    })

    isEditing.value = false
}

function toggleEdit() {
    isEditing.value = !isEditing.value
}

const search = ({ query }: AutoCompleteCompleteEvent) => {
    const q = (query || '').trim().toLowerCase()

    filteredProducts.value = !q
        ? [...products.value]
        : products.value.filter(p =>
            (p.item || '').toLowerCase().includes(q)
        )
}

const handleAddTolist = () => {
    if (!chosenProduct.value || !props.measurement) return

    emit('add-product', {
        measurementId: props.measurement.id,
        product: chosenProduct.value
    })

    chosenProduct.value = undefined
}

const handleRemove = (sku: number) => {
    if (!sku || !props.measurement) return
    emit('remove-product', {
        measurementId: props.measurement.id,
        sku
    })
}
const handleProductUpdate = (sku: number, productQuantity: number) => {
    if (!sku || !props.measurement) return
    emit('update-product-quantity', {
        measurementId: props.measurement.id,
        sku,
        updates: { 'quantity': productQuantity } as Partial<Product>
    })
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

.measurement-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}

.measurement-row {
    display: grid;
    gap: .5rem;
    align-items: center;
}

/* first row: 2 columns */
.row-top {
    grid-template-columns: 105px 1fr;
}

/* second row: 3 equal columns */
.row-bottom {
    grid-template-columns: repeat(3, 1fr);
}

/* compact numeric inputs */
.compact-input {
    max-width: 100px;
}

.compact-input :deep(.p-inputtext) {
    width: 100%;
}

/* make dropdown fill nicely */
.category-dropdown {
    width: 100%;
}

.tag-spacing>* {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
}

/* optional: remove margin on last item in row */
.tag-spacing>*:last-child {
    margin-right: 0;
}

.accordion-row {
    display: flex;
    width: 100%;
    align-items: flex-start;
    gap: 1rem;
}

.accordion-right {
    flex: 1;
}

.accordion-left {
    flex: 0 0 3rem;
}
</style>
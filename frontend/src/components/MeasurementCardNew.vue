<template>
  <Card class="card">
    <template #title>
      <div class="flex flex-col">
        <div style="margin-bottom: 0.5rem">
          <span class="new-measurement-title">
            Add a New Measurement!
          </span>
        </div>
        <Inputtext placeholder="Name" v-model="measurementName" />
      </div>
    </template>
    <template #content>
      <div class="measurement-grid">
        <!-- ROW 1 -->
        <div class="measurement-row row-top">
          <InputNumber class="compact-input" placeholder="Quantity" v-model="measurementQuantity" />
          <Select v-model="measurementCategory" :options="categoryOptions" optionLabel="label" optionValue="value"
            placeholder="Category" class="category-dropdown" />
        </div>

        <!-- ROW 2 -->
        <div class="measurement-row row-bottom">
          <InputText class="compact-input" placeholder="Depth" v-model="measurementDepth" />
          <InputText class="compact-input" placeholder="Width" v-model="measurementWidth" />
          <InputText class="compact-input" placeholder="Height" v-model="measurementHeight" />
        </div>
        <div>
          <Textarea v-model="measurementNote" placeholder="Notes!" autoResize rows="5" cols="30" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button :label="isEditMode ? 'Update' : 'Create'" outlined @click="submit" />
      </div>
    </template>
  </Card>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Measurement } from '@/models';

const props = defineProps<{
  measurement?: Measurement
}>()

const emit = defineEmits<{
  (e: 'create-measurement', value: Partial<Measurement>): void
  (e: 'update-measurement', value: Measurement): void
}>()

const isEditMode = computed(() => !!props.measurement)

const measurementName = ref(props.measurement?.name ?? '')
const measurementQuantity = ref(props.measurement?.quantity ?? null)
const measurementDepth = ref(props.measurement?.dimensions?.depth ?? null)
const measurementWidth = ref(props.measurement?.dimensions?.width ?? null)
const measurementHeight = ref(props.measurement?.dimensions?.height ?? null)
const measurementCategory = ref(props.measurement?.category ?? '')
const measurementNote = ref(props.measurement?.note ?? '')


const categoryOptions = [
  { label: 'Drawer', value: 'Drawer' },
  { label: 'Cabinet', value: 'Cabinet' },
  { label: 'Shelf', value: 'Shelf' }
]

function buildMeasurement(): Partial<Measurement> {
  const measurement: Partial<Measurement> = {
    name: measurementName.value,
    quantity: measurementQuantity.value,
    category: measurementCategory.value,
    dimensions: {
      depth: measurementDepth.value,
      width: measurementWidth.value,
      height: measurementHeight.value
    },
    note: measurementNote.value
  }
  if (isEditMode.value) {
    measurement.id = props.measurement?.id
  }
  return measurement
}

function submit() {
  const payload = buildMeasurement()

  if (isEditMode.value) {
    emit('update-measurement', payload as Measurement)
  } else {
    emit('create-measurement', payload)
    // reset form after creation
    measurementName.value = ''
    measurementQuantity.value = null
    measurementDepth.value = null
    measurementWidth.value = null
    measurementHeight.value = null
    measurementCategory.value = ''
    measurementNote.value = ''
  }
}

</script>

<style scoped>
.card {
  width: 25rem;
  --p-card-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  flex: 0 0 25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
}

@media (max-width: 768px) {
  .card {
    max-width: 100%;
    width: 100%;
    flex: 1 1 100%;
    height: auto;
  }
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

.new-measurement-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--p-surface-700);
  line-height: 1;
}
</style>
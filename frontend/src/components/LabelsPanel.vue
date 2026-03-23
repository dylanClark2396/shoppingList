<template>
  <div class="labels-panel">
    <div class="labels-header">
      <span class="labels-title">Labels</span>
      <Button label="Add Label" icon="pi pi-plus" size="small" outlined @click="openCreateForm" />
    </div>

    <DataTable :value="sortedLabels" size="small" class="labels-table">
      <template #empty>
        <span class="empty-msg">No labels yet. Add one to get started.</span>
      </template>
      <Column field="machine" header="Machine" style="width: 100px" />
      <Column field="spaceName" header="Space" style="width: 120px" />
      <Column field="labelName" header="Label Name" />
      <Column field="color" header="Color" style="width: 150px" />
      <Column header="Size / Substrate" style="width: 180px">
        <template #body="{ data }">
          {{ data.machine === 'P-touch' ? data.size : data.substrate }}
        </template>
      </Column>
      <Column field="quantity" header="Qty" style="width: 60px" />
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" text size="small" @click="openEditForm(data)" />
            <Button icon="pi pi-trash" text size="small" severity="danger" @click="handleDelete(data.id)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showForm" :header="isEditing ? 'Edit Label' : 'Add Labels'" modal style="width: 500px">
      <div class="form-fields">
        <!-- Space (top) -->
        <Select
          v-model="form.spaceName"
          :options="spaceOptions"
          option-label="name"
          option-value="name"
          placeholder="Space"
          editable
          fluid
        />

        <!-- Machine -->
        <Select
          v-model="form.machine"
          :options="['P-touch', 'Cricut']"
          placeholder="Machine"
          fluid
          @change="onMachineChange"
        />

        <!-- P-touch fields -->
        <template v-if="form.machine === 'P-touch'">
          <Select
            v-model="form.color"
            :options="PTOUCH_COLORS"
            placeholder="Color"
            fluid
          />
          <Select
            v-model="form.size"
            :options="PTOUCH_SIZES"
            placeholder="Size"
            fluid
          />
        </template>

        <!-- Cricut fields -->
        <template v-else-if="form.machine === 'Cricut'">
          <Select
            v-model="form.substrate"
            :options="CRICUT_SUBSTRATE_OPTIONS"
            option-group-label="label"
            option-group-children="items"
            option-label="label"
            option-value="value"
            placeholder="What it prints on"
            fluid
          />
          <Select
            v-model="form.color"
            :options="CRICUT_COLORS"
            placeholder="Color"
            fluid
          />
        </template>

        <!-- Label text list (create mode) -->
        <div v-if="!isEditing" class="label-text-section">
          <div class="label-text-input-row">
            <InputText
              v-model="labelTextInput"
              placeholder="What the label says"
              style="flex: 1"
              @keyup.enter="addLabelText"
            />
            <InputNumber
              v-model="labelQtyInput"
              placeholder="Qty"
              :min="1"
              style="width: 80px"
            />
            <Button icon="pi pi-plus" outlined @click="addLabelText" :disabled="!labelTextInput.trim()" />
          </div>
          <div v-if="labelTexts.length" class="label-text-chips">
            <Chip
              v-for="(entry, i) in labelTexts"
              :key="i"
              :label="entry.quantity ? `${entry.text} ×${entry.quantity}` : entry.text"
              removable
              @remove="removeLabelText(i)"
            />
          </div>
        </div>

        <!-- Label text + quantity (edit mode) -->
        <template v-else>
          <InputText v-model="form.labelName" placeholder="What the label says" fluid />
          <InputNumber v-model="form.quantity" placeholder="Quantity" fluid :min="1" />
        </template>

        <!-- Notes -->
        <Textarea v-model="form.notes" placeholder="Notes" fluid rows="2" auto-resize />
      </div>
      <template #footer>
        <Button label="Cancel" outlined @click="showForm = false" />
        <Button label="Save" @click="handleSave" :disabled="!canSave" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Project, Label } from '@/models'

const props = defineProps<{ project: Project }>()

const emit = defineEmits<{
  (e: 'label-created', labels: Omit<Label, 'id'>[]): void
  (e: 'label-updated', label: Label): void
  (e: 'label-deleted', labelId: number): void
}>()

const PTOUCH_COLORS = ['Black on clear', 'White on clear']
const PTOUCH_SIZES = ['.47in', '.94in']
const CRICUT_COLORS = ['White', 'Black', 'Cream', 'Gold']

const CRICUT_SUBSTRATE_OPTIONS = [
  {
    label: 'Surface',
    items: [{ label: 'Acrylic bin', value: 'Acrylic bin' }],
  },
  {
    label: 'Bin clip',
    items: [
      { label: 'Horderly bin clip', value: 'Horderly bin clip' },
      { label: 'The bin clip', value: 'The bin clip' },
      { label: 'Sortjoy bin clip', value: 'Sortjoy bin clip' },
      { label: 'Neat method bin clip', value: 'Neat method bin clip' },
    ],
  },
  {
    label: 'Direct transfer',
    items: [
      { label: 'Direct transfer onto canister', value: 'Direct transfer onto canister' },
      { label: 'Direct transfer onto basket', value: 'Direct transfer onto basket' },
      { label: 'Direct transfer onto shelf', value: 'Direct transfer onto shelf' },
      { label: 'Direct transfer onto other', value: 'Direct transfer onto other' },
    ],
  },
]

const MACHINE_ORDER: Record<string, number> = { 'P-touch': 0, 'Cricut': 1 }

const sortedLabels = computed(() =>
  [...(props.project.labels ?? [])].sort((a, b) => {
    const diff = (MACHINE_ORDER[a.machine] ?? 99) - (MACHINE_ORDER[b.machine] ?? 99)
    return diff !== 0 ? diff : a.color.localeCompare(b.color)
  })
)

const spaceOptions = computed(() => props.project.spaces)

const showForm = ref(false)
const isEditing = ref(false)
const form = ref<Partial<Label>>({})
const labelTextInput = ref('')
const labelQtyInput = ref<number | null>(null)
const labelTexts = ref<{ text: string; quantity: number | null }[]>([])

const canSave = computed(() => {
  if (!form.value.machine) return false
  if (isEditing.value) return !!form.value.labelName
  return labelTexts.value.length > 0
})

function onMachineChange() {
  form.value = {
    spaceName: form.value.spaceName,
    machine: form.value.machine,
    notes: form.value.notes,
  }
}

function openCreateForm() {
  form.value = {}
  labelTextInput.value = ''
  labelQtyInput.value = null
  labelTexts.value = []
  isEditing.value = false
  showForm.value = true
}

function openEditForm(label: Label) {
  form.value = { ...label }
  labelTextInput.value = ''
  labelQtyInput.value = null
  labelTexts.value = []
  isEditing.value = true
  showForm.value = true
}

function addLabelText() {
  const text = labelTextInput.value.trim()
  if (!text) return
  labelTexts.value.push({ text, quantity: labelQtyInput.value })
  labelTextInput.value = ''
  labelQtyInput.value = null
}

function removeLabelText(index: number) {
  labelTexts.value.splice(index, 1)
}

function handleSave() {
  if (!canSave.value) return
  if (isEditing.value) {
    emit('label-updated', form.value as Label)
  } else {
    const base = { ...form.value } as Omit<Label, 'id' | 'labelName' | 'quantity'>
    emit('label-created', labelTexts.value.map(entry => ({
      ...base,
      labelName: entry.text,
      quantity: entry.quantity ?? undefined,
    })))
  }
  showForm.value = false
}

function handleDelete(labelId: number) {
  emit('label-deleted', labelId)
}
</script>

<style scoped>
.labels-panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  overflow-y: auto;
}

.labels-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.labels-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.labels-table {
  width: 100%;
}

.row-actions {
  display: flex;
  gap: 0.25rem;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.label-text-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label-text-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.label-text-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.empty-msg {
  color: var(--p-surface-500);
  font-size: 0.9rem;
}
</style>

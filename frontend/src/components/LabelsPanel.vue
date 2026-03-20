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
      <Column field="machine" header="Machine" style="width: 110px" />
      <Column field="color" header="Color" />
      <Column field="labelName" header="Label Name" />
      <Column field="substrate" header="Substrate" />
      <Column field="spaceName" header="Space" />
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" text size="small" @click="openEditForm(data)" />
            <Button icon="pi pi-trash" text size="small" severity="danger" @click="handleDelete(data.id)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showForm" :header="editingLabel?.id ? 'Edit Label' : 'Add Label'" modal style="width: 420px">
      <div class="form-fields">
        <Select
          v-model="editingLabel.machine"
          :options="['P-touch', 'Cricut']"
          placeholder="Machine"
          fluid
        />
        <InputText v-model="editingLabel.color" placeholder="Color" fluid />
        <InputText v-model="editingLabel.labelName" placeholder="Label Name" fluid />
        <InputText v-model="editingLabel.substrate" placeholder="Substrate (what it prints on)" fluid />
        <Select
          v-model="editingLabel.spaceName"
          :options="spaceOptions"
          option-label="name"
          option-value="name"
          placeholder="Space"
          editable
          fluid
        />
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
  (e: 'label-created', label: Label): void
  (e: 'label-updated', label: Label): void
  (e: 'label-deleted', labelId: number): void
}>()

const MACHINE_ORDER: Record<string, number> = { 'P-touch': 0, 'Cricut': 1 }

const sortedLabels = computed(() =>
  [...(props.project.labels ?? [])].sort((a, b) => {
    const diff = (MACHINE_ORDER[a.machine] ?? 99) - (MACHINE_ORDER[b.machine] ?? 99)
    return diff !== 0 ? diff : a.color.localeCompare(b.color)
  })
)

const spaceOptions = computed(() => props.project.spaces)

const showForm = ref(false)
const editingLabel = ref<Partial<Label>>({})

const canSave = computed(() =>
  !!editingLabel.value.machine &&
  !!editingLabel.value.labelName
)

function openCreateForm() {
  editingLabel.value = {}
  showForm.value = true
}

function openEditForm(label: Label) {
  editingLabel.value = { ...label }
  showForm.value = true
}

function handleSave() {
  if (!canSave.value) return
  if (editingLabel.value.id) {
    emit('label-updated', editingLabel.value as Label)
  } else {
    emit('label-created', editingLabel.value as Omit<Label, 'id'>)
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

.empty-msg {
  color: var(--p-surface-500);
  font-size: 0.9rem;
}
</style>

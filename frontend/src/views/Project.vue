<template>
  <!-- header section -->
  <div style="margin-bottom: 2rem;">
    <span class="topbar-title">
      {{ project?.name }} - {{ currentSpace?.name }}
    </span>
    <div style="margin-left: 1rem;">
      <Button label="Back" outlined size="large" @click="router.push('/')" />
    </div>
  </div>

  <!-- Main content section -->
  <div class="layout">
    <!-- space navigation menu -->
    <div class="space-menu left">
      <div class="spaces-header">
        <span class="spaces-title">Spaces</span>

        <Button icon="pi pi-pencil" size="small" outlined aria-label="Edit" @click="toggleSpaceEditPopover" />
      </div>

      <Popover ref="popover">
        <div class="add-space-popup">
          <InputText v-model="newSpaceName" placeholder="New space name" @keyup.enter="handleAddSpace"
            style="margin-right: .5rem;" />

          <Button label="Add" outlined severity="success" @click="handleAddSpace" />
        </div>
      </Popover>

      <div class="space-list">
        <div
          v-for="space in project?.spaces"
          :key="space.id"
          class="space-list-item"
          :class="{ active: currentSpace?.id === space.id }"
          @click="currentSpace = space"
        >
          <span class="space-list-label">{{ space.name }}</span>
          <Button
            icon="pi pi-times"
            size="small"
            text
            severity="danger"
            aria-label="Delete space"
            @click.stop="handleDeleteSpace(space.id)"
          />
        </div>
      </div>
    </div>



    <!-- measurement module section -->
    <div class="right">
      <!-- space photos -->
      <div v-if="currentSpace" class="space-photos-bar">
        <Image
          v-for="url in currentSpace.images"
          :key="url"
          :src="url"
          alt="Space photo"
          width="80"
          preview
          style="margin-right: 0.5rem;"
        />
        <label class="upload-btn">
          <i class="pi pi-image" style="margin-right: 0.25rem;" />
          Add Photo
          <input
            type="file"
            accept="image/*"
            style="display: none;"
            @change="handleSpacePhotoUpload"
          />
        </label>
      </div>

      <div class="cards-container">
        <MeasurementCardNew @create-measurement="handleCreateMeasurement"
          @update-measurement="handleUpdateMeasurement" />
        <div v-for="value in getcurrentSpace()?.measurements" :key="value.id">
          <MeasurementCard :measurement="value" :all-products="allProducts" @add-product="handleAddProduct"
            @remove-product="handleRemoveProduct" @update-measurement="handleUpdateMeasurement"
            @update-product-quantity="handleUpdateproductQuantity"
            @remove-measurement="handleDeleteMeasurement" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { onMounted, ref, watch } from "vue";
import MeasurementCard from "@/components/MeasurementCard.vue";
import router from "@/router";
import { useRoute } from "vue-router";
import type { Measurement, Product, Project, Space } from "@/models";
import { useApi } from '@/composables/useApi';
import MeasurementCardNew from "@/components/MeasurementCardNew.vue";

const {
  getProject,
  getProducts,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  addProductToMeasurement,
  createSpace,
  deleteSpace,
  updateSpace,
  getSpaceUploadUrl,
  removeProductFromMeasurement,
  updateProduct
} = useApi();

const route = useRoute();
const project = ref<Project | null>(null);
const currentSpace = ref<Space>();
const allProducts = ref<Product[]>([]);

watch(() => route.params.id, loadProject);

onMounted(async () => {
  loadProject();
  loadProducts();
});

const toggleSpaceEditPopover = (event: any) => {
  popover.value?.toggle(event);
};

const popover = ref();
const newSpaceName = ref('')

const getcurrentSpace = () => {
  return project.value?.spaces.find(space => space.id === currentSpace.value?.id);
}

async function loadProject() {
  const id = route.params.id;
  if (id) {
    project.value = await getProject(Number(id));
    currentSpace.value = project.value?.spaces[0];
  }
}

async function loadProducts() {
  allProducts.value = await getProducts();
}

async function handleCreateMeasurement(measurement: Partial<Measurement>) {
  const newMeasurement = await createMeasurement(Number(project.value?.id), Number(currentSpace.value?.id), measurement);

  project.value?.spaces.find(space => space.id === currentSpace.value?.id)?.measurements.push(newMeasurement)
}

function handleUpdateMeasurement(updated: Measurement) {
  updateMeasurement(Number(project.value?.id), Number(currentSpace.value?.id), updated.id, updated);

  const index = project.value?.spaces
    .find(space => space.id === currentSpace.value?.id)
    ?.measurements.findIndex(m => m.id === updated.id);

  if (index !== -1) {
    const space = project.value?.spaces.find(space => space.id === currentSpace.value?.id);
    space?.measurements.splice(index!, 1, updated);
  } else {
    console.error('Measurement not found for update');
  }
}

async function handleDeleteMeasurement(measurementId: number) {
  await deleteMeasurement(Number(project.value?.id), Number(currentSpace.value?.id), measurementId)
  const space = project.value?.spaces.find(s => s.id === currentSpace.value?.id)
  if (space) space.measurements = space.measurements.filter(m => m.id !== measurementId)
}

async function handleAddProduct(payload: { measurementId: number; product: Product }) {

  const newProduct = await addProductToMeasurement(Number(project.value?.id), Number(currentSpace.value?.id), payload.measurementId, payload.product);

  const measurement = project.value?.spaces
    .find(space => space.id === currentSpace.value?.id)
    ?.measurements.find(m => m.id === payload.measurementId);

  if (measurement) {
    measurement.products.push(newProduct);
  }

}

async function handleRemoveProduct(payload: {
  measurementId: number,
  sku: number
}) {
  await removeProductFromMeasurement(Number(project.value?.id), Number(currentSpace.value?.id), payload.measurementId, payload.sku)

  const measurement = project.value?.spaces
    .find(space => space.id === currentSpace.value?.id)
    ?.measurements.find(m => m.id === payload.measurementId);

  if (measurement?.products) {
    measurement.products = measurement.products.filter(
      p => p.sku !== payload.sku
    )
  }
}

async function handleAddSpace() {
  const name = newSpaceName.value.trim()
  if (!name) return

  const newSpace: Partial<Space> = {
    name,
    measurements: []
  }

  const spaceRes = await createSpace(Number(project.value?.id), newSpace)

  project.value?.spaces.push(spaceRes)

  currentSpace.value = spaceRes

  newSpaceName.value = ''
  popover.value?.hide()
}

async function handleDeleteSpace(spaceId: number) {
  await deleteSpace(Number(project.value?.id), spaceId)
  if (project.value) {
    project.value.spaces = project.value.spaces.filter(s => s.id !== spaceId)
    if (currentSpace.value?.id === spaceId) {
      currentSpace.value = project.value.spaces[0]
    }
  }
}

async function handleSpacePhotoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !currentSpace.value || !project.value) return

  const { uploadUrl, publicUrl } = await getSpaceUploadUrl(
    Number(project.value.id),
    Number(currentSpace.value.id),
    file.name
  )

  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  })

  const updatedImages = [...(currentSpace.value.images ?? []), publicUrl]
  await updateSpace(Number(project.value.id), Number(currentSpace.value.id), { images: updatedImages })

  currentSpace.value.images = updatedImages

  // reset the file input
  ;(event.target as HTMLInputElement).value = ''
}

async function handleUpdateproductQuantity(payload: {
  measurementId: number,
  sku: number
  updates: Partial<Product>
}) {
  if (!project.value || !currentSpace.value) return

  const updateRes = await updateProduct(Number(project.value?.id), Number(currentSpace.value?.id), payload.measurementId, payload.sku, payload.updates)

  const measurement = project.value?.spaces
    .find(space => space.id === currentSpace.value?.id)
    ?.measurements.find(m => m.id === payload.measurementId);


  if (!measurement || !measurement.products) return

  measurement.products = measurement.products.map(p =>
    p.sku === payload.sku ? updateRes : p
  )

}

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
  flex: 0 0 200px;
}

.right {
  flex: 1;
}

.cards-container {
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  overflow-y: auto;
  height: 85vh;
}

.spaces-title {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
}

.spaces-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: .5rem;
}

.space-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.space-list-item:hover {
  background: var(--p-surface-100);
}

.space-list-item.active {
  background: var(--p-primary-50);
  font-weight: 600;
}

.space-list-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
}

.space-photos-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.75rem;
  border: 1px dashed var(--p-surface-400);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--p-surface-600);
  transition: border-color 0.15s, color 0.15s;
}

.upload-btn:hover {
  border-color: var(--p-primary-500);
  color: var(--p-primary-500);
}
</style>

<template>
  <div class="page">
  <!-- header section -->
  <div class="topbar">
    <Button label="Back" outlined @click="router.push('/')" />
    <span class="topbar-title">
      {{ project?.name }} - {{ currentSpace?.name }}
    </span>
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
        <div v-for="space in project?.spaces" :key="space.id" class="space-list-item"
          :class="{ active: currentSpace?.id === space.id }" @click="currentSpace = space">
          <span class="space-list-label">{{ space.name }}</span>
          <Button icon="pi pi-times" size="small" text severity="danger" aria-label="Delete space"
            @click.stop="handleDeleteSpace(space.id)" />
        </div>
      </div>
    </div>



    <!-- measurement module section -->
    <div class="right">
      <!-- space photos -->
      <div v-if="currentSpace" class="space-photos-bar">
        <label class="upload-btn">
          <i class="pi pi-image" style="margin-right: 0.25rem;" />
          Add Photo
          <input type="file" multiple accept="image/*" style="display: none;" @change="handleSpacePhotoUpload" />
        </label>
        <div class="photo-thumbs-row">
          <div v-for="url in currentSpace.images" :key="url" class="photo-thumb-wrapper">
            <Image :src="url" alt="Space photo" width="80" preview />
            <Button
              icon="pi pi-times"
              size="small"
              severity="danger"
              rounded
              class="photo-delete-btn"
              @click="handleDeleteSpaceImage(url)"
            />
          </div>
        </div>
      </div>

      <div class="cards-container">
        <MeasurementCardNew @create-measurement="handleCreateMeasurement"
          @update-measurement="handleUpdateMeasurement" />
        <MeasurementCard v-for="value in getcurrentSpace()?.measurements" :key="value.id"
          :measurement="value" :all-products="allProducts" @add-product="handleAddProduct"
          @remove-product="handleRemoveProduct" @update-measurement="handleUpdateMeasurement"
          @update-product-quantity="handleUpdateproductQuantity" @remove-measurement="handleDeleteMeasurement" />
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
  deleteSpaceImage,
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

async function handleDeleteSpaceImage(url: string) {
  if (!currentSpace.value || !project.value) return
  await deleteSpaceImage(Number(project.value.id), Number(currentSpace.value.id), url)
  currentSpace.value.images = (currentSpace.value.images ?? []).filter(i => i !== url)
}

async function handleSpacePhotoUpload(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length || !currentSpace.value || !project.value) return

  const newUrls: string[] = []

  for (const file of files) {
    const { uploadUrl, publicUrl } = await getSpaceUploadUrl(
      Number(project.value.id),
      Number(currentSpace.value.id),
      file.name,
      file.type
    )

    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    })

    newUrls.push(publicUrl)
  }

  const updatedImages = [...(currentSpace.value.images ?? []), ...newUrls]
  await updateSpace(Number(project.value.id), Number(currentSpace.value.id), { images: updatedImages })

  currentSpace.value.images = updatedImages

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
/* ── Page wrapper ── */
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── Topbar ── */
.topbar {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem 1.5rem;
  gap: 0.75rem;
  flex-shrink: 0;
}

.topbar-title {
  font-size: 2rem;
  font-weight: 500;
  color: var(--p-surface-700);
  line-height: 1.1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Main layout ── */
.layout {
  display: flex;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.space-menu {
  margin: 0 1rem;
}

.left {
  flex: 0 0 230px;
  overflow-y: auto;
}

.right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Spaces sidebar ── */
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
  margin-bottom: 0.5rem;
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

/* ── Cards ── */
.cards-container {
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-content: flex-start;
  align-items: flex-start;
  overflow-y: auto;
  flex: 1;
}

/* ── Space photos ── */
.space-photos-bar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0 0 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.photo-thumbs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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

.photo-thumb-wrapper {
  position: relative;
  display: inline-flex;
}

.photo-delete-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 1.25rem !important;
  height: 1.25rem !important;
  padding: 0 !important;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .topbar-title {
    font-size: 1.25rem;
  }

  .layout {
    flex-direction: column;
  }

  .left {
    flex: none;
    width: 100%;
  }

  .space-menu {
    margin: 0 0.5rem;
  }

  /* Spaces become a horizontal scrollable tab strip */
  .space-list {
    flex-direction: row;
    overflow-x: auto;
    flex-wrap: nowrap;
    gap: 0.25rem;
    padding-bottom: 0.5rem;
    -webkit-overflow-scrolling: touch;
  }

  .space-list-item {
    flex-shrink: 0;
    padding: 0.35rem 0.6rem;
  }

  .space-list-label {
    white-space: nowrap;
    overflow: visible;
  }

  .cards-container {
    height: auto;
    min-height: 50vh;
    padding: 0.5rem;
  }

  .space-photos-bar {
    padding: 0.5rem 0.5rem 0.75rem;
  }
}
</style>

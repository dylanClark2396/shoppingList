<template>
  <div class="app-container">
    <div class="dataview-wrapper">
      <h1 class="title">Projects</h1>

      <div style="display: flex; justify-content: flex-end; margin-bottom: .5rem;">
        <Button label="Create Project" class="btn-outlined" @click="handleCreateProject"
          :disabled="!newProjectName || newSpaces.length === 0" />
      </div>

      <div class="list-item flex gap-4 items-start w-full">

        <div class="flex flex-col gap-2">
          <div style="margin-bottom: 1rem;">
            <InputText type="text" placeholder="Project Name" v-model="newProjectName" class="w-full" />
          </div>
          <div>
            <div class="space-input">
              <InputText placeholder="Add Space and press Enter" v-model="spaceInput" @keydown.enter.prevent="addSpace"
                class="w-full" />

              <!-- Chips -->
              <div class="chips-container flex flex-wrap gap-2 mt-2">
                <span v-for="(space, index) in newSpaces" :key="index" class="chip">
                  {{ space }}
                  <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-sm"
                    @click="removeSpace(index)" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DataView :value="projects" layout="list">
        <!-- List layout -->
        <template #list="slotProps">
          <div class="list-container">
            <div v-for="item in slotProps.items" :key="item.id" class="list-item">
              <span class="item-name">{{ item.name }}</span>
              <Button label="Open" class="btn-outlined" @click="openProject(item.id)" />
            </div>
          </div>
        </template>
      </DataView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import router from '@/router';
import type { Project, Space } from '@/models';
import { useApi } from '@/composables/useApi';

const { getProjects, createProject, createSpace } = useApi();

const newProjectName = ref(null);

const newSpaces = ref<String[]>([]);

const projects = ref<Project[]>([]);

const spaceInput = ref('');

onMounted(loadProjects);

async function loadProjects() {
  projects.value = await getProjects();
}

async function handleCreateProject() {
  if (!newProjectName.value) return;

  const projectRes = await createProject({
    name: newProjectName.value,
    spaces: []
  });

  for (const spaceName of newSpaces.value) {

    const newSpace: Partial<Space> = {
      name: spaceName.toString(),
      measurements: []
    };

    createSpace(projectRes.id, newSpace)
  }

  projects.value.push(projectRes);

  // Reset inputs
  newProjectName.value = null;
  newSpaces.value = [];
}

const openProject = (id: number) => {
  router.push({ name: 'Project', params: { id } });
}

const addSpace = () => {
  const trimmed = spaceInput.value.trim();
  if (trimmed && !newSpaces.value.includes(trimmed)) {
    newSpaces.value.push(trimmed);
  }
  spaceInput.value = '';
};

const removeSpace = (index: number) => {
  newSpaces.value.splice(index, 1);
};

</script>

<style scoped>
/* Center everything and prevent scrollbars */
.app-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;
  min-height: 100%;
  padding: 1rem;
}

.dataview-wrapper {
  width: 100%;
  max-width: 800px;
}

/* Title */
.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  text-align: center;
}

/* List layout */
.list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.item-name {
  font-weight: 500;
}

@media (max-width: 768px) {
  .list-item {
    gap: 0.5rem;
  }
}
</style>

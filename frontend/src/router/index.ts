import { createRouter, createWebHistory } from 'vue-router'

import Project from '@/views/Project.vue'
import Projects from '@/views/Projects.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Projects',
      component: Projects
    },
    {
      path: '/project',
      name: 'Project',
      component: Project
    }
  ],
})

export default router

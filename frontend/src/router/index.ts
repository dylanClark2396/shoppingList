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
      path: '/project/:id',
      name: 'Project',
      component: Project
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/callback',
      name: 'Callback',
      component: () => import('@/views/CallbackView.vue')
    }
  ],
})

const PUBLIC_ROUTES = ['/login', '/callback']

router.beforeEach((to) => {
  const token = localStorage.getItem('access_token')
  if (!PUBLIC_ROUTES.includes(to.path) && !token) {
    return '/login'
  }
})

export default router

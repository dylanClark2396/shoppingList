<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="title">Project Manager</h1>
      <p class="subtitle">Sign in to continue</p>
      <Button
        label="Sign in with Google"
        icon="pi pi-google"
        class="w-full"
        @click="login"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

const { login } = useAuth()
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin: 0;
}

.subtitle {
  text-align: center;
  margin: 0;
  color: #666;
}
</style>

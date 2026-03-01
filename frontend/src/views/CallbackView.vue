<template>
  <div class="callback-container">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else>Signing you in...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { handleCallback } = useAuth()
const error = ref('')

onMounted(async () => {
  const code = new URLSearchParams(window.location.search).get('code')
  if (!code) {
    error.value = 'No authorization code found.'
    return
  }
  try {
    await handleCallback(code)
    router.push('/')
  } catch (e) {
    error.value = 'Sign in failed. Please try again.'
  }
})
</script>

<style scoped>
.callback-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.error {
  color: red;
}
</style>

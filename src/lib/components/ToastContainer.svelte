<script lang="ts">
  import Toast from './Toast.svelte';
  import { toastManager } from '@/lib/shared/toastManager';

  const toasts = toastManager.toasts;

  function handleToastClose(id: string) {
    toastManager.remove(id);
  }
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <Toast 
      type={toast.type}
      message={toast.message}
      duration={toast.duration}
      onClose={() => handleToastClose(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 1000;
    pointer-events: none;
  }

  .toast-container :global(.toast) {
    position: relative;
    margin-bottom: 0.75rem;
    margin-top: 1rem;
    margin-right: 1rem;
  }

  .toast-container :global(.toast:first-child) {
    margin-top: 1rem;
  }
</style>
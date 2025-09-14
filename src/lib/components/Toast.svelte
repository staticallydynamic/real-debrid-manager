<script lang="ts">
  import { UI_CONFIG } from '@/lib/shared/constants';

  export interface ToastProps {
    type?: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
    onClose?: () => void;
  }

  const { type = 'info', message, duration = UI_CONFIG.NOTIFICATION_DURATION, onClose } = $props<ToastProps>();

  let visible = $state(true);

  // Auto-hide after duration
  setTimeout(() => {
    visible = false;
    setTimeout(() => onClose?.(), 300); // Wait for fade animation
  }, duration);

  function handleClose() {
    visible = false;
    setTimeout(() => onClose?.(), 300);
  }

  // Map toast types to icons and colors
  const toastConfig = {
    success: { icon: 'fa-check-circle', colorClass: 'is-success' },
    error: { icon: 'fa-exclamation-circle', colorClass: 'is-danger' },
    warning: { icon: 'fa-exclamation-triangle', colorClass: 'is-warning' },
    info: { icon: 'fa-info-circle', colorClass: 'is-info' }
  };

  const config = toastConfig[type];
</script>

<div class="toast {config.colorClass}" class:visible>
  <div class="toast-content">
    <span class="toast-icon">
      <i class="fas {config.icon}"></i>
    </span>
    <span class="toast-message">{message}</span>
    <button 
      class="toast-close" 
      onclick={handleClose}
      aria-label="Close notification"
    >
      <i class="fas fa-times"></i>
    </button>
  </div>
</div>

<style>
  .toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    min-width: 300px;
    max-width: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .toast.visible {
    transform: translateX(0);
    opacity: 1;
    pointer-events: all;
  }

  .toast-content {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    color: white;
    gap: 0.75rem;
  }

  .toast.is-success .toast-content {
    background: linear-gradient(135deg, #48c78e 0%, #3dbb81 100%);
  }

  .toast.is-error .toast-content {
    background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  }

  .toast.is-warning .toast-content {
    background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
    color: #333;
  }

  .toast.is-info .toast-content {
    background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  }

  .toast-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0.8;
    transition: all 0.2s ease;
  }

  .toast-close:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .toast.is-warning .toast-close:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }

  .toast-close i {
    font-size: 0.8rem;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .toast {
      left: 1rem;
      right: 1rem;
      min-width: auto;
      max-width: none;
    }
  }
</style>
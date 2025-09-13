import { writable } from 'svelte/store';
import { UI_CONFIG } from './constants';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

class ToastManager {
  private static instance: ToastManager;
  private toastsStore = writable<ToastItem[]>([]);
  private nextId = 1;

  private constructor() {}

  public static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  public get toasts() {
    return this.toastsStore;
  }

  public show(
    message: string, 
    type: ToastItem['type'] = 'info', 
    duration: number = UI_CONFIG.NOTIFICATION_DURATION
  ): string {
    const id = `toast-${this.nextId++}`;
    
    const toast: ToastItem = {
      id,
      type,
      message,
      duration
    };

    this.toastsStore.update(toasts => [...toasts, toast]);

    // Auto-remove after duration + animation time
    setTimeout(() => {
      this.remove(id);
    }, duration + 300);

    return id;
  }

  public remove(id: string): void {
    this.toastsStore.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  public clear(): void {
    this.toastsStore.set([]);
  }

  // Convenience methods
  public success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  public error(message: string, duration?: number): string {
    return this.show(message, 'error', duration);
  }

  public warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  public info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }
}

export const toastManager = ToastManager.getInstance();
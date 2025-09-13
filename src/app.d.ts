// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

// Svelte 5 runes global types
declare global {
  // Svelte 5 runes
  function $state<T>(initial?: T): T;
  function $derived<T>(fn: () => T): T;
  function $effect(fn: () => void | (() => void)): void;
  function $props<T = Record<string, any>>(): T;
  function $bindable<T>(initial?: T): T;

  // Legacy reactive declarations are still available
  var $: any;
}

export {};
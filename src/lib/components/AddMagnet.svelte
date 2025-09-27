<script lang="ts">
  import { RealDebridAPI } from '@/lib/shared/RealDebridAPI';
  import type { AvailableHost } from '@/lib/shared/types';
  import type { AppError } from '@/lib/shared/errors';
  import { UI_CONFIG } from '@/lib/shared/constants';
  import { toastManager } from '@/lib/shared/toastManager';

  let magnetLink = $state('');
  let availableHosts = $state<string[]>([]);
  let selectedHost = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error = $state('');
  let showModal = $state(false);

  const { apiKey, onMagnetAdded } = $props<{
    apiKey: string;
    onMagnetAdded?: () => void;
  }>();

  function toggleModal() {
    showModal = !showModal;
  }

  async function fetchAvailableHosts() {
    if (!apiKey) {return;}

    try {
      const api = new RealDebridAPI(apiKey);
      const hosts = await api.getAvailableHosts();
      availableHosts = hosts.map((h: AvailableHost) => h.host);
      selectedHost = availableHosts[0];
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      console.error('Error fetching available hosts:', err);
    }
  }

  async function addMagnet() {
    if (!magnetLink || !selectedHost) {return;}

    loading = true;
    error = '';
    success = false;

    try {
      const api = new RealDebridAPI(apiKey);
      await api.addMagnet(magnetLink, selectedHost);

      success = true;
      magnetLink = '';
      toastManager.success('Magnet link added successfully!');
      
      // Notify parent component to refresh torrents
      if (onMagnetAdded) {
        onMagnetAdded();
      }
      
      setTimeout(() => {
        success = false;
        showModal = false;
      }, UI_CONFIG.NOTIFICATION_DURATION);
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to add magnet link');
      console.error('Error adding magnet:', err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (showModal) {
      fetchAvailableHosts();
    }
  });

  export function openModal() {
    console.log('openModal called');
    showModal = true;
  }
</script>

<div class="magnet-section">

  <!-- Modal for Magnet form -->
  <div class="modal" class:is-active={showModal}>
    <div class="modal-background" onclick={toggleModal}></div>
    <div class="modal-content">
      <div class="magnet-card" class:is-loading={loading}>
        <header class="magnet-card__header">
          <div class="magnet-card__title">
            <i class="fas fa-magnet"></i>
            <span>Send a Magnet Link</span>
          </div>
          <p class="magnet-card__subtitle">Paste your magnet, choose a host, and we'll drop it into Real-Debrid.</p>
        </header>

        <section class="magnet-card__body">
          <label class="field-label" for="magnet-input">Magnet Link</label>
          <div class="field">
            <div class="control">
              <textarea
                id="magnet-input"
                class="textarea"
                bind:value={magnetLink}
                placeholder="magnet:?xt=urn:btih:..."
                rows="3"
              ></textarea>
            </div>
          </div>

          <label class="field-label" for="host-select">Use Host</label>
          <div class="field">
            <div class="control">
              <div class="select is-small is-fullwidth">
                <select id="host-select" bind:value={selectedHost}>
                  {#each availableHosts as host}
                    <option value={host}>{host}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>

          {#if error}
            <div class="notification is-danger is-light">
              {error}
            </div>
          {/if}
        </section>

        <footer class="magnet-card__footer">
          <button class="button is-light" onclick={toggleModal} disabled={loading}>Cancel</button>
          <button
            class="button is-success"
            onclick={addMagnet}
            disabled={!magnetLink || !selectedHost || loading}
          >
            <span class="icon">
              <i class="fas fa-upload"></i>
            </span>
            <span>{loading ? 'Submitting...' : 'Add Torrent'}</span>
          </button>
        </footer>
      </div>
    </div>
    <button onclick={toggleModal} class="modal-close is-large" aria-label="close"></button>
  </div>
</div>

<style>
  .modal-content {
    max-width: 460px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .magnet-card {
    position: relative;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.96), rgba(34, 34, 34, 0.96));
    border-radius: 12px;
    border: 1px solid rgba(120, 75, 160, 0.35);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.65rem 1.35rem;
  }

  .magnet-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .magnet-card__title {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .magnet-card__title i {
    color: #ff3cac;
    text-shadow: 0 0 10px rgba(255, 60, 172, 0.6);
  }

  .magnet-card__subtitle {
    margin: 0;
    color: #9db3d4;
    font-size: 0.85rem;
  }

  .magnet-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .field-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #90caf9;
  }

  .magnet-card__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  :global(.textarea) {
    background-color: #1e1e1e;
    border-color: #333;
    color: #fff;
    resize: none;
  }

  :global(.textarea:focus) {
    border-color: #2196f3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.25);
  }

  :global(.select select) {
    background-color: #1e1e1e;
    border-color: #333;
    color: #fff;
  }

  :global(.notification.is-success.is-light) {
    background-color: rgba(72, 199, 142, 0.1);
    color: #48c78e;
    border: 1px solid rgba(72, 199, 142, 0.2);
  }
</style>

<script lang="ts">
  import { RealDebridAPI } from '@/lib/shared/RealDebridAPI';
  import type { AvailableHost } from '@/lib/shared/types';
  import type { AppError } from '@/lib/shared/errors';
  import { UI_CONFIG } from '@/lib/shared/constants';

  let magnetLink = $state('');
  let availableHosts = $state<string[]>([]);
  let selectedHost = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error = $state('');
  let showModal = $state(false);

  const { apiKey } = $props<{
    apiKey: string;
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
      setTimeout(() => {
        success = false;
        showModal = false;
      }, UI_CONFIG.NOTIFICATION_DURATION);
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
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
</script>

<div class="magnet-section">
  <button class="button is-info is-small" onclick={() => (showModal = !showModal)}>
    <span class="icon">
      <i class="fas fa-magnet"></i>
    </span>
    <span>Send Magnet</span>
  </button>

  <!-- Modal for Magnet form -->
  <div class="modal" class:is-active={showModal}>
    <div class="modal-background"></div>
    <div class="modal-content">
      <div class="magnet-form mt-3" class:is-loading={loading}>
        <div class="field">
          <div class="control">
            <textarea
              class="textarea"
              bind:value={magnetLink}
              placeholder="Paste magnet link here..."
              rows="2"
            ></textarea>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <div class="select is-small is-fullwidth">
              <select bind:value={selectedHost}>
                {#each availableHosts as host}
                  <option value={host}>{host}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <button
              class="button is-success is-small is-fullwidth"
              onclick={addMagnet}
              disabled={!magnetLink || !selectedHost || loading}
            >
              <span class="icon">
                <i class="fas fa-upload"></i>
              </span>
              <span>Add Torrent</span>
            </button>
          </div>
        </div>

        {#if error}
          <div class="notification is-danger is-light">
            {error}
          </div>
        {/if}

        {#if success}
          <div class="notification is-success is-light">Magnet link successfully added!</div>
        {/if}
      </div>
    </div>
    <button onclick={toggleModal} class="modal-close is-large" aria-label="close"></button>
  </div>
</div>

<style>
  .magnet-form {
    background: #2a2a2a;
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid #333;
    margin-top: 1rem;
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

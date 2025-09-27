<script lang="ts">
  import ApiKeyInput from '@/lib/components/ApiKeyInput.svelte';
  import type { User } from '../../lib/shared/types';
  import { onMount } from 'svelte';
  import { StorageManager } from '@/lib/shared/StorageManager';
  import { RealDebridAPI } from '@/lib/shared/RealDebridAPI';
  import TorrentManager from '@/lib/components/TorrentManager.svelte';
  import AddMagnet from '@/lib/components/AddMagnet.svelte';
  import ToastContainer from '@/lib/components/ToastContainer.svelte';
  import { CACHE_KEYS, CACHE_TTL } from '@/lib/shared/constants';
  import type { AppError } from '@/lib/shared/errors';
  import { toastManager } from '@/lib/shared/toastManager';

  const storage = StorageManager.getInstance();

  let currentApiKey = $state('');
  let userInfo = $state<User | null>(null);
  let error = $state('');
  let showSettings = $state(false);
  let appVersion = $state('');
  let torrentManagerRef: { refresh: () => Promise<void> } | null = null;
  let addMagnetRef: { openModal: () => void } | null = null;

  function toggleSettings() {
    showSettings = !showSettings;
  }

  async function getUserInfo() {
    if (!currentApiKey) {return;}

    try {
      // Check cache first
      const cachedUser = await storage.get<User>(CACHE_KEYS.USER_INFO);
      if (cachedUser) {
        console.log('Using cached user info');
        userInfo = cachedUser;
        error = '';
        return;
      }

      const api = new RealDebridAPI(currentApiKey);
      const userData = await api.getUserInfo();
      userInfo = userData;
      // Cache the response
      await storage.set(CACHE_KEYS.USER_INFO, userData, CACHE_TTL.USER_INFO);
      error = '';
    } catch (err) {
      userInfo = null;
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to fetch user info');
      console.error('Error fetching user info:', err);
    }
  }

  onMount(async () => {
    currentApiKey = await storage.getApiKey();
    // .catch((err) => console.error("Error getting API from storage.", err));

    // Read extension version from manifest (single source of truth)
    try {
      appVersion = chrome?.runtime?.getManifest?.().version ?? '';
    } catch (_) {
      appVersion = '';
    }
  });

  $effect(() => {
    if (currentApiKey) {
      getUserInfo();
    }
  });

  async function handleApiKeyChange(apiKey: string) {
    try {
      await storage.setApiKey(apiKey);
      // Clear cache when API key changes
      await storage.clear(CACHE_KEYS.USER_INFO);
      currentApiKey = apiKey;
    } catch (e) {
      console.error('Error saving API key:', e);
      toastManager.error('Failed to save API key');
    }
  }
</script>

<div class="container">
  <div class="app-card">
    <div class="header">
      <div class="title-block">
        <div class="title-main">
          <i class="fas fa-cloud-download-alt"></i>
          <h1>Real Debrid Manager</h1>
        </div>
        <div class="header-actions">
          {#if appVersion}
            <span class="version-chip">v{appVersion}</span>
          {/if}
          <button class="settings-btn" onclick={toggleSettings}>
            <i class="fas fa-cog"></i>
            Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div class="modal" class:is-active={showSettings}>
      <div class="modal-background" onclick={toggleSettings}></div>
      <div class="modal-content">
        <div class="settings-card">
          <header class="settings-card__header">
            <div class="settings-card__title">
              <i class="fas fa-cog"></i>
              <span>Settings</span>
            </div>
            <p class="settings-card__subtitle">Configure your Real-Debrid API key and preferences.</p>
          </header>

          <section class="settings-card__body">
            <label class="field-label" for="api-key-input">API Key</label>
            <ApiKeyInput {handleApiKeyChange} initialValue={currentApiKey} />
            <small class="help-text">
              Get your API key from <a href="https://real-debrid.com/apitoken" target="_blank"
                >real-debrid.com/apitoken</a
              >
            </small>
          </section>

          <footer class="settings-card__footer">
            <button class="button is-light" onclick={toggleSettings}>Close</button>
          </footer>
        </div>
      </div>
      <button onclick={toggleSettings} class="modal-close is-large" aria-label="close"></button>
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if userInfo}
      <div class="profile-card">
        <div class="profile-info">
          <div class="info-row">
            <span class="profile-icon">👤</span>
            <span class="username">{userInfo.username}</span>
            <span class="badge">{userInfo.type}</span>

            <div class="points">
              <span class="points-label"><i class="fas fa-star"></i> POINTS</span>
              <span class="points-value">{userInfo.points}</span>
            </div>

            {#if userInfo.type === 'premium'}
              <div class="premium-days">
                <span class="days-label"><i class="fas fa-calendar-alt"></i> PREMIUM DAYS</span>
                <span class="days-value">{Math.floor(userInfo.premium / 86400)}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Add Magnet Component at App level for proper modal rendering -->
      <AddMagnet
        bind:this={addMagnetRef}
        apiKey={currentApiKey}
        onMagnetAdded={async () => {
          if (torrentManagerRef?.refresh) {
            await torrentManagerRef.refresh();
          }
        }}
      />

      <!-- Render list of all torrents -->
      <TorrentManager
        bind:this={torrentManagerRef}
        apiKey={currentApiKey}
        openAddMagnet={() => addMagnetRef?.openModal()}
      />
    {/if}
    
    <!-- Footer with version and credits -->
    <div class="footer">
      <div class="version-info">
        <a href="https://github.com/staticallydynamic/real-debrid-manager/issues" target="_blank" title="Report issues or suggestions">
          <i class="fas fa-bug"></i> Found an Issue? Let us know! 🤗
        </a> • 
        <span>by <strong>supamerz</strong></span>
      </div>
    </div>
  </div>
</div>

<!-- Toast notifications -->
<ToastContainer />

<style>
  .container {
    width: 100%;
    padding: 1rem;
  }
  .app-card {
    background-color: #1a1a1a;
    border-radius: 8px;
    padding: 1.5rem;
    width: 100%;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #333;
  }

  .title-block {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title-main {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .title-main i {
    font-size: 1.6rem;
    color: #ff3cac;
    text-shadow: 0 0 10px rgba(255, 60, 172, 0.5);
  }

  h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ff3cac 0%, #784ba0 45%, #2b86c5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 10px rgba(120, 75, 160, 0.45);
    line-height: 1.1;
  }

  .version-chip {
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0ff;
    background: linear-gradient(135deg, rgba(0, 255, 255, 0.25), rgba(120, 75, 160, 0.25));
    border: 1px solid rgba(0, 255, 255, 0.35);
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
    margin-left: auto;
    white-space: nowrap;
  }

  /* Base Modal Styles */
  :global(.modal) {
    display: none;
    position: fixed;
    z-index: 9999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.4);
  }

  :global(.modal.is-active) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.modal-background) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.86);
  }

  :global(.modal-close) {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 50%;
  }

  :global(.modal-close.is-large) {
    width: 40px;
    height: 40px;
  }

  :global(.modal-close:before),
  :global(.modal-close:after) {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 2px;
    background-color: #fff;
    transform-origin: center;
  }

  :global(.modal-close:before) {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  :global(.modal-close:after) {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  :global(.modal-close:hover) {
    background-color: rgba(255, 255, 255, 0.1);
  }

  /* Button Styles */
  :global(.button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: #363636;
    color: #fff;
  }

  :global(.button:hover:not(:disabled)) {
    background-color: #4a4a4a;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  :global(.button:active:not(:disabled)) {
    transform: translateY(0);
  }

  :global(.button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.button.is-light) {
    background-color: #f5f5f5;
    color: rgba(0, 0, 0, 0.7);
  }

  :global(.button.is-light:hover:not(:disabled)) {
    background-color: #eeeeee;
  }

  :global(.button.is-success) {
    background-color: #48c78e;
    color: #fff;
  }

  :global(.button.is-success:hover:not(:disabled)) {
    background-color: #3dbb81;
  }

  /* Settings Modal Styles */
  .modal-content {
    max-width: 460px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .settings-card {
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

  .settings-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .settings-card__title {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .settings-card__title i {
    color: #ff3cac;
    text-shadow: 0 0 10px rgba(255, 60, 172, 0.6);
  }

  .settings-card__subtitle {
    margin: 0;
    color: #9db3d4;
    font-size: 0.85rem;
  }

  .settings-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .field-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #90caf9;
    margin-bottom: 0.5rem;
    display: block;
  }

  .help-text {
    display: block;
    margin-top: 0.5rem;
    color: #888;
    font-size: 0.8rem;
  }

  .help-text a {
    color: #2196f3;
    text-decoration: none;
  }

  .help-text a:hover {
    text-decoration: underline;
  }

  .settings-card__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }


  .settings-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: #2196f3;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.8rem;
    transition: all 0.2s ease;
    cursor: pointer;
    white-space: nowrap;
  }

  .settings-btn:hover {
    background: #1976d2;
  }

  .settings-btn i {
    font-size: 0.75rem;
  }

  .profile-card {
    position: relative;
    border-radius: 12px;
    padding: 1.35rem;
    margin-top: 1.2rem;
    background: linear-gradient(135deg, rgba(34, 34, 34, 0.92), rgba(20, 20, 20, 0.92));
    overflow: hidden;
  }

  .profile-card::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: linear-gradient(135deg, #ff3cac, #784ba0, #2b86c5, #ff3cac);
    background-size: 300% 300%;
    animation: border-flow 18s linear infinite;
    z-index: 0;
  }

  .profile-card::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.92), rgba(34, 34, 34, 0.92));
    z-index: 0;
  }

  .profile-info {
    position: relative;
    z-index: 1;
  }

  @keyframes border-flow {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .profile-icon {
    font-size: 1.2rem;
  }

  .username {
    font-weight: 600;
    color: white;
    flex: 1;
  }

  .profile-info .badge {
    background-color: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.875rem;
    color: white;
  }

  .premium-days {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    color: white;
  }

  .days-label {
    font-size: 0.75rem;
    opacity: 0.9;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .days-value {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .points {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    color: white;
  }

  .points-label {
    font-size: 0.75rem;
    opacity: 0.9;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .points-label i {
    font-size: 0.8rem;
    color: #ffd166;
  }

  .days-label i {
    font-size: 0.8rem;
    color: #64ffda;
  }

  .points-value {
    font-size: 1.25rem;
    font-weight: 600;
  }

  small {
    display: block;
    margin-top: 0.5rem;
    color: #888;
  }

  small a {
    color: #2196f3;
    text-decoration: none;
  }

  small a:hover {
    text-decoration: underline;
  }

  .error-message {
    background-color: #ff5252;
    color: white;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .footer {
    background-color: #1a1a1a;
    padding: 1rem;
    border-top: 1px solid #333;
    text-align: center;
  }

  .version-info {
    font-size: 0.8rem;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .version-info a {
    color: #2196f3;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .version-info a:hover {
    text-decoration: underline;
  }

  .version-info strong {
    color: #fff;
  }
</style>

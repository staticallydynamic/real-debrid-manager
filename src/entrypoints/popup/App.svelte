<script lang="ts">
  import ApiKeyInput from "@/lib/components/ApiKeyInput.svelte";
  import type { User } from "../../lib/shared/types";

  import { onMount } from "svelte";
  let currentApiKey = $state("");
  let userInfo = $state<User | null>(null);
  let error = $state("");

  let showApiKey = $state(false);
  function toggleApiKey() {
    showApiKey = !showApiKey;
  }

  async function getUserInfo() {
    try {
      const response = await fetch(
        "https://api.real-debrid.com/rest/1.0/user",
        {
          headers: { Authorization: `Bearer ${currentApiKey}` },
        },
      );
      if (response.ok) {
        userInfo = await response.json();
        error = "";
      } else {
        userInfo = null;
        error = `Error: ${response.status} - Bad Token`;
        console.error("Failed to fetch user info: ", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  }

  onMount(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local
        .get(["rdApiKey"])
        .then((result) => {
          currentApiKey = result.rdApiKey || "";
        })
        .catch((err) => console.error("Storage error:", err));
    }
  });

  $effect(() => {
    if (currentApiKey) {
      getUserInfo();
    }
  });

  async function handleApiKeyChange(apiKey: string) {
    try {
      await chrome.storage.local.set({ rdApiKey: apiKey });

      currentApiKey = apiKey;
    } catch (e) {
      console.error("Error saving API key", e);
    }
  }
</script>

<div class="container">
  <div class="app-card">
    <div class="header">
      <i class="fas fa-cloud-download-alt"></i>
      <h1>Real Debrid Manager</h1>
    </div>

    <div class="api-section" class:connected={userInfo}>
      <div class="settings-container">
        <button class="settings-btn" on:click={toggleApiKey}>
          <i class="fas fa-cog"></i>
          Settings
        </button>
        {#if showApiKey}
          <div class="settings-panel">
            <h3>API Key Settings</h3>
            <ApiKeyInput {handleApiKeyChange} initialValue={currentApiKey} />
            <small>
              Get your API key from <a
                href="https://real-debrid.com/apitoken"
                target="_blank">real-debrid.com/apitoken</a
              >
            </small>
          </div>
        {/if}
      </div>
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
              <span class="points-label">POINTS</span>
              <span class="points-value">{userInfo.points}</span>
            </div>
            
            {#if userInfo.type === "premium"}
              <div class="premium-days">
                <span class="days-label">PREMIUM DAYS</span>
                <span class="days-value"
                  >{Math.floor(userInfo.premium / 86400)}</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

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
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .header i,
  h1 {
    color: #2196f3;
  }

  .header i {
    font-size: 1.8rem;
  }

  h1 {
    font-size: 1.8rem;
    font-weight: 600;
    margin: 0;
  }

  .api-section {
    margin-bottom: 1.5rem;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #2196f3;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .settings-btn:hover {
    background: #1976d2;
  }

  .settings-btn i {
    margin-right: 0.25rem;
  }

  .profile-card {
    background-color: #2196f3;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
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
</style>

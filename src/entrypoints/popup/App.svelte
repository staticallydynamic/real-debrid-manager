<script lang="ts">
  import ApiKeyInput from "@/lib/components/ApiKeyInput.svelte";

  import { onMount } from "svelte";
    let currentApiKey = $state("");
    let userInfo = $state(null);

    async function getUserInfo() {
        console.log("Fetching user info with API key:", currentApiKey);
        try {
            const response = await fetch("https://api.real-debrid.com/rest/1.0/user", {
                headers: { Authorization: `Bearer ${currentApiKey}` },
            });
            if (response.ok) {
                userInfo = await response.json();
                console.log("User info fetched:", userInfo);
            } else {
                console.error("Failed to fetch user info: ", response.statusText);
            }
        } catch (error) {
            console.error("Error fetching user info:", error);
        }
    }

    onMount(() => {
        console.log("App mounted with current API key:", currentApiKey);

        if (typeof chrome !== "undefined" && chrome.storage) {
            chrome.storage.local
                .get(["rdApiKey"])
                .then((result) => {
                    console.log("API key retrieved from local storage:", result);
                    currentApiKey = result.rdApiKey || "";
                })
                .catch((err) => console.error("Storage error:", err));
        }
    });

    $effect(() => {
        if (currentApiKey) {
            console.log("API key updated, triggering getUserInfo...");
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

<main>
  <h1>Real Debridder Manager</h1>

  <div class="api-key">
    {#if !currentApiKey}
      <ApiKeyInput {handleApiKeyChange} />
    {/if}

    {#if userInfo}
      <p>Welcome, {userInfo.username}</p>
    {/if}
  </div>
</main>

<style>
  .app {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: auto;
    padding: 20px;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .api-key {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  main {
    margin-top: 20px;
  }

  input {
    padding: 8px;
    font-size: 16px;
  }

  button {
    padding: 8px 12px;
    font-size: 16px;
    cursor: pointer;
  }

  @media (max-width: 600px) {
    header {
      flex-direction: column;
    }
  }
</style>

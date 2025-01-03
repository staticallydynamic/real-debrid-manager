<script lang="ts">
  import AddMagnet from "./AddMagnet.svelte";

  let torrents = $state([]);
  let loading = $state(false);
  let error = $state("");
  let showFileModal = $state(false);
  let selectedFiles = $state<number[]>([]);
  let currentTorrentFiles = $state<any[]>([]);
  let currentTorrentId = $state("");

  // Link states
  let loadingLinks = $state<{ [key: string]: boolean }>({});
  let showCopyNotification = $state(false);

  const { apiKey } = $props<{
    apiKey: string;
  }>();

  async function getUnrestrictedLink(link: string, torrentId: string) {
    if (loadingLinks[torrentId]) return; //prevent double click]

    try {
      loadingLinks[torrentId] = true;

      const formData = new URLSearchParams();
      formData.append("link", link);

      const response = await fetch(
        "https://api.real-debrid.com/rest/1.0/unrestrict/link",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Copy to clipboard
      await navigator.clipboard.writeText(data.download);
      showCopyNotification = true;
      setTimeout(() => {
        showCopyNotification = false;
      }, 3000);
    } catch (e) {
      error = e.message;
      console.error("Error getting unrestricted link:", e);
    } finally {
      loadingLinks[torrentId] = false;
    }
  }

  async function getTorrentInfo(torrentId: string) {
    try {
      const response = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      currentTorrentFiles = data.files;
      currentTorrentId = torrentId;
      selectedFiles = [];
      showFileModal = true;
    } catch (e) {
      error = e.message;
      console.error("Error fetching torrent info:", e);
    }
  }

  async function fetchTorrents() {
    if (!apiKey) return;

    loading = true;
    error = "";

    try {
      const response = await fetch(
        "https://api.real-debrid.com/rest/1.0/torrents",
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      torrents = data.filter(
        (t) =>
          t.status === "downloaded" ||
          t.status === "waiting_files_selection" ||
          t.status === "magnet_conversion",
      );
    } catch (e) {
      error = e.message;
      console.error("Error fetching torrents:", e);
    } finally {
      loading = false;
    }
  }

  async function selectFiles() {
    try {
      const fileIds =
        selectedFiles.length === currentTorrentFiles.length
          ? "all"
          : selectedFiles.join(",");

      const response = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${currentTorrentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `files=${fileIds}`,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showFileModal = false;
      await fetchTorrents();
    } catch (e) {
      error = e.message;
      console.error("Error selecting files:", e);
    }
  }

  async function deleteTorrent(torrentId: string) {
    try {
      const response = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchTorrents();
    } catch (e) {
      error = e.message;
      console.error("Error deleting torrent:", e);
    }
  }

  function toggleFile(fileId: number) {
    const index = selectedFiles.indexOf(fileId);
    if (index === -1) {
      selectedFiles = [...selectedFiles, fileId];
    } else {
      selectedFiles = selectedFiles.filter((id) => id !== fileId);
    }
  }

  function toggleAllFiles() {
    if (selectedFiles.length === currentTorrentFiles.length) {
      selectedFiles = [];
    } else {
      selectedFiles = currentTorrentFiles.map((f) => f.id);
    }
  }

  $effect(() => {
    if (apiKey) {
      fetchTorrents();
    }
  });
</script>

<div class="torrent-manager">
  <div class="columns is-mobile is-vcentered mb-3">
    <div class="column">
      <h2 class="title is-5 mb-0">Active Torrents</h2>
    </div>
    <div class="column is-narrow">
      <div class="buttons are-small">
        <AddMagnet {apiKey} />
        <button
          class="button is-info"
          onclick={fetchTorrents}
          disabled={loading}
        >
          <span class="icon">
            <i class="fas fa-sync-alt" class:fa-spin={loading}></i>
          </span>
          <span>Refresh</span>
        </button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="notification is-danger is-light">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="has-text-centered py-4">
      <span class="icon">
        <i class="fas fa-circle-notch fa-spin"></i>
      </span>
      Loading...
    </div>
  {:else if torrents.length === 0}
    <div class="notification is-info is-light">No active torrents found.</div>
  {:else}
    <div class="torrents-list">
      {#each torrents as torrent}
        <div class="box torrent-item">
          <div class="level is-mobile">
            <div class="level-left">
              <div class="level-item">
                <div>
                  <p class="title is-6">{torrent.filename}</p>
                  <div class="torrent-meta">
                    <span
                      class="tag status-tag"
                      class:is-waiting={torrent.status ===
                        "waiting_files_selection" ||
                        torrent.status === "magnet_conversion"}
                      class:is-downloaded={torrent.status === "downloaded"}
                    >
                      {torrent.status === "waiting_files_selection" ||
                      torrent.status === "magnet_conversion"
                        ? "Waiting"
                        : "Downloaded"}
                    </span>
                    <span class="size-tag">
                      {(torrent.bytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="level-right">
              {#if torrent.status === "waiting_files_selection" || torrent.status === "magnet_conversion"}
                <button
                  class="button is-success is-small mr-2"
                  onclick={() => getTorrentInfo(torrent.id)}
                >
                  <span class="icon">
                    <i class="fas fa-file-import"></i>
                  </span>
                  <span>Select Files</span>
                </button>
              {:else if torrent.status === "downloaded" && torrent.links?.length > 0}
                <button
                  class="button is-info is-small mr-2"
                  onclick={() =>
                    getUnrestrictedLink(torrent.links[0], torrent.id)}
                  disabled={loadingLinks[torrent.id]}
                >
                  <span class="icon">
                    <i
                      class="fas"
                      class:fa-link={!loadingLinks[torrent.id]}
                      class:fa-spinner={loadingLinks[torrent.id]}
                      class:fa-spin={loadingLinks[torrent.id]}
                    ></i>
                  </span>
                  <span
                    >{loadingLinks[torrent.id]
                      ? "Copying..."
                      : "Get Link"}</span
                  >
                </button>
              {/if}
              <button
                class="button is-danger is-small"
                onclick={() => deleteTorrent(torrent.id)}
              >
                <span class="icon">
                  <i class="fas fa-trash"></i>
                </span>
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- File Selection Modal -->
<div class="modal" class:is-active={showFileModal}>
  <div class="modal-background"></div>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Select Files</p>
      <button
        class="delete"
        aria-label="close"
        onclick={() => (showFileModal = false)}
      ></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <div class="control">
          <label class="checkbox">
            <input
              type="checkbox"
              checked={selectedFiles.length === currentTorrentFiles.length}
              onclick={toggleAllFiles}
            />
            Select All Files
          </label>
        </div>
      </div>
      <div class="file-list">
        {#each currentTorrentFiles as file}
          <div class="file-item">
            <label class="checkbox">
              <input
                type="checkbox"
                checked={selectedFiles.includes(file.id)}
                onclick={() => toggleFile(file.id)}
              />
              <span class="file-name">{file.path.split("/").pop()}</span>
              <span class="file-size"
                >({(file.bytes / (1024 * 1024)).toFixed(1)} MB)</span
              >
            </label>
          </div>
        {/each}
      </div>
    </section>
    <footer class="modal-card-foot">
      <button
        class="button is-success"
        onclick={selectFiles}
        disabled={selectedFiles.length === 0}
      >
        Download Selected
      </button>
      <button class="button" onclick={() => (showFileModal = false)}
        >Cancel</button
      >
    </footer>
  </div>
</div>

{#if showCopyNotification}
  <div class="notification-wrapper">
    <div class="notification is-success is-light">
      <button class="delete" onclick={() => (showCopyNotification = false)}
      ></button>
      Link copied to clipboard!
    </div>
  </div>
{/if}

<style>
  .torrent-manager {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background-color: #1e1e1e;
    border-radius: 8px;
    border: 1px solid #333;
  }

  :global(.title.is-5) {
    color: #2196f3;
    font-size: 1.1rem;
    margin-bottom: 0;
  }

  :global(.button.is-info) {
    background-color: #2196f3;
  }

  :global(.button.is-info:hover) {
    background-color: #1976d2;
  }

  .torrent-item {
    background-color: #2a2a2a;
    margin-bottom: 0.75rem;
    border: 1px solid #333;
    transition: all 0.2s ease;
  }

  .torrent-item:hover {
    border-color: #2196f3;
  }

  :global(.torrent-item .title.is-6) {
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .torrent-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .status-tag.is-waiting {
    background-color: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .status-tag.is-downloaded {
    background-color: rgba(76, 175, 80, 0.2);
    color: #4caf50;
  }

  .size-tag {
    color: #90caf9;
    font-size: 0.8rem;
    font-weight: 500;
  }

  :global(.notification.is-info.is-light) {
    background-color: rgba(33, 150, 243, 0.1);
    color: #90caf9;
    border: 1px solid rgba(33, 150, 243, 0.2);
  }

  .torrent-item:last-child {
    margin-bottom: 0;
  }

  :global(.fa-spin) {
    animation: fa-spin 2s infinite linear;
  }

  @keyframes fa-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Modal Styles */
  :global(.modal-card-head) {
    background-color: #2a2a2a;
    border-bottom: 1px solid #333;
  }

  :global(.modal-card-title) {
    color: #fff;
  }

  :global(.modal-card-body) {
    background-color: #1e1e1e;
  }

  :global(.modal-card-foot) {
    background-color: #2a2a2a;
    border-top: 1px solid #333;
  }

  .file-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .file-item {
    padding: 0.5rem;
    border-bottom: 1px solid #333;
  }

  .file-item:last-child {
    border-bottom: none;
  }

  .file-item label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #fff;
    cursor: pointer;
  }

  .file-name {
    flex: 1;
    font-size: 0.9rem;
  }

  .file-size {
    color: #90caf9;
    font-size: 0.8rem;
  }

  .notification-wrapper {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 1000;
  }

  :global(.notification.is-success.is-light) {
    background-color: rgba(72, 199, 142, 0.1);
    color: #48c78e;
    border: 1px solid rgba(72, 199, 142, 0.2);
    margin: 0;
    padding-right: 2rem;
  }

  :global(.fa-spin) {
    animation: fa-spin 2s infinite linear;
  }

  @keyframes fa-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>

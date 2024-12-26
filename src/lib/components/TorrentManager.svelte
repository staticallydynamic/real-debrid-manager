<script lang="ts">
    import AddMagnet from './AddMagnet.svelte';
    
    let torrents = $state([]);
    let loading = $state(false);
    let error = $state('');
    
    const { apiKey } = $props<{
      apiKey: string;
    }>();
  
    async function fetchTorrents() {
      if (!apiKey) return;
      
      loading = true;
      error = '';
      
      try {
        const response = await fetch(
          'https://api.real-debrid.com/rest/1.0/torrents',
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        torrents = data.filter(t => 
          t.status === 'downloaded' || t.status === 'waiting_files_selection'
        );
      } catch (e) {
        error = e.message;
        console.error('Error fetching torrents:', e);
      } finally {
        loading = false;
      }
    }
  
    async function selectFiles(torrentId: string) {
      try {
        const response = await fetch(
          `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
          {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'files=all'
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await fetchTorrents();
      } catch (e) {
        error = e.message;
        console.error('Error selecting files:', e);
      }
    }
  
    async function deleteTorrent(torrentId: string) {
      try {
        const response = await fetch(
          `https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await fetchTorrents();
      } catch (e) {
        error = e.message;
        console.error('Error deleting torrent:', e);
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
    <div class="notification is-info is-light">
      No active torrents found.
    </div>
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
                      class:is-waiting={torrent.status === 'waiting_files_selection'} 
                      class:is-downloaded={torrent.status === 'downloaded'}
                    >
                      {torrent.status === 'waiting_files_selection' ? 'Waiting' : 'Downloaded'}
                    </span>
                    <span class="size-tag">
                      {(torrent.bytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="level-right">
              {#if torrent.status === 'waiting_files_selection'}
                <button 
                  class="button is-success is-small mr-2"
                  onclick={() => selectFiles(torrent.id)}
                >
                  <span class="icon">
                    <i class="fas fa-check"></i>
                  </span>
                  <span>Select All</span>
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
</style>
<script lang="ts">
  import type { Torrent, TorrentFile } from '@/lib/shared/types';
  import type { AppError } from '@/lib/shared/errors';
  import { RealDebridAPI } from '@/lib/shared/RealDebridAPI';
  import { toastManager } from '@/lib/shared/toastManager';

  let torrents = $state<Torrent[]>([]);
  let loading = $state(false);
  let error = $state('');
  let showFileModal = $state(false);
  let showDeleteModal = $state(false);
  let showLinksModal = $state(false);
  let selectedFiles = $state<number[]>([]);
  let currentTorrentFiles = $state<TorrentFile[]>([]);
  let currentTorrentId = $state('');
  let torrentsToDelete = $state<string[]>([]);
  let torrentsToDeleteNames = $state<string[]>([]);
  let currentLinks = $state<string[]>([]);
  let currentLinkNames = $state<string[]>([]);
  let perCopyLoading = $state<{ [key: number]: boolean }>({});
  let perDownloadLoading = $state<{ [key: number]: boolean }>({});
  let bulkCopyLoading = $state(false);
  let bulkDownloadLoading = $state(false);
  let showViewFilesModal = $state(false);
  let viewFiles = $state<TorrentFile[]>([]);
  let viewFilesTitle = $state('');
  let viewFilesNotice = $state('');

  // Link states
  const loadingLinks = $state<{ [key: string]: boolean }>({});
  const viewFilesLoading = $state<{ [key: string]: boolean }>({});
  let deletingTorrent = $state(false);
  let selectedTorrentIds = $state<string[]>([]);
  let torrentStats = $state<Record<string, { selected: number; total: number | null }>>({});

  const selectableTorrentIds = $derived(() => Array.from(new Set(torrents.map((t) => t.id))));
  const totalSelectable = $derived(() => selectableTorrentIds.length);
  const selectedIdSet = $derived(() => new Set(selectedTorrentIds));
  const allTorrentsSelected = $derived(
    () => totalSelectable > 0 && torrents.every((t) => selectedIdSet.has(t.id))
  );
  const hasSelection = $derived(() => torrents.some((t) => selectedIdSet.has(t.id)));
  const partiallySelected = $derived(() => hasSelection && !allTorrentsSelected);

  const { apiKey } = $props<{
    apiKey: string;
  }>();

  const VISIBLE_STATUSES = new Set<Torrent['status']>([
    'downloaded',
    'waiting_files_selection',
    'magnet_conversion',
    'magnet_error',
    'downloading',
    'compressing',
    'uploading',
    'queued',
  ]);
  const WAITING_STATUSES = new Set<Torrent['status']>(['waiting_files_selection', 'magnet_conversion', 'queued']);
  const ACTIVE_STATUSES = new Set<Torrent['status']>(['downloading', 'compressing', 'uploading']);
  const ERROR_STATUSES = new Set<Torrent['status']>(['magnet_error', 'error', 'dead']);

  function getStatusLabel(status: Torrent['status']): string {
    switch (status) {
      case 'downloaded':
        return 'Downloaded';
      case 'waiting_files_selection':
        return 'Waiting';
      case 'magnet_conversion':
        return 'Converting';
      case 'magnet_error':
        return 'Magnet Error';
      case 'downloading':
        return 'Downloading';
      case 'compressing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      case 'queued':
        return 'Queued';
      case 'error':
        return 'Error';
      case 'dead':
        return 'Unavailable';
      default:
        return status.replace(/_/g, ' ');
    }
  }

  function openUrlInBrowser(url: string) {
    try {
      if (chrome?.downloads?.download) {
        chrome.downloads.download({ url });
        return;
      }
    } catch (err) {
      console.error('Failed to trigger chrome.downloads:', err);
    }

    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  async function copyDirectLink(link: string) {
    try {
      const api = new RealDebridAPI(apiKey);
      const data = await api.getUnrestrictedLink(link);
      await navigator.clipboard.writeText(data.download);
      toastManager.success('Download link copied to clipboard');
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to get download link');
      console.error('Error copying unrestricted link:', err);
      throw err;
    }
  }

  async function downloadDirectLink(link: string) {
    try {
      const api = new RealDebridAPI(apiKey);
      const data = await api.getUnrestrictedLink(link);
      openUrlInBrowser(data.download);
      toastManager.success('Download started in browser');
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to start download');
      console.error('Error retrieving download link:', err);
      throw err;
    }
  }

  async function handleTorrentLinks(torrent: Torrent, mode: 'copy' | 'download') {
    const { id, links } = torrent;
    if (!links || links.length === 0) {
      toastManager.error('No links available for this torrent yet');
      return;
    }

    if (loadingLinks[id]) {return;}

    if (links.length === 1) {
      try {
        loadingLinks[id] = true;
        if (mode === 'copy') {
          await copyDirectLink(links[0]);
        } else {
          await downloadDirectLink(links[0]);
        }
      } catch {
        // handled in helper functions
      } finally {
        loadingLinks[id] = false;
      }
      return;
    }

    try {
      loadingLinks[id] = true;
      currentTorrentId = id;
      currentLinks = links;

      let names: string[] = [];
      try {
        const api = new RealDebridAPI(apiKey);
        const info = await api.getTorrentInfo(id);
        const selectedFiles = (info.files || []).filter((f) => f.selected === 1);

        if (selectedFiles.length === links.length) {
          names = selectedFiles.map((f) => f.path.split('/').pop() || 'File');
        }
      } catch {
        // Non-fatal; we'll fall back to generic names
      }

      if (names.length !== links.length) {
        names = links.map((_, i) => `File ${i + 1}`);
      }

      currentLinkNames = names;
      perCopyLoading = {};
      perDownloadLoading = {};
      showLinksModal = true;
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to prepare links');
      console.error('Error preparing links:', err);
    } finally {
      loadingLinks[id] = false;
    }
  }

  async function copySingleLink(index: number) {
    const link = currentLinks[index];
    if (!link) { return; }

    try {
      perCopyLoading[index] = true;
      await copyDirectLink(link);
    } catch {
      // handled in helper
    } finally {
      perCopyLoading[index] = false;
    }
  }

  async function downloadSingleLink(index: number) {
    const link = currentLinks[index];
    if (!link) { return; }

    try {
      perDownloadLoading[index] = true;
      await downloadDirectLink(link);
    } catch {
      // handled in helper
    } finally {
      perDownloadLoading[index] = false;
    }
  }

  async function copyAllLinks() {
    if (!currentLinks.length) { return; }

    try {
      bulkCopyLoading = true;
      const api = new RealDebridAPI(apiKey);
      const results = await Promise.all(
        currentLinks.map(async (l) => {
          try {
            const data = await api.getUnrestrictedLink(l);
            return data.download;
          } catch {
            return null;
          }
        })
      );

      const downloads = results.filter((r): r is string => !!r);
      if (downloads.length === 0) {
        toastManager.error('Failed to unrestrict links');
        return;
      }

      await navigator.clipboard.writeText(downloads.join('\n'));
      toastManager.success(`Copied ${downloads.length} download link(s)`);
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to copy links');
      console.error('Error copying all links:', err);
    } finally {
      bulkCopyLoading = false;
    }
  }

  async function downloadAllLinks() {
    if (!currentLinks.length) { return; }

    try {
      bulkDownloadLoading = true;
      const api = new RealDebridAPI(apiKey);
      const results = await Promise.all(
        currentLinks.map(async (l) => {
          try {
            const data = await api.getUnrestrictedLink(l);
            return data.download;
          } catch {
            return null;
          }
        })
      );

      const downloads = results.filter((r): r is string => !!r);
      if (downloads.length === 0) {
        toastManager.error('Failed to prepare downloads');
        return;
      }

      downloads.forEach((url) => openUrlInBrowser(url));
      toastManager.success(`Started ${downloads.length} download${downloads.length === 1 ? '' : 's'}`);
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to start downloads');
      console.error('Error starting downloads:', err);
    } finally {
      bulkDownloadLoading = false;
    }
  }

  async function viewSelectedFiles(torrent: Torrent) {
    const { id } = torrent;
    if (!apiKey) {return;}
    if (viewFilesLoading[id]) {return;}

    viewFilesLoading[id] = true;
    viewFilesNotice = '';

    try {
      const api = new RealDebridAPI(apiKey);
      const info = await api.getTorrentInfo(id);
      const files = info.files ?? [];
      const selected = files.filter((f) => f.selected === 1);

      const list = selected.length ? selected : files;
      viewFiles = list;
      viewFilesTitle = torrent.filename;

      if (selected.length === 0 && files.length > 0) {
        viewFilesNotice = 'No files are marked selected. Showing all available files.';
      } else if (files.length === 0) {
        viewFilesNotice = 'No file information available for this torrent yet.';
      }

      showViewFilesModal = true;
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to load file list');
      console.error('Error viewing selected files:', err);
    } finally {
      viewFilesLoading[id] = false;
    }
  }

  async function getTorrentInfo(torrentId: string) {
    try {
      const api = new RealDebridAPI(apiKey);
      const data = await api.getTorrentInfo(torrentId);

      currentTorrentFiles = data.files || [];
      currentTorrentId = torrentId;
      selectedFiles = [];
      showFileModal = true;
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to fetch torrent info');
      console.error('Error fetching torrent info:', err);
    }
  }

  async function fetchTorrents() {
    if (!apiKey) {return;}

    loading = true;
    error = '';

    try {
      const api = new RealDebridAPI(apiKey);
      const data = await api.getTorrents();
      
      console.log('Raw torrent data from API:', data);
      console.log('Torrent statuses:', data.map(t => ({ id: t.id, filename: t.filename, status: t.status })));

      const filteredTorrents = data.filter((t) => VISIBLE_STATUSES.has(t.status));
      
      console.log('Filtered torrents:', filteredTorrents.map(t => ({ id: t.id, filename: t.filename, status: t.status })));
      torrents = filteredTorrents;
      const validIds = new Set(filteredTorrents.map((t) => t.id));
      selectedTorrentIds = selectedTorrentIds.filter((id) => validIds.has(id));
      await hydrateTorrentStats(filteredTorrents);
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to fetch torrents');
      console.error('Error fetching torrents:', err);
    } finally {
      loading = false;
    }
  }

  export async function refresh() {
    await fetchTorrents();
  }

  async function deleteTorrents(torrentIds: string[]) {
    if (!torrentIds.length) {return;}

    deletingTorrent = true;
    try {
      const api = new RealDebridAPI(apiKey);
      const results = await Promise.allSettled(torrentIds.map((id) => api.deleteTorrent(id)));
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      const deletedCount = torrentIds.length - failed.length;

      if (deletedCount) {
        await fetchTorrents();
        selectedTorrentIds = selectedTorrentIds.filter((id) => !torrentIds.includes(id));
        toastManager.success(`Deleted ${deletedCount} torrent${deletedCount === 1 ? '' : 's'} successfully`);
        error = '';
      }

      if (failed.length) {
        const failure = failed[0].reason as AppError | Error;
        const message =
          failure && typeof failure === 'object' && 'userMessage' in failure
            ? (failure as AppError).userMessage
            : 'Failed to delete some torrents';
        error = message;
        toastManager.error(message);
        failed.forEach((f) => console.error('Failed to delete torrent:', f.reason));
      }
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to delete torrents');
      console.error('Error deleting torrents:', err);
    } finally {
      deletingTorrent = false;
    }
  }

  async function selectFiles() {
    try {
      const fileIds =
        selectedFiles.length === currentTorrentFiles.length ? ('all' as const) : selectedFiles;

      const api = new RealDebridAPI(apiKey);
      await api.selectFiles(currentTorrentId, fileIds);

      showFileModal = false;
      await fetchTorrents();
      toastManager.success('Files selected for download');
      error = '';
    } catch (err) {
      const appError = err as AppError;
      error = appError.userMessage || appError.message;
      toastManager.error(appError.userMessage || 'Failed to select files');
      console.error('Error selecting files:', err);
    }
  }

  function toggleFile(fileId: number) {
    const index = selectedFiles.indexOf(fileId);
    if (index === -1) {
      selectedFiles = [...selectedFiles, fileId];
    } else {
      selectedFiles = selectedFiles.filter((id: number) => id !== fileId);
    }
  }

  function toggleAllFiles() {
    if (selectedFiles.length === currentTorrentFiles.length) {
      selectedFiles = [];
    } else {
      selectedFiles = currentTorrentFiles.map((f: TorrentFile) => f.id);
    }
  }

  function setTorrentSelection(torrentId: string, isSelected: boolean) {
    if (isSelected) {
      if (!selectedTorrentIds.includes(torrentId)) {
        selectedTorrentIds = [...selectedTorrentIds, torrentId];
      }
    } else {
      selectedTorrentIds = selectedTorrentIds.filter((id) => id !== torrentId);
    }
  }

  function clearSelectedTorrents() {
    selectedTorrentIds = [];
  }

  function getTorrentFileStats(torrent: Torrent) {
    const stats = torrentStats[torrent.id];
    const selected = stats?.selected ?? (torrent.links?.length ?? 0);
    const total = stats?.total ?? null;
    return { selected, total };
  }

  function getTorrentFileCountLabel(torrent: Torrent) {
    const { selected, total } = getTorrentFileStats(torrent);
    const totalPart = total !== null ? `/${total}` : '/?';
    return `${selected}${totalPart}`;
  }

  $effect(() => {
    if (apiKey) {
      fetchTorrents();
    }
  });

  async function hydrateTorrentStats(list: Torrent[]) {
    if (!list.length) {
      torrentStats = {};
      return;
    }

    try {
      const api = new RealDebridAPI(apiKey);
      const results = await Promise.allSettled(
        list.map(async (torrent) => {
          const info = await api.getTorrentInfo(torrent.id);
          const files = info.files ?? [];
          const total = files.length > 0 ? files.length : null;
          const selectedFromFiles = files.filter((f) => f.selected === 1).length;
          const selected = selectedFromFiles > 0
            ? selectedFromFiles
            : (info.links?.length ?? torrent.links?.length ?? 0);

          return {
            id: torrent.id,
            total,
            selected,
          };
        })
      );

      const next: Record<string, { selected: number; total: number | null }> = {};
      list.forEach((torrent) => {
        if (torrentStats[torrent.id]) {
          next[torrent.id] = torrentStats[torrent.id];
        }
      });
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { id, total, selected } = result.value;
          next[id] = { total, selected };
        }
      });

      torrentStats = next;
    } catch (err) {
      console.error('Error fetching torrent stats:', err);
    }
  }
</script>

<div class="torrent-manager">
  <div class="manager-header">
    <div class="manager-heading">
      <h2>Active Torrents</h2>
      <p class="subtle">Downloaded items stay visible so you can grab links or clean them up.</p>
    </div>
    <div class="manager-toolbar">
      <button class="toolbar-button button is-info is-small" onclick={fetchTorrents} disabled={loading}>
        <span class="icon">
          <i class="fas fa-sync-alt" class:fa-spin={loading}></i>
        </span>
        <span>Refresh</span>
      </button>
      <button
        class="toolbar-button button is-light is-small"
        onclick={clearSelectedTorrents}
        disabled={!hasSelection}
      >
        <span class="icon">
          <i class="fas" class:fa-square={!hasSelection} class:fa-minus-square={partiallySelected} class:fa-check-square={allTorrentsSelected}></i>
        </span>
        <span>Clear Selection</span>
      </button>
      <button
        class="toolbar-button button is-danger is-small"
        disabled={!hasSelection}
        onclick={() => {
          torrentsToDelete = [...selectedTorrentIds];
          torrentsToDeleteNames = selectedTorrentIds.map((id) => {
            const match = torrents.find((t) => t.id === id);
            return match ? match.filename : id;
          });
          showDeleteModal = true;
        }}
      >
        <span class="icon">
          <i class="fas fa-trash"></i>
        </span>
        <span>Delete Selected</span>
      </button>
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
      {#each torrents as torrent (torrent.id)}
        <div
          class="torrent-row"
          class:is-selected={selectedTorrentIds.includes(torrent.id)}
        >
          <div class="torrent-checkbox">
            <input
              type="checkbox"
              checked={selectedTorrentIds.includes(torrent.id)}
              onchange={(event) =>
                setTorrentSelection(torrent.id, (event.currentTarget as HTMLInputElement).checked)
              }
              aria-label={`Select ${torrent.filename}`}
            />
          </div>
          <div class="torrent-body">
            <div class="torrent-name-row">
              <p class="torrent-name" title={torrent.filename}>
                {torrent.filename}
              </p>
            </div>
            <div class="torrent-status-row">
              <div class="status-meta">
                <span
                  class="tag status-tag"
                  class:is-waiting={WAITING_STATUSES.has(torrent.status)}
                  class:is-downloaded={torrent.status === 'downloaded'}
                  class:is-active={ACTIVE_STATUSES.has(torrent.status)}
                  class:is-error={ERROR_STATUSES.has(torrent.status)}
                >
                  {getStatusLabel(torrent.status)}
                </span>
                <span class="size-tag">
                  {(torrent.bytes / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span class="file-count" title={`Files selected for download: ${getTorrentFileCountLabel(torrent)}`}>
                  {getTorrentFileCountLabel(torrent)}
                </span>
                <button
                  class="view-files-btn"
                  onclick={() => viewSelectedFiles(torrent)}
                  disabled={!!viewFilesLoading[torrent.id]}
                  aria-label="View selected files"
                >
                  <span class="icon is-small">
                    <i
                      class="fas"
                      class:fa-list={!viewFilesLoading[torrent.id]}
                      class:fa-spinner={!!viewFilesLoading[torrent.id]}
                      class:fa-spin={!!viewFilesLoading[torrent.id]}
                    ></i>
                  </span>
                  <span>{viewFilesLoading[torrent.id] ? 'Loading...' : 'View Files'}</span>
                </button>
                {#if typeof torrent.progress === 'number' && torrent.progress > 0 && torrent.progress < 100}
                  <span class="progress-text">{Math.round(torrent.progress)}%</span>
                {/if}
              </div>
            </div>
            <div class="torrent-actions-row">
              <div class="torrent-actions">
                {#if torrent.status === 'waiting_files_selection' || torrent.status === 'magnet_conversion' || torrent.status === 'magnet_error'}
                  <button
                    class="button is-small"
                    class:is-success={torrent.status === 'waiting_files_selection' || torrent.status === 'magnet_conversion'}
                    class:is-warning={torrent.status === 'magnet_error'}
                    onclick={() => getTorrentInfo(torrent.id)}
                  >
                    <span class="icon">
                      <i class="fas fa-file-import"></i>
                    </span>
                    <span>{torrent.status === 'magnet_error' ? 'Retry Files' : 'Select Files'}</span>
                  </button>
                {:else if torrent.links?.length > 0}
                  <button
                    class="button is-primary is-small"
                    onclick={() => handleTorrentLinks(torrent, 'download')}
                    disabled={loadingLinks[torrent.id]}
                    aria-label={torrent.links.length === 1 ? 'Download file' : 'Download files'}
                  >
                    <span class="icon">
                      <i
                        class="fas"
                        class:fa-download={!loadingLinks[torrent.id]}
                        class:fa-spinner={loadingLinks[torrent.id]}
                        class:fa-spin={loadingLinks[torrent.id]}
                      ></i>
                    </span>
                    <span>
                      {loadingLinks[torrent.id]
                        ? 'Preparing...'
                        : torrent.links.length === 1
                        ? 'Download'
                        : 'Download'}
                    </span>
                  </button>
                  <button
                    class="button is-info is-small"
                    onclick={() => handleTorrentLinks(torrent, 'copy')}
                    disabled={loadingLinks[torrent.id]}
                    aria-label={torrent.links.length === 1 ? 'Copy link' : 'Copy links'}
                  >
                    <span class="icon">
                      <i
                        class="fas"
                        class:fa-link={!loadingLinks[torrent.id]}
                        class:fa-spinner={loadingLinks[torrent.id]}
                        class:fa-spin={loadingLinks[torrent.id]}
                      ></i>
                    </span>
                    <span>
                      {loadingLinks[torrent.id]
                        ? 'Preparing...'
                        : torrent.links.length === 1
                        ? 'Copy Link'
                        : 'Copy Links'}
                    </span>
                  </button>
                {/if}
                <button
                  class="button is-danger is-small"
                  onclick={() => {
                    showDeleteModal = true;
                    torrentsToDelete = [torrent.id];
                    torrentsToDeleteNames = [torrent.filename];
                  }}
                  aria-label="Delete torrent"
                >
                  <span class="icon">
                    <i class="fas fa-trash"></i>
                  </span>
                </button>
              </div>
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
  <div class="modal-card file-selection">
    <header class="modal-card-head">
      <p class="modal-card-title">Select Files</p>
      <button class="delete" aria-label="close" onclick={() => (showFileModal = false)}></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="checkbox">
          <input
            type="checkbox"
            checked={selectedFiles.length === currentTorrentFiles.length}
            onclick={toggleAllFiles}
          />
          Select All Files
        </label>
      </div>
      <div class="file-list">
        {#each currentTorrentFiles as file (file.id)}
          <div class="file-item">
            <label class="checkbox">
              <input
                type="checkbox"
                checked={selectedFiles.includes(file.id)}
                onclick={() => toggleFile(file.id)}
              />
              <span class="filename">{file.path.split('/').pop()}</span>
              <span class="filesize">{(file.bytes / (1024 * 1024)).toFixed(1)} MB</span>
            </label>
          </div>
        {/each}
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-success" onclick={selectFiles} disabled={selectedFiles.length === 0}>
        Download Selected
      </button>
      <button class="button" onclick={() => (showFileModal = false)}>Cancel</button>
    </footer>
  </div>
</div>

<!-- Links Modal -->
<div class="modal" class:is-active={showLinksModal}>
  <div class="modal-background"></div>
  <div class="modal-card links-modal">
    <header class="modal-card-head">
      <p class="modal-card-title">Download Links</p>
      <button class="delete" aria-label="close" onclick={() => (showLinksModal = false)}></button>
    </header>
    <section class="modal-card-body">
      <div class="links-actions">
        <button class="button is-primary" onclick={downloadAllLinks} disabled={bulkDownloadLoading}>
          <span class="icon">
            <i
              class="fas"
              class:fa-download={!bulkDownloadLoading}
              class:fa-spinner={bulkDownloadLoading}
              class:fa-spin={bulkDownloadLoading}
            ></i>
          </span>
          <span>{bulkDownloadLoading ? 'Starting...' : 'Download All'}</span>
        </button>
        <button class="button is-info" onclick={copyAllLinks} disabled={bulkCopyLoading}>
          <span class="icon">
            <i
              class="fas"
              class:fa-copy={!bulkCopyLoading}
              class:fa-spinner={bulkCopyLoading}
              class:fa-spin={bulkCopyLoading}
            ></i>
          </span>
          <span>{bulkCopyLoading ? 'Copying...' : 'Copy All'}</span>
        </button>
      </div>
      <div class="links-list">
        {#each currentLinks as link, i (`${link}-${i}`)}
          <div class="link-item">
            <div class="link-name" title={currentLinkNames[i] || `File ${i + 1}`}>
              {currentLinkNames[i] || `File ${i + 1}`}
            </div>
            <div class="link-actions">
              <button class="button is-small is-primary" onclick={() => downloadSingleLink(i)} disabled={!!perDownloadLoading[i]}>
                <span class="icon is-small">
                  <i
                    class="fas"
                    class:fa-download={!perDownloadLoading[i]}
                    class:fa-spinner={!!perDownloadLoading[i]}
                    class:fa-spin={!!perDownloadLoading[i]}
                  ></i>
                </span>
                <span>{perDownloadLoading[i] ? 'Starting...' : 'Download'}</span>
              </button>
              <button class="button is-small" onclick={() => copySingleLink(i)} disabled={!!perCopyLoading[i]}>
                <span class="icon is-small">
                  <i
                    class="fas"
                    class:fa-copy={!perCopyLoading[i]}
                    class:fa-spinner={!!perCopyLoading[i]}
                    class:fa-spin={!!perCopyLoading[i]}
                  ></i>
                </span>
                <span>{perCopyLoading[i] ? 'Copying...' : 'Copy'}</span>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button" onclick={() => (showLinksModal = false)}>Close</button>
    </footer>
  </div>
  
</div>

<!-- View Selected Files Modal -->
<div class="modal" class:is-active={showViewFilesModal}>
  <div class="modal-background"></div>
  <div class="modal-card view-files-modal">
    <header class="modal-card-head">
      <p class="modal-card-title">Files for {viewFilesTitle}</p>
      <button
        class="delete"
        aria-label="close"
        onclick={() => {
          showViewFilesModal = false;
          viewFiles = [];
          viewFilesTitle = '';
          viewFilesNotice = '';
        }}
      ></button>
    </header>
    <section class="modal-card-body">
      {#if viewFilesNotice}
        <div class="notification is-info is-light view-files-notice">
          {viewFilesNotice}
        </div>
      {/if}
      {#if viewFiles.length === 0}
        <div class="view-files-empty">No files to display.</div>
      {:else}
        <ul class="view-files-list">
          {#each viewFiles as file (file.id)}
            <li>
              <span class="file-name" title={file.path}>{file.path.split('/').pop()}</span>
              <span class="file-size">{(file.bytes / (1024 * 1024)).toFixed(1)} MB</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
    <footer class="modal-card-foot">
      <button
        class="button"
        onclick={() => {
          showViewFilesModal = false;
          viewFiles = [];
          viewFilesTitle = '';
          viewFilesNotice = '';
        }}
      >
        Close
      </button>
    </footer>
  </div>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal" class:is-active={showDeleteModal}>
  <div class="modal-background"></div>
  <div class="modal-card delete-confirmation">
    <header class="modal-card-head">
      <p class="modal-card-title">Confirm Delete</p>
      <button
        class="delete"
        aria-label="close"
        onclick={() => {
          showDeleteModal = false;
          torrentsToDelete = [];
          torrentsToDeleteNames = [];
        }}
      ></button>
    </header>
    <section class="modal-card-body">
      <p>
        {#if torrentsToDelete.length === 1}
          Are you sure you want to delete
          <span class="deleted-asset">{torrentsToDeleteNames[0] ?? 'this torrent'}</span>? This action cannot be undone.
        {:else}
          Are you sure you want to delete <span class="deleted-asset">{torrentsToDelete.length}</span> torrents? This action cannot be undone.
        {/if}
      </p>
      {#if torrentsToDelete.length > 1}
        <ul class="delete-list">
          {#each torrentsToDeleteNames as name, i (`${name}-${i}`)}
            <li>{name}</li>
          {/each}
        </ul>
      {/if}
    </section>
    <footer class="modal-card-foot">
      <button
        class="button is-danger"
        class:is-loading={deletingTorrent}
        disabled={deletingTorrent}
        onclick={async () => {
          await deleteTorrents(torrentsToDelete);
          showDeleteModal = false;
          torrentsToDelete = [];
          torrentsToDeleteNames = [];
        }}
      >
        Delete
      </button>
      <button
        class="button"
        onclick={() => {
          showDeleteModal = false;
          torrentsToDelete = [];
          torrentsToDeleteNames = [];
        }}
      >
        Cancel
      </button>
    </footer>
  </div>
</div>


<style>
  /* Base Container Styles */
  .torrent-manager {
    margin-top: 1.5rem;
    padding: 1rem;
    background-color: #1e1e1e;
    border-radius: 8px;
    border: 1px solid #333;
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .manager-heading {
    flex: 1 1 260px;
  }

  .manager-heading h2 {
    color: #2196f3;
    font-size: 1.2rem;
    margin: 0;
  }

  .subtle {
    color: #8aa4c7;
    font-size: 0.85rem;
    margin-top: 0.35rem;
    max-width: 28rem;
  }

  .manager-toolbar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
    flex: 0 1 100%;
  }

  .toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    white-space: nowrap;
    flex: 0 0 auto;
  }

  .toolbar-button .icon {
    margin: 0;
  }

  .toolbar-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  :global(.button.is-info) {
    background-color: #2196f3;
  }

  :global(.button.is-info:hover) {
    background-color: #1976d2;
  }

  .torrents-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .torrent-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    background-color: #242424;
    border: 1px solid #333;
    border-radius: 8px;
    align-items: flex-start;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  }

  .torrent-row:hover {
    border-color: #2f80ed;
    background-color: #2a2a2a;
  }

  .torrent-row.is-selected {
    border-color: #2f80ed;
    box-shadow: 0 0 0 1px rgba(47, 128, 237, 0.35);
  }

  .torrent-checkbox {
    display: flex;
    align-items: flex-start;
    padding-top: 0.35rem;
  }

  .torrent-checkbox input {
    width: 18px;
    height: 18px;
    accent-color: #ff3860;
  }

  .torrent-body {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .torrent-name-row {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .torrent-status-row {
    display: flex;
    align-items: center;
  }

  .torrent-actions-row {
    width: 100%;
  }

  .torrent-name {
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1 1 auto;
  }

  .torrent-name:hover {
    color: #2196f3;
  }

  .torrent-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, max-content));
    gap: 0.5rem;
    justify-content: flex-start;
    align-items: stretch;
  }

  .torrent-actions .button {
    min-height: 2.1rem;
    font-size: 0.85rem;
    width: 100%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.45rem;
  }

  .status-meta {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    color: #9db3d4;
  }

  .status-tag {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .status-tag.is-waiting {
    background-color: rgba(255, 193, 7, 0.18);
    color: #ffca28;
  }

  .status-tag.is-active {
    background-color: rgba(33, 150, 243, 0.18);
    color: #64b5f6;
  }

  .status-tag.is-downloaded {
    background-color: rgba(76, 175, 80, 0.2);
    color: #72d572;
  }

  .status-tag.is-error {
    background-color: rgba(244, 67, 54, 0.18);
    color: #ef5350;
  }

  .size-tag {
    color: #9db3d4;
    font-weight: 500;
  }

  .file-count {
    font-weight: 600;
    font-size: 0.8rem;
    color: #b3c7e7;
    background-color: rgba(59, 130, 246, 0.15);
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
  }

  .progress-text {
    font-weight: 600;
    font-size: 0.8rem;
    color: #64b5f6;
  }

  .view-files-btn {
    border: none;
    background-color: rgba(59, 130, 246, 0.12);
    color: #90caf9;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .view-files-btn:hover {
    background-color: rgba(59, 130, 246, 0.2);
  }

  .view-files-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .view-files-btn .icon {
    margin: 0;
    display: inline-flex;
  }

  .view-files-modal .modal-card-body {
    padding: 1.25rem;
    background-color: #1e1e1e;
  }

  .view-files-notice {
    margin-bottom: 0.75rem;
  }

  .view-files-empty {
    color: #9db3d4;
    text-align: center;
    padding: 1rem 0;
  }

  .view-files-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 60vh;
    overflow-y: auto;
  }

  .view-files-list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    background-color: #242424;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 0.65rem 0.85rem;
  }

  .view-files-list .file-name {
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
  }

  .view-files-list .file-size {
    color: #90caf9;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Modal Styles */
  .modal-card {
    max-width: 100%;
    width: 800px !important;
    margin: 0 1rem;
    background-color: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    overflow: hidden;
  }

  .modal-card-head {
    background-color: #2a2a2a;
    border-bottom: 1px solid #333;
    padding: 1rem;
  }

  .modal-card-title {
    color: #fff;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .modal-card-body {
    background-color: #1e1e1e;
    color: #fff;
    padding: 0;
  }

  .modal-card-body .deleted-asset {
    font-weight: 600;
    color: #ff3860;
  }

  /* Links modal */
  .links-modal .modal-card-body {
    padding: 0;
  }

  .links-actions {
    padding: 1rem;
    border-bottom: 1px solid #333;
    background-color: #2a2a2a;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .links-list {
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.5rem 0.75rem 1rem;
  }

  .link-item {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background-color: #2a2a2a;
    border-radius: 6px;
  }

  .link-name {
    color: #fff;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    font-size: 0.95rem;
  }

  .link-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Select all checkbox container */
  .field {
    padding: 1rem;
    border-bottom: 1px solid #333;
    background-color: #2a2a2a;
  }

  .field .checkbox {
    color: #fff;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* File list container */
  .file-list {
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.5rem;
  }

  /* File item styles */
  .file-item {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    background-color: #2a2a2a;
    transition: background-color 0.2s ease;
  }

  .file-item:last-child {
    margin-bottom: 0;
  }

  .file-item:hover {
    background-color: #333;
  }

  .file-item label {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    color: #fff;
    width: 100%;
    cursor: pointer;
  }

  .filename {
    color: #fff;
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filesize {
    color: #2196f3;
    font-size: 0.85rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    background-color: rgba(33, 150, 243, 0.1);
    border-radius: 4px;
    white-space: nowrap;
  }

  /* Modal footer */
  .modal-card-foot {
    background-color: #2a2a2a;
    border-top: 1px solid #333;
    padding: 1rem;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  /* Custom scrollbar */
  .file-list::-webkit-scrollbar {
    width: 8px;
  }

  .file-list::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  .file-list::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }

  .file-list::-webkit-scrollbar-thumb:hover {
    background: #444;
  }

  /* Checkbox styling */
  .checkbox input[type='checkbox'] {
    margin-right: 0.5rem;
    width: 16px;
    height: 16px;
    accent-color: #2196f3;
  }

  /* Button styling */
  .button.is-success {
    background-color: #48c78e;
    transition: background-color 0.2s ease;
  }

  .button.is-success:hover {
    background-color: #3dbb81;
  }

  .button {
    border-radius: 6px;
    font-weight: 500;
    padding: 0.5rem 1rem;
  }

  /* Delete confirmation modal */
  .delete-confirmation .modal-card-body {
    padding: 1.5rem;
    text-align: center;
  }

  .delete-list {
    margin-top: 1rem;
    padding-left: 1.25rem;
    text-align: left;
    color: #ddd;
    font-size: 0.9rem;
    max-height: 160px;
    overflow-y: auto;
  }

  .delete-list li + li {
    margin-top: 0.35rem;
  }

  .delete-confirmation .modal-card-foot {
    justify-content: center;
    padding: 1rem;
  }


  :global(.notification.is-info.is-light) {
    background-color: rgba(33, 150, 243, 0.1);
    color: #90caf9;
    border: 1px solid rgba(33, 150, 243, 0.2);
  }

  :global(.notification.is-danger.is-light) {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.2);
  }

  :global(.notification.is-success.is-light) {
    background-color: rgba(72, 199, 142, 0.1);
    color: #48c78e;
    border: 1px solid rgba(72, 199, 142, 0.2);
    margin: 0;
    padding-right: 2rem;
  }

  /* Animation Styles */
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

  /* Enhanced Button Interactions */
  :global(.button) {
    transition: all 0.2s ease;
  }

  :global(.button:hover:not(:disabled)) {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  :global(.button:active:not(:disabled)) {
    transform: translateY(0);
  }

  :global(.button.is-loading) {
    pointer-events: none;
  }

  /* Status Badge Improvements */
  .status-tag {
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* Responsive Styles */
  @media screen and (max-width: 600px) {
    .modal-card {
      margin: 0 0.5rem;
    }

    .modal:has(.delete-confirmation) .modal-card {
      width: calc(100% - 2rem);
    }
  }
</style>

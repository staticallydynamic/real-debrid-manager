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

  const selectedIdSet = $derived(new Set(selectedTorrentIds));
  const totalTorrents = $derived(torrents.length);
  const allTorrentsSelected = $derived(
    totalTorrents > 0 && torrents.every((t) => selectedIdSet.has(t.id))
  );
  const hasSelection = $derived(torrents.some((t) => selectedIdSet.has(t.id)));
  const partiallySelected = $derived(hasSelection && !allTorrentsSelected);

  // File selection stats
  const selectedFileCount = $derived(selectedFiles.length);
  const totalFileCount = $derived(currentTorrentFiles.length);
  const selectedFilesTotalSize = $derived(() => {
    return currentTorrentFiles
      .filter(file => selectedFiles.includes(file.id))
      .reduce((total, file) => total + file.bytes, 0);
  });

  const { apiKey, openAddMagnet } = $props<{
    apiKey: string;
    openAddMagnet?: () => void;
  }>();

  function triggerAddMagnet() {
    console.log('Send Magnet button clicked - calling openAddMagnet');
    if (openAddMagnet) {
      openAddMagnet();
    }
  }

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

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
      const BATCH_SIZE = 2;
      const DELAY_MS = 800;
      const results: PromiseSettledResult<void>[] = [];

      for (let i = 0; i < torrentIds.length; i += BATCH_SIZE) {
        const batch = torrentIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map((id) => api.deleteTorrent(id)));
        results.push(...batchResults);

        if (i + BATCH_SIZE < torrentIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

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

  function selectAllTorrents() {
    if (!torrents.length) {
      selectedTorrentIds = [];
      return;
    }

    const next = new Set(selectedTorrentIds);
    torrents.forEach((torrent) => next.add(torrent.id));
    selectedTorrentIds = Array.from(next);
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
      <div class="toolbar-row-primary">
        <button class="toolbar-button add-magnet-btn" onclick={triggerAddMagnet}>
          <span class="icon">
            <i class="fas fa-magnet"></i>
          </span>
          <span>Send Magnet</span>
        </button>
        <button class="toolbar-button button is-info is-small" onclick={fetchTorrents} disabled={loading}>
          <span class="icon">
            <i class="fas fa-sync-alt" class:fa-spin={loading}></i>
          </span>
          <span>Refresh</span>
        </button>
      </div>

      <div class="toolbar-row-secondary">
        <button
          class="toolbar-button button is-light is-small"
          onclick={selectAllTorrents}
          disabled={totalTorrents === 0 || allTorrentsSelected}
        >
          <span class="icon">
            <i class="fas fa-check-double"></i>
          </span>
          <span>Select All</span>
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
  <div class="modal-background" onclick={() => (showFileModal = false)}></div>
  <div class="modal-content file-selection-content">
    <div class="file-selection-card">
      <header class="file-selection-card__header">
        <div class="file-selection-card__title">
          <i class="fas fa-file-import"></i>
          <span>Select Files</span>
        </div>
        <p class="file-selection-card__subtitle">Choose which files to download from this torrent.</p>

        <div class="file-selection-stats">
          <div class="stat-item">
            <span class="stat-label">Selected:</span>
            <span class="stat-value">{selectedFileCount} of {totalFileCount} files</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Size:</span>
            <span class="stat-value">{formatFileSize(selectedFilesTotalSize())}</span>
          </div>
        </div>
      </header>

      <section class="file-selection-card__body">
        <div class="select-all-section">
          <label class="checkbox select-all-checkbox">
            <input
              type="checkbox"
              checked={selectedFiles.length === currentTorrentFiles.length}
              onclick={toggleAllFiles}
            />
            Select All Files
          </label>
        </div>

        <div class="file-list-container">
          {#each currentTorrentFiles as file (file.id)}
            <div class="file-item">
              <label class="checkbox file-checkbox">
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

      <footer class="file-selection-card__footer">
        <button class="button is-light" onclick={() => (showFileModal = false)}>Cancel</button>
        <button class="button is-success" onclick={selectFiles} disabled={selectedFiles.length === 0}>
          <span class="icon">
            <i class="fas fa-download"></i>
          </span>
          <span>Download Selected</span>
        </button>
      </footer>
    </div>
  </div>
  <button onclick={() => (showFileModal = false)} class="modal-close is-large" aria-label="close"></button>
</div>

<!-- Links Modal -->
<div class="modal" class:is-active={showLinksModal}>
  <div class="modal-background" onclick={() => (showLinksModal = false)}></div>
  <div class="modal-content links-content">
    <div class="links-card">
      <header class="links-card__header">
        <div class="links-card__title">
          <i class="fas fa-link"></i>
          <span>Download Links</span>
        </div>
        <p class="links-card__subtitle">Download or copy links for the selected torrent files.</p>
      </header>

      <section class="links-card__body">
        <div class="links-actions-section">
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

        <div class="links-list-container">
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

      <footer class="links-card__footer">
        <button class="button is-light" onclick={() => (showLinksModal = false)}>Close</button>
      </footer>
    </div>
  </div>
  <button onclick={() => (showLinksModal = false)} class="modal-close is-large" aria-label="close"></button>
</div>

<!-- View Selected Files Modal -->
<div class="modal" class:is-active={showViewFilesModal}>
  <div class="modal-background" onclick={() => {
    showViewFilesModal = false;
    viewFiles = [];
    viewFilesTitle = '';
    viewFilesNotice = '';
  }}></div>
  <div class="modal-content view-files-content">
    <div class="view-files-card">
      <header class="view-files-card__header">
        <div class="view-files-card__title">
          <i class="fas fa-list"></i>
          <span>Files for {viewFilesTitle}</span>
        </div>
        <p class="view-files-card__subtitle">Viewing files selected for download in this torrent.</p>
      </header>

      <section class="view-files-card__body">
        {#if viewFilesNotice}
          <div class="view-files-notice">
            <i class="fas fa-info-circle"></i>
            <span>{viewFilesNotice}</span>
          </div>
        {/if}

        {#if viewFiles.length === 0}
          <div class="view-files-empty">
            <i class="fas fa-folder-open"></i>
            <span>No files to display.</span>
          </div>
        {:else}
          <div class="view-files-list-container">
            {#each viewFiles as file (file.id)}
              <div class="view-file-item">
                <span class="view-file-name" title={file.path}>{file.path.split('/').pop()}</span>
                <span class="view-file-size">{formatFileSize(file.bytes)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <footer class="view-files-card__footer">
        <button
          class="button is-light"
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
  <button onclick={() => {
    showViewFilesModal = false;
    viewFiles = [];
    viewFilesTitle = '';
    viewFilesNotice = '';
  }} class="modal-close is-large" aria-label="close"></button>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal" class:is-active={showDeleteModal}>
  <div class="modal-background" onclick={() => {
    showDeleteModal = false;
    torrentsToDelete = [];
    torrentsToDeleteNames = [];
  }}></div>
  <div class="modal-content delete-confirmation-content">
    <div class="delete-confirmation-card">
      <header class="delete-confirmation-card__header">
        <div class="delete-confirmation-card__title">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Confirm Delete</span>
        </div>
        <p class="delete-confirmation-card__subtitle">This action cannot be undone.</p>
      </header>

      <section class="delete-confirmation-card__body">
        <div class="delete-confirmation-message">
          {#if torrentsToDelete.length === 1}
            Are you sure you want to delete <span class="deleted-asset">{torrentsToDeleteNames[0] ?? 'this torrent'}</span>?
          {:else}
            Are you sure you want to delete <span class="deleted-asset">{torrentsToDelete.length} torrents</span>?
          {/if}
        </div>

        {#if torrentsToDelete.length > 1}
          <div class="delete-list-container">
            {#each torrentsToDeleteNames as name, i (`${name}-${i}`)}
              <div class="delete-list-item">{name}</div>
            {/each}
          </div>
        {/if}
      </section>

      <footer class="delete-confirmation-card__footer">
        <button
          class="button is-light"
          onclick={() => {
            showDeleteModal = false;
            torrentsToDelete = [];
            torrentsToDeleteNames = [];
          }}
        >
          Cancel
        </button>
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
          <span class="icon">
            <i class="fas fa-trash"></i>
          </span>
          <span>{deletingTorrent ? 'Deleting...' : 'Delete'}</span>
        </button>
      </footer>
    </div>
  </div>
  <button onclick={() => {
    showDeleteModal = false;
    torrentsToDelete = [];
    torrentsToDeleteNames = [];
  }} class="modal-close is-large" aria-label="close"></button>
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
    flex-direction: column;
    gap: 1rem;
    flex: 0 1 100%;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9), rgba(40, 40, 40, 0.9));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(20px);
  }

  .toolbar-row-primary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
  }

  .toolbar-row-secondary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .add-magnet-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .add-magnet-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
  }

  .toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0 1.25rem;
    height: 2.5rem;
    border-radius: 8px;
    white-space: nowrap;
    flex: 0 0 auto;
    border: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
  }

  .toolbar-button.is-info {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
  }

  .toolbar-button.is-info:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
  }

  .toolbar-button.is-light {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .toolbar-button.is-light:hover {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .toolbar-button.is-danger {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
  }

  .toolbar-button.is-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6);
  }

  .toolbar-button:active {
    transform: translateY(0);
  }

  .toolbar-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    transform: none !important;
    box-shadow: none !important;
    background: rgba(255, 255, 255, 0.05) !important;
    color: rgba(255, 255, 255, 0.3) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  .toolbar-button .icon {
    margin: 0;
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

  /* File Selection Modal Styles */
  .file-selection-content {
    max-width: 600px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .file-selection-card {
    position: relative;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.96), rgba(34, 34, 34, 0.96));
    border-radius: 12px;
    border: 1px solid rgba(59, 130, 246, 0.35);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.65rem 1.35rem;
    max-height: calc(100vh - 6rem);
  }

  .file-selection-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .file-selection-card__title {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .file-selection-card__title i {
    color: #3b82f6;
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
  }

  .file-selection-card__subtitle {
    margin: 0;
    color: #9db3d4;
    font-size: 0.85rem;
  }

  .file-selection-stats {
    display: flex;
    gap: 1.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    background-color: rgba(30, 30, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #90caf9;
    font-weight: 600;
  }

  .stat-value {
    font-size: 0.9rem;
    color: #fff;
    font-weight: 500;
  }

  .file-selection-card__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    min-height: 0;
  }

  .select-all-section {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    background-color: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
  }

  .select-all-checkbox {
    color: #fff;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .file-list-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    max-height: 50vh;
    padding: 0.25rem;
  }

  .file-item {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    background-color: rgba(42, 42, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  .file-item:last-child {
    margin-bottom: 0;
  }

  .file-item:hover {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .file-checkbox {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    color: #fff;
    width: 100%;
    cursor: pointer;
    margin: 0;
  }

  .file-selection-card__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
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

  /* Custom scrollbar for file list */
  .file-list-container::-webkit-scrollbar {
    width: 8px;
  }

  .file-list-container::-webkit-scrollbar-track {
    background: rgba(30, 30, 30, 0.5);
    border-radius: 4px;
  }

  .file-list-container::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.6);
    border-radius: 4px;
  }

  .file-list-container::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.8);
  }

  /* Links Modal Styles */
  .links-content {
    max-width: 600px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .links-card {
    position: relative;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.96), rgba(34, 34, 34, 0.96));
    border-radius: 12px;
    border: 1px solid rgba(33, 150, 243, 0.35);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.65rem 1.35rem;
    max-height: calc(100vh - 6rem);
  }

  .links-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .links-card__title {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .links-card__title i {
    color: #2196f3;
    text-shadow: 0 0 10px rgba(33, 150, 243, 0.6);
  }

  .links-card__subtitle {
    margin: 0;
    color: #9db3d4;
    font-size: 0.85rem;
  }

  .links-card__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    min-height: 0;
  }

  .links-actions-section {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    background-color: rgba(33, 150, 243, 0.1);
    border: 1px solid rgba(33, 150, 243, 0.2);
    border-radius: 8px;
  }

  .links-list-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    max-height: 50vh;
    padding: 0.25rem;
  }

  .links-card__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .links-list-container::-webkit-scrollbar {
    width: 8px;
  }

  .links-list-container::-webkit-scrollbar-track {
    background: rgba(30, 30, 30, 0.5);
    border-radius: 4px;
  }

  .links-list-container::-webkit-scrollbar-thumb {
    background: rgba(33, 150, 243, 0.6);
    border-radius: 4px;
  }

  .links-list-container::-webkit-scrollbar-thumb:hover {
    background: rgba(33, 150, 243, 0.8);
  }

  /* View Files Modal Styles */
  .view-files-content {
    max-width: 600px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .view-files-card {
    position: relative;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.96), rgba(34, 34, 34, 0.96));
    border-radius: 12px;
    border: 1px solid rgba(139, 69, 19, 0.35);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.65rem 1.35rem;
    max-height: calc(100vh - 6rem);
  }

  .view-files-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .view-files-card__title {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .view-files-card__title i {
    color: #cd853f;
    text-shadow: 0 0 10px rgba(205, 133, 63, 0.6);
  }

  .view-files-card__subtitle {
    margin: 0;
    color: #9db3d4;
    font-size: 0.85rem;
  }

  .view-files-card__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    min-height: 0;
  }

  .view-files-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: rgba(33, 150, 243, 0.1);
    border: 1px solid rgba(33, 150, 243, 0.2);
    border-radius: 8px;
    color: #90caf9;
    font-size: 0.85rem;
  }

  .view-files-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #9db3d4;
    text-align: center;
  }

  .view-files-empty i {
    font-size: 2rem;
    color: #cd853f;
    opacity: 0.5;
  }

  .view-files-list-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    max-height: 50vh;
    padding: 0.25rem;
  }

  .view-file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background-color: rgba(42, 42, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .view-file-item:last-child {
    margin-bottom: 0;
  }

  .view-file-item:hover {
    background-color: rgba(205, 133, 63, 0.1);
    border-color: rgba(205, 133, 63, 0.3);
  }

  .view-file-name {
    color: #fff;
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .view-file-size {
    color: #cd853f;
    font-weight: 600;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .view-files-card__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .view-files-list-container::-webkit-scrollbar {
    width: 8px;
  }

  .view-files-list-container::-webkit-scrollbar-track {
    background: rgba(30, 30, 30, 0.5);
    border-radius: 4px;
  }

  .view-files-list-container::-webkit-scrollbar-thumb {
    background: rgba(205, 133, 63, 0.6);
    border-radius: 4px;
  }

  .view-files-list-container::-webkit-scrollbar-thumb:hover {
    background: rgba(205, 133, 63, 0.8);
  }

  /* Delete Confirmation Modal Styles */
  .delete-confirmation-content {
    max-width: 500px;
    width: calc(100% - 2rem);
    margin: 3rem auto;
  }

  .delete-confirmation-card {
    position: relative;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.96), rgba(34, 34, 34, 0.96));
    border-radius: 12px;
    border: 1px solid rgba(220, 53, 69, 0.35);
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem 1.65rem 1.35rem;
  }

  .delete-confirmation-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
    text-align: center;
  }

  .delete-confirmation-card__title {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    font-size: 1.05rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
  }

  .delete-confirmation-card__title i {
    color: #dc3545;
    text-shadow: 0 0 10px rgba(220, 53, 69, 0.6);
  }

  .delete-confirmation-card__subtitle {
    margin: 0;
    color: #dc3545;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .delete-confirmation-card__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    text-align: center;
  }

  .delete-confirmation-message {
    color: #fff;
    font-size: 1rem;
    line-height: 1.5;
  }

  .deleted-asset {
    font-weight: 600;
    color: #dc3545;
  }

  .delete-list-container {
    max-height: 200px;
    overflow-y: auto;
    padding: 0.75rem 1rem;
    background-color: rgba(30, 30, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    text-align: left;
  }

  .delete-list-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #ddd;
    font-size: 0.9rem;
  }

  .delete-list-item:last-child {
    border-bottom: none;
  }

  .delete-confirmation-card__footer {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    flex-shrink: 0;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .delete-list-container::-webkit-scrollbar {
    width: 8px;
  }

  .delete-list-container::-webkit-scrollbar-track {
    background: rgba(30, 30, 30, 0.5);
    border-radius: 4px;
  }

  .delete-list-container::-webkit-scrollbar-thumb {
    background: rgba(220, 53, 69, 0.6);
    border-radius: 4px;
  }

  .delete-list-container::-webkit-scrollbar-thumb:hover {
    background: rgba(220, 53, 69, 0.8);
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

    .file-selection-content,
    .links-content,
    .view-files-content {
      margin: 1rem auto;
      width: calc(100% - 1rem);
    }

    .file-selection-card,
    .links-card,
    .view-files-card {
      max-height: calc(100vh - 2rem);
      padding: 1rem 1.25rem 1rem;
    }

    .delete-confirmation-content {
      margin: 1rem auto;
      width: calc(100% - 1rem);
    }

    .delete-confirmation-card {
      max-height: calc(100vh - 2rem);
      padding: 1rem 1.25rem 1rem;
    }

    .file-selection-stats {
      flex-direction: column;
      gap: 0.75rem;
    }

    .stat-item {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }

    .links-actions-section {
      flex-direction: column;
      gap: 0.5rem;
    }

    .manager-toolbar {
      padding: 0.75rem;
      gap: 0.75rem;
    }

    .toolbar-row-primary,
    .toolbar-row-secondary {
      gap: 0.5rem;
      justify-content: center;
    }

    .toolbar-button {
      height: 2.25rem;
      font-size: 0.8rem;
      padding: 0 1rem;
      gap: 0.375rem;
    }

    .file-checkbox {
      grid-template-columns: auto 1fr;
      gap: 0.75rem;
    }

    .filesize {
      grid-column: 1 / -1;
      margin-top: 0.25rem;
      font-size: 0.75rem;
    }
  }
</style>

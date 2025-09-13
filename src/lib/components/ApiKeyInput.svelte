<script lang="ts">
  let apiKey: string = $state('');
  let showApiKey: boolean = $state(false);

  const { handleApiKeyChange, initialValue } = $props<{
    handleApiKeyChange: (apiKey: string) => void;
    initialValue: string;
  }>();

  function handleChange() {
    handleApiKeyChange(apiKey);
  }

  $effect(() => {
    if (initialValue) {
      apiKey = initialValue;
    }
  });

  function toggleVisibility() {
    showApiKey = !showApiKey;
  }
</script>

<div class="input-group">
  <div class="field has-addons">
    <div class="control is-expanded">
      <input
        type={showApiKey ? 'text' : 'password'}
        bind:value={apiKey}
        placeholder="Enter Real-Debrid API Key"
        class="input"
      />
    </div>
    <div class="control">
      <button class="button" onclick={toggleVisibility}>
        <i class="fas fa-{showApiKey ? 'eye-slash' : 'eye'}"></i>
      </button>
    </div>
    <div class="control">
      <button class="button is-info" onclick={handleChange}>
        <i class="fas fa-save"></i>
        <span>Save</span>
      </button>
    </div>
  </div>
</div>

<style>
  .input-group {
    /* display: flex; */
    width: 100%;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #444;
    border-radius: 6px;
    background-color: #333;
    color: white;
    font-family: monospace;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  button:hover {
    background-color: #1976d2;
  }
</style>

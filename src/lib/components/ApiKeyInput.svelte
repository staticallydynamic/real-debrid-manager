<script lang="ts">
    let apiKey: string = $state("");
    let debouncedKey: string = $state("");

    const { handleApiKeyChange } = $props<{
        onChange: (apiKey: string) => void;
    }>();

    function handleChange() {
        handleApiKeyChange(apiKey);
        debouncedKey = apiKey;
    }
</script>

<div>
    <label for="apiKey">API Key:</label>
    <input
        type="text"
        id="apiKey"
        bind:value={apiKey}
        placeholder="Enter your Real Debrid API key."
    />
    <button onclick={handleChange}>Save API Key</button>
</div>

<style>
    div {
        margin-bottom: 20px;
    }

    label {
        display: block;
        margin-bottom: 5px;
    }

    input {
        width: 100%;
        padding: 8px;
        font-size: 16px;
    }
</style>

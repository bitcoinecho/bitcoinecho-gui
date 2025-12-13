<script lang="ts">
  interface Props {
    value: string;
    truncate?: boolean;
    truncateLength?: number;
    copyable?: boolean;
    class?: string;
  }

  let {
    value,
    truncate = true,
    truncateLength = 8,
    copyable = true,
    class: className = ''
  }: Props = $props();

  let copied = $state(false);

  function truncateHash(hash: string, len: number): string {
    if (!truncate || hash.length <= len * 2 + 3) return hash;
    return `${hash.slice(0, len)}...${hash.slice(-len)}`;
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
</script>

<span class="inline-flex items-center gap-1.5 {className}">
  <code class="font-mono text-sm text-btc-orange" title={value}>
    {truncateHash(value, truncateLength)}
  </code>
  {#if copyable}
    <button
      onclick={copyToClipboard}
      class="text-echo-dim hover:text-echo-muted transition-colors"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {#if copied}
        <svg class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
          ></path>
        </svg>
      {:else}
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          ></path>
        </svg>
      {/if}
    </button>
  {/if}
</span>

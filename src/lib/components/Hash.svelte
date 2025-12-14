<script lang="ts">
  interface Props {
    value: string;
    truncate?: boolean;
    truncateLength?: number;
    copyable?: boolean;
    explorerUrl?: string;
    expand?: boolean; // When true, fill container with middle ellipsis
    class?: string;
  }

  let {
    value,
    truncate = true,
    truncateLength = 8,
    copyable = true,
    explorerUrl,
    expand = false,
    class: className = ''
  }: Props = $props();

  let copied = $state(false);

  // Split hash into dimmed prefix (leading zeros) and bright suffix (significant bytes)
  function getHashParts(hash: string, len: number): { prefix: string; suffix: string } {
    if (!truncate || hash.length <= len * 2 + 3) {
      // Find where leading zeros end
      const firstNonZero = hash.search(/[^0]/);
      if (firstNonZero === -1) return { prefix: hash, suffix: '' };
      return { prefix: hash.slice(0, firstNonZero), suffix: hash.slice(firstNonZero) };
    }

    // For truncated display: show start...end
    const start = hash.slice(0, len);
    const end = hash.slice(-len);

    // Find first non-zero in start portion
    const firstNonZero = start.search(/[^0]/);
    if (firstNonZero === -1) {
      return { prefix: start + '...', suffix: end };
    }
    return {
      prefix: start.slice(0, firstNonZero),
      suffix: start.slice(firstNonZero) + '...' + end
    };
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

  const parts = $derived(getHashParts(value, truncateLength));

  // For expand mode, split hash in half for CSS middle-truncation
  const halfLen = $derived(Math.ceil(value.length / 2));
  const firstHalf = $derived(value.slice(0, halfLen));
  const secondHalf = $derived(value.slice(halfLen));
</script>

<style>
  .hash-expand {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .hash-expand code {
    display: flex;
    flex: 1;
    min-width: 0;
  }

  .hash-start {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hash-end {
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>

<span class="group inline-flex items-center gap-2.5 {expand ? 'hash-expand' : ''} {className}">
  {#if expand}
    <code class="font-mono text-echo-text" title={value}>
      <span class="hash-start">{firstHalf}</span><span class="hash-end">{secondHalf}</span>
    </code>
  {:else}
    <code class="font-mono" title={value}>
      <span class="text-echo-dim">{parts.prefix}</span><span class="text-echo-text">{parts.suffix}</span>
    </code>
  {/if}
  {#if copyable}
    <button
      onclick={copyToClipboard}
      class="flex-shrink-0 text-echo-dim transition-colors duration-300 hover:text-echo-text"
      title={copied ? 'Copied!' : 'Copy'}
    >
      {#if copied}
        <svg class="h-4 w-4 text-echo-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      {:else}
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          ></path>
        </svg>
      {/if}
    </button>
  {/if}
  {#if explorerUrl}
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="flex-shrink-0 text-echo-dim transition-colors duration-300 hover:text-echo-text"
      title="View on mempool.space"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        ></path>
      </svg>
    </a>
  {/if}
</span>

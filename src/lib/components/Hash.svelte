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
</script>

<span class="group inline-flex items-center gap-2.5 {className}">
  <code class="font-mono" title={value}>
    <span class="text-echo-dim">{parts.prefix}</span><span class="text-echo-text">{parts.suffix}</span>
  </code>
  {#if copyable}
    <button
      onclick={copyToClipboard}
      class="text-echo-dim transition-colors duration-300 hover:text-echo-text"
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
</span>

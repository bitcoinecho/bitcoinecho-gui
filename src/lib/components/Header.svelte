<script lang="ts">
  import type { ConnectionStatus as ConnectionStatusType } from '$lib/rpc/types';
  import ConnectionStatus from './ConnectionStatus.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  interface Props {
    status?: ConnectionStatusType;
    error?: string | null;
    syncing?: boolean;
    blockHeight?: number;
    hashrate?: number;
  }

  let { status = 'disconnected', error = null, syncing = false, blockHeight = 0, hashrate = 0 }: Props = $props();

  // Format hashrate with appropriate unit (EH/s or ZH/s)
  function formatHashrate(ehps: number): { value: string; unit: string } {
    if (ehps === 0) return { value: '—', unit: '' };
    // If >= 1000 EH/s, show as ZH/s
    if (ehps >= 1000) {
      return { value: (ehps / 1000).toFixed(2), unit: 'ZH/s' };
    }
    return { value: ehps.toFixed(1), unit: 'EH/s' };
  }

  const hashrateDisplay = $derived(formatHashrate(hashrate));
</script>

<header class="border-b border-echo-border bg-echo-bg">
  <div class="flex h-14 items-center justify-between px-6">
    <!-- Logo -->
    <a href="/" class="group flex items-center gap-3 transition-opacity duration-300 hover:opacity-70">
      <img src="/logo.jpg" alt="Bitcoin Echo" class="h-7 w-7" style="filter: var(--color-logo-invert);" />
      <span class="font-mono text-sm uppercase tracking-wide text-echo-muted">Bitcoin Echo</span>
    </a>

    <!-- Status -->
    <div class="flex items-center gap-8 font-mono text-sm uppercase tracking-wide">
      {#if syncing}
        <span class="text-echo-muted">Syncing...</span>
      {/if}

      {#if hashrate > 0}
        <span class="text-echo-muted">
          <span class="text-echo-text">{hashrateDisplay.value}</span> {hashrateDisplay.unit}
        </span>
      {/if}

      {#if blockHeight > 0}
        <span class="text-echo-muted">
          Block <span class="text-echo-text">{blockHeight.toLocaleString()}</span>
        </span>
      {/if}

      <ConnectionStatus {status} {error} />

      <ThemeToggle />
    </div>
  </div>
</header>

<script lang="ts">
  import Badge from './Badge.svelte';
  import Spinner from './Spinner.svelte';

  interface Props {
    connected?: boolean;
    syncing?: boolean;
    blockHeight?: number;
  }

  let { connected = false, syncing = false, blockHeight = 0 }: Props = $props();
</script>

<header class="sticky top-0 z-50 border-b border-echo-border bg-echo-bg/95 backdrop-blur">
  <div class="flex h-14 items-center justify-between px-4">
    <!-- Logo -->
    <div class="flex items-center gap-3">
      <a href="/" class="flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-btc-orange text-echo-bg font-bold text-sm"
        >
          BE
        </div>
        <span class="text-lg font-semibold text-echo-text">Bitcoin Echo</span>
      </a>
    </div>

    <!-- Status -->
    <div class="flex items-center gap-4">
      {#if syncing}
        <div class="flex items-center gap-2 text-sm text-echo-muted">
          <Spinner size="sm" />
          <span>Syncing...</span>
        </div>
      {/if}

      {#if blockHeight > 0}
        <div class="text-sm text-echo-muted">
          Block <span class="font-mono text-echo-text">{blockHeight.toLocaleString()}</span>
        </div>
      {/if}

      <Badge variant={connected ? 'success' : 'error'}>
        {#if connected}
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
            Connected
          </span>
        {:else}
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-red-400"></span>
            Disconnected
          </span>
        {/if}
      </Badge>
    </div>
  </div>
</header>

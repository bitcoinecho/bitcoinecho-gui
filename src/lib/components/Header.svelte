<script lang="ts">
  interface Props {
    connected?: boolean;
    syncing?: boolean;
    blockHeight?: number;
  }

  let { connected = false, syncing = false, blockHeight = 0 }: Props = $props();
</script>

<header class="border-b border-echo-border bg-echo-bg">
  <div class="flex h-14 items-center justify-between px-6">
    <!-- Logo -->
    <a href="/" class="group flex items-center gap-3 transition-opacity duration-300 hover:opacity-70">
      <img src="/logo.jpg" alt="Bitcoin Echo" class="h-7 w-7 invert" />
      <span class="font-mono text-sm uppercase tracking-wide text-echo-muted">Bitcoin Echo</span>
    </a>

    <!-- Status -->
    <div class="flex items-center gap-8 font-mono text-sm uppercase tracking-wide">
      {#if syncing}
        <span class="text-echo-muted">Syncing...</span>
      {/if}

      {#if blockHeight > 0}
        <span class="text-echo-muted">
          Block <span class="text-echo-text">{blockHeight.toLocaleString()}</span>
        </span>
      {/if}

      <span class="flex items-center gap-2 {connected ? 'text-echo-muted' : 'text-echo-dim'}">
        <span
          class="h-2 w-2 rounded-full transition-colors duration-500 {connected ? 'bg-echo-text' : 'bg-echo-dim'}"
        ></span>
        {connected ? 'Connected' : 'Offline'}
      </span>
    </div>
  </div>
</header>

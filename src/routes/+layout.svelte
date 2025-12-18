<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { connection, connectionStatus, connectionError, blockHeight, networkHashrate } from '$lib/stores/connection';

  let { children } = $props();

  // Auto-connect to node when app loads (browser only)
  onMount(() => {
    connection.connect();
  });
</script>

<div class="flex h-screen flex-col bg-echo-bg text-echo-text">
  <Header status={$connectionStatus} error={$connectionError} syncing={false} blockHeight={$blockHeight} hashrate={$networkHashrate} />

  <div class="flex flex-1 overflow-hidden">
    <Sidebar />

    <main class="flex-1 overflow-y-auto px-12 py-10">
      {@render children()}
    </main>
  </div>
</div>

<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { isConnected, blockHeight, networkHashrate } from '$lib/stores/connection';

  let { children } = $props();
</script>

<div class="flex h-screen flex-col bg-echo-bg text-echo-text">
  <Header connected={$isConnected} syncing={false} blockHeight={$blockHeight} hashrate={$networkHashrate} />

  <div class="flex flex-1 overflow-hidden">
    <Sidebar />

    <main class="flex-1 overflow-y-auto px-12 py-10">
      {@render children()}
    </main>
  </div>
</div>

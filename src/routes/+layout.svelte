<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  let { children } = $props();

  // Mock state for now - will be replaced with real RPC connection
  let connected = $state(false);
  let syncing = $state(false);
  let blockHeight = $state(0);

  // Simulate connection after mount (for demo purposes)
  $effect(() => {
    const timer = setTimeout(() => {
      connected = true;
      blockHeight = 874571;
    }, 1500);

    return () => clearTimeout(timer);
  });
</script>

<div class="flex h-screen flex-col bg-echo-bg text-echo-text">
  <Header {connected} {syncing} {blockHeight} />

  <div class="flex flex-1 overflow-hidden">
    <Sidebar />

    <main class="flex-1 overflow-y-auto px-12 py-10">
      {@render children()}
    </main>
  </div>
</div>

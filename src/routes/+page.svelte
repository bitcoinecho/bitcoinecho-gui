<script lang="ts">
  import { Hash } from '$lib';

  // Mock data - will be replaced with real RPC calls
  const now = Math.floor(Date.now() / 1000);

  const mockChainInfo = {
    chain: 'main',
    blocks: 874571,
    headers: 874571,
    bestblockhash: '00000000000000000000b3e1f7d5c8a9e2d4f6b8c0a2e4d6f8b0c2a4e6d8f0b2',
    difficulty: 103919634711492.1,
    mediantime: now,
    chainwork: '00000000000000000000000000000000000000009d8e7f6a5b4c3d2e1f0a9b8c',
    verificationprogress: 1.0
  };

  function formatDifficulty(diff: number): string {
    if (diff >= 1e12) return (diff / 1e12).toFixed(2) + ' T';
    if (diff >= 1e9) return (diff / 1e9).toFixed(2) + ' G';
    if (diff >= 1e6) return (diff / 1e6).toFixed(2) + ' M';
    return diff.toLocaleString();
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
</script>

<div class="max-w-3xl">
  <!-- Page Header -->
  <header class="mb-14">
    <h1 class="text-3xl font-normal tracking-tight text-echo-text">Chain Status</h1>
    <p class="mt-3 text-lg text-echo-muted">Bitcoin Echo node overview</p>
  </header>

  <!-- Primary Stats -->
  <div class="mb-14 grid grid-cols-2 gap-16">
    <div>
      <p class="font-mono text-sm uppercase tracking-wide text-echo-muted">Block Height</p>
      <p class="mt-3 font-mono text-4xl tracking-tight text-echo-text">{mockChainInfo.blocks.toLocaleString()}</p>
    </div>
    <div>
      <p class="font-mono text-sm uppercase tracking-wide text-echo-muted">Difficulty</p>
      <p class="mt-3 font-mono text-4xl tracking-tight text-echo-text">{formatDifficulty(mockChainInfo.difficulty)}</p>
    </div>
  </div>

  <!-- Divider -->
  <div class="mb-14 h-px bg-echo-border"></div>

  <!-- Chain Details -->
  <div class="space-y-6">
    <div class="flex items-baseline justify-between py-1">
      <span class="text-echo-muted">Network</span>
      <span class="font-mono text-echo-text">{mockChainInfo.chain}net</span>
    </div>

    <div class="flex items-baseline justify-between py-1">
      <span class="text-echo-muted">Median Time</span>
      <span class="font-mono text-echo-text">{formatTime(mockChainInfo.mediantime)}</span>
    </div>

    <div class="flex items-baseline justify-between py-1">
      <span class="text-echo-muted">Best Block</span>
      <Hash value={mockChainInfo.bestblockhash} truncateLength={16} />
    </div>

    <div class="flex items-baseline justify-between py-1">
      <span class="text-echo-muted">Chain Work</span>
      <Hash value={mockChainInfo.chainwork} truncateLength={16} />
    </div>

    <div class="flex items-baseline justify-between py-1">
      <span class="text-echo-muted">Status</span>
      <span class="font-mono text-sm uppercase tracking-wide text-echo-text">Synced</span>
    </div>
  </div>
</div>

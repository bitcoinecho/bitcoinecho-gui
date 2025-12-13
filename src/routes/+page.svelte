<script lang="ts">
  import { Card, Badge, Hash, Button, Spinner } from '$lib';

  // Mock data - will be replaced with real RPC calls
  // Use current time for realistic demo
  const now = Math.floor(Date.now() / 1000);

  const mockChainInfo = {
    chain: 'main',
    blocks: 874571,
    headers: 874571,
    bestblockhash: '00000000000000000000b3e1f7d5c8a9e2d4f6b8c0a2e4d6f8b0c2a4e6d8f0b2',
    difficulty: 103919634711492.1, // ~103.92 T (current as of Dec 2025)
    mediantime: now, // Current time for demo display
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

<div class="space-y-6">
  <!-- Page Header -->
  <div>
    <h1 class="text-2xl font-bold text-echo-text">Dashboard</h1>
    <p class="mt-1 text-sm text-echo-muted">Bitcoin Echo node status and chain information</p>
  </div>

  <!-- Status Cards Grid -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Block Height -->
    <Card>
      <div class="flex items-center justify-between">
        <span class="text-sm text-echo-muted">Block Height</span>
        <Badge variant="success">Synced</Badge>
      </div>
      <p class="mt-2 text-2xl font-bold text-echo-text">
        {mockChainInfo.blocks.toLocaleString()}
      </p>
    </Card>

    <!-- Difficulty -->
    <Card>
      <div class="text-sm text-echo-muted">Difficulty</div>
      <p class="mt-2 text-2xl font-bold text-echo-text">
        {formatDifficulty(mockChainInfo.difficulty)}
      </p>
    </Card>

    <!-- Network -->
    <Card>
      <div class="text-sm text-echo-muted">Network</div>
      <p class="mt-2 text-2xl font-bold text-btc-orange capitalize">
        {mockChainInfo.chain}net
      </p>
    </Card>

    <!-- Median Time -->
    <Card>
      <div class="text-sm text-echo-muted">Median Time</div>
      <p class="mt-2 text-lg font-medium text-echo-text">
        {formatTime(mockChainInfo.mediantime)}
      </p>
    </Card>
  </div>

  <!-- Best Block -->
  <Card title="Best Block">
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-echo-muted">Block Hash</span>
        <Hash value={mockChainInfo.bestblockhash} truncateLength={12} />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-echo-muted">Chain Work</span>
        <Hash value={mockChainInfo.chainwork} truncateLength={12} />
      </div>
    </div>
  </Card>

  <!-- Quick Actions -->
  <Card title="Quick Actions">
    <div class="flex flex-wrap gap-3">
      <Button variant="primary" size="sm">View Latest Block</Button>
      <Button variant="secondary" size="sm">Broadcast Transaction</Button>
      <Button variant="ghost" size="sm">Open Console</Button>
    </div>
  </Card>

  <!-- Component Showcase (temporary - for screenshot) -->
  <Card title="Design System Preview">
    <div class="space-y-4">
      <div>
        <p class="mb-2 text-xs uppercase tracking-wide text-echo-dim">Buttons</p>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">Primary</Button>
          <Button variant="secondary" size="sm">Secondary</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
        </div>
      </div>

      <div>
        <p class="mb-2 text-xs uppercase tracking-wide text-echo-dim">Badges</p>
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </div>

      <div>
        <p class="mb-2 text-xs uppercase tracking-wide text-echo-dim">Loading</p>
        <div class="flex items-center gap-4">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </div>
    </div>
  </Card>
</div>

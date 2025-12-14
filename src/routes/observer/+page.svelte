<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { derived } from 'svelte/store';
	import { getObserverDataBatch } from '$lib/rpc/client';
	import { observerStats, isConnected, connectionStatus, connection } from '$lib/stores/connection';
	import Card from '$lib/components/Card.svelte';
	import Hash from '$lib/components/Hash.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import type { ObservedBlock, ObservedTx } from '$lib/rpc/types';

	let blocks = $state<ObservedBlock[]>([]);
	let transactions = $state<ObservedTx[]>([]);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let timeInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Golden ratio interval (1.618s) - the single heartbeat for all RPC calls
	 */
	const HEARTBEAT_INTERVAL = 1618;

	// Reactive time for updating "X ago" timestamps
	let now = $state(Date.now());

	// Derived stores to prevent re-renders on every tick
	const peerCount = derived(observerStats, ($stats) => $stats?.peer_count ?? 0);
	const uptimeMinutes = derived(observerStats, ($stats) =>
		$stats ? Math.floor($stats.uptime_seconds / 60) : 0
	);
	const invCount = derived(observerStats, ($stats) => $stats?.messages_received.inv ?? 0);

	// Format timestamp to relative time (uses reactive `now` for live updates)
	function formatTimeAgo(timestamp: number, _now: number): string {
		const seconds = Math.floor((_now - timestamp) / 1000);
		if (seconds < 0) return 'just now';
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	}

	// Stable status message - only changes when peer count or uptime threshold changes
	const statusMessage = derived(
		[isConnected, peerCount, uptimeMinutes],
		([$connected, $peers, $uptime]) => {
			if (!$connected) return 'Not connected to node';

			if ($peers === 0) {
				if ($uptime < 1) {
					return 'Starting up, discovering Bitcoin network peers...';
				} else if ($uptime < 3) {
					return 'Performing DNS seed lookups, attempting peer connections...';
				} else {
					return 'Still discovering peers. This can take a few minutes on first run.';
				}
			} else if ($peers < 3) {
				return `Connected to ${$peers} peer${$peers > 1 ? 's' : ''}, establishing more connections...`;
			} else {
				return `Observing Bitcoin network through ${$peers} peers`;
			}
		}
	);

	/**
	 * Single heartbeat function - polls all data in one batch request
	 * This is the ONLY place that makes RPC calls, maintaining simplicity.
	 * Uses a single HTTP request with 3 RPC calls batched together.
	 */
	async function heartbeat() {
		try {
			// Fetch all observer data in a single batch RPC request
			// This replaces 3 separate HTTP requests with 1 batch request
			const { stats, blocks: blocksData, txs: txsData } = await getObserverDataBatch();

			// Update connection store with fresh stats
			// This is more direct than calling connection.updateStats()
			connection.updateStatsFromBatch(stats);

			// Process blocks
			const newBlocks = blocksData.blocks;
			const reversedBlocks = [...newBlocks].reverse();

			// Update blocks if the newest block changed or count changed
			const newestBlockChanged = reversedBlocks.length > 0 &&
				(blocks.length === 0 || reversedBlocks[0].hash !== blocks[0].hash);
			if (newestBlockChanged || reversedBlocks.length !== blocks.length) {
				blocks = reversedBlocks;
			}

			// Process transactions
			const newTxs = txsData.transactions;
			const reversedTxs = [...newTxs].reverse();

			// Update transactions if the newest tx changed or count changed
			const newestTxChanged = reversedTxs.length > 0 &&
				(transactions.length === 0 || reversedTxs[0].txid !== transactions[0].txid);
			if (newestTxChanged || reversedTxs.length !== transactions.length) {
				transactions = reversedTxs;
			}
		} catch (error) {
			console.error('Heartbeat failed:', error);
		}
	}

	onMount(() => {
		// Stop the connection store's automatic health check
		// The observer page takes over with its single heartbeat
		connection.stopAutoHealthCheck();

		// Initial heartbeat
		heartbeat();

		// Single heartbeat every 1.618 seconds (golden ratio)
		// This is the ONLY timer making RPC calls
		pollInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

		// Update reactive time every second for "X ago" timestamps (UI only)
		timeInterval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
		if (timeInterval) clearInterval(timeInterval);

		// Resume automatic health checking when leaving observer page
		connection.connect();
	});
</script>

<style>
	/* Prevent layout shift during updates */
	.stat-value {
		min-height: 2rem;
		min-width: 3rem;
		display: inline-block;
	}

	/* Force GPU compositing to prevent repaints */
	:global(body) {
		transform: translateZ(0);
		-webkit-font-smoothing: subpixel-antialiased;
	}
</style>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-light text-white">Observer Mode</h1>
			<p class="text-gray-400 mt-1">Watch the Bitcoin network breathe</p>
		</div>

		<div>
			{#if $connectionStatus === 'connected'}
				<Badge variant="success">Connected</Badge>
			{:else if $connectionStatus === 'connecting'}
				<Badge variant="warning">Connecting...</Badge>
			{:else if $connectionStatus === 'error'}
				<Badge variant="error">Disconnected</Badge>
			{:else}
				<Badge variant="default">Offline</Badge>
			{/if}
		</div>
	</div>

	<!-- Status Message -->
	{#if $isConnected}
		<div class="bg-echo-bg-secondary border border-echo-border rounded px-4 py-3">
			<div class="flex items-center gap-3">
				{#if $peerCount === 0}
					<Spinner size="sm" />
				{:else}
					<div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
				{/if}
				<p class="text-sm text-echo-muted font-mono">{$statusMessage}</p>
			</div>
		</div>
	{/if}

	<!-- Stats Overview -->
	{#if !$isConnected}
		<div class="flex items-center justify-center p-12">
			<Spinner size="md" />
			<span class="ml-3 text-gray-400">Connecting to observer node...</span>
		</div>
	{/if}

	{#if $isConnected}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4" style="contain: layout;">
			<Card>
				<div class="text-sm text-gray-400 mb-1">Uptime</div>
				<div class="stat-value text-2xl font-light text-white">
					{$uptimeMinutes}m
				</div>
			</Card>

			<Card>
				<div class="text-sm text-gray-400 mb-1">Peers</div>
				<div class="stat-value text-2xl font-light text-white">
					{$peerCount}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-gray-400 mb-1">Blocks Seen</div>
				<div class="stat-value text-2xl font-light text-white">
					{blocks.length}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-gray-400 mb-1">INV Messages</div>
				<div class="stat-value text-2xl font-light text-white">
					{$invCount}
				</div>
			</Card>
		</div>
	{/if}

	<!-- Two-column layout: Blocks and Transactions -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Live Block Feed -->
		<Card>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-light text-white">Live Block Feed</h2>
				<div class="flex items-center space-x-2">
					<div class="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
					<span class="text-sm text-gray-400">Live</span>
				</div>
			</div>

			{#if blocks.length > 0}
				<div class="space-y-3 max-h-[600px] overflow-y-auto">
					{#each blocks as block (block.hash)}
						<div
							class="p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
						>
							<div class="mb-2">
								<Hash value={block.hash} truncate={true} copyable={true} explorerUrl={`https://mempool.space/block/${block.hash}`} expand={true} />
							</div>
							<div class="flex items-center justify-between text-xs">
								<span class="text-gray-400">Announced by {block.peer_count} peer{block.peer_count !== 1 ? 's' : ''}</span>
								<span class="text-gray-500">{formatTimeAgo(block.first_seen, now)}</span>
							</div>
						</div>
					{/each}
				</div>
			{:else if $isConnected}
				<div class="text-center py-12 text-gray-500">
					<p>Waiting for block announcements...</p>
					<p class="text-sm mt-2">Once peers connect, blocks will appear here in real-time</p>
				</div>
			{:else}
				<div class="text-center py-12 text-gray-500">
					<p>Node not connected</p>
				</div>
			{/if}
		</Card>

		<!-- Live Transaction Feed -->
		<Card>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-light text-white">Live Transaction Feed</h2>
				<div class="flex items-center space-x-2">
					<div class="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
					<span class="text-sm text-gray-400">Live</span>
				</div>
			</div>

			{#if transactions.length > 0}
				<div class="space-y-2 max-h-[600px] overflow-y-auto">
					{#each transactions as tx (tx.txid)}
						<div
							class="p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
						>
							<Hash value={tx.txid} truncate={true} copyable={true} explorerUrl={`https://mempool.space/tx/${tx.txid}`} expand={true} />
						</div>
					{/each}
				</div>
			{:else if $isConnected}
				<div class="text-center py-12 text-gray-500">
					<p>Waiting for transaction announcements...</p>
					<p class="text-sm mt-2">Live mempool activity will stream here</p>
				</div>
			{:else}
				<div class="text-center py-12 text-gray-500">
					<p>Node not connected</p>
				</div>
			{/if}
		</Card>
	</div>

	<!-- Message Statistics (if connected) -->
	{#if $isConnected}
		<Card>
			<h2 class="text-xl font-light text-white mb-4">Protocol Messages</h2>
			<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
				<div>
					<div class="text-xs text-gray-500">VERSION</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.version ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">VERACK</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.verack ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">PING</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.ping ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">PONG</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.pong ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">ADDR</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.addr ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">INV</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.inv ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">HEADERS</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.headers ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">BLOCK</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.block ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">TX</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.tx ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">GETBLOCKS</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.getblocks ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">GETHEADERS</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.getheaders ?? 0}</div>
				</div>
				<div>
					<div class="text-xs text-gray-500">OTHER</div>
					<div class="text-lg text-white">{$observerStats?.messages_received.other ?? 0}</div>
				</div>
			</div>
		</Card>
	{/if}
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getBlockchainInfo } from '$lib/rpc/client';
	import { connection, blockHeight, networkHashrate } from '$lib/stores/connection';
	import { detectedMode, MODE_LABELS } from '$lib/stores/nodeMode';
	import Card from '$lib/components/Card.svelte';
	import Hash from '$lib/components/Hash.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import type { BlockchainInfo } from '$lib/rpc/types';

	// Sync state
	let chainInfo = $state<BlockchainInfo | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	// Session tracking
	let sessionStartTime = $state(Date.now());
	let sessionStartBlocks = $state(0);
	let hasSessionStart = $state(false);

	// Performance tracking
	let blocksPerSecond = $state(0);
	let lastBlockHeight = $state(0);
	let lastUpdateTime = $state(Date.now());

	// Polling
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let now = $state(Date.now());
	let isFetching = $state(false); // Prevent overlapping requests

	/**
	 * Poll interval (3 seconds for sync progress)
	 * Longer than timeout to prevent request pileup
	 */
	const POLL_INTERVAL = 3000;

	/**
	 * Backoff interval when disconnected (10 seconds)
	 */
	const ERROR_BACKOFF_INTERVAL = 10000;

	/**
	 * Bitcoin genesis date (January 3, 2009)
	 */
	const GENESIS_DATE = new Date('2009-01-03T18:15:05Z');

	/**
	 * Estimate block date from height
	 * Rough approximation: 10 minutes per block average
	 */
	function estimateBlockDate(height: number): Date {
		const msPerBlock = 10 * 60 * 1000; // 10 minutes
		return new Date(GENESIS_DATE.getTime() + height * msPerBlock);
	}

	/**
	 * Format date for display
	 */
	function formatDate(date: Date): string {
		return date.toLocaleDateString(undefined, {
			month: 'short',
			year: 'numeric'
		});
	}

	/**
	 * Format number with commas
	 */
	function formatNumber(n: number): string {
		return n.toLocaleString();
	}

	/**
	 * Format bytes to human readable
	 */
	function formatBytes(bytes: number): string {
		if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
		if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
		if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
		if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
		return bytes + ' B';
	}

	/**
	 * Format duration for display
	 */
	function formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	}

	/**
	 * Format ETA
	 */
	function formatETA(blocksRemaining: number, blocksPerSec: number): string {
		if (blocksPerSec <= 0) return 'Calculating...';
		const secondsRemaining = blocksRemaining / blocksPerSec;
		return formatDuration(secondsRemaining * 1000);
	}

	/**
	 * Calculate progress percentage
	 */
	function calcProgress(validated: number, network: number): number {
		if (network <= 0) return 0;
		return Math.min((validated / network) * 100, 100);
	}

	/**
	 * Fetch blockchain info
	 * Returns true if successful, false if error (for backoff logic)
	 */
	async function fetchChainInfo(): Promise<boolean> {
		// Prevent overlapping requests
		if (isFetching) return !error;
		isFetching = true;

		try {
			const config = connection.getConfig();
			const info = await getBlockchainInfo({ endpoint: config.endpoint, timeout: config.timeout });

			// Track session start
			if (!hasSessionStart && info.blocks > 0) {
				sessionStartBlocks = info.blocks;
				sessionStartTime = Date.now();
				hasSessionStart = true;
				lastBlockHeight = info.blocks;
				lastUpdateTime = Date.now();
			}

			// Calculate blocks per second
			if (lastBlockHeight > 0 && info.blocks > lastBlockHeight) {
				const blocksDelta = info.blocks - lastBlockHeight;
				const timeDelta = (Date.now() - lastUpdateTime) / 1000;
				if (timeDelta > 0) {
					// Exponential moving average for smoother display
					const instantRate = blocksDelta / timeDelta;
					blocksPerSecond = blocksPerSecond === 0
						? instantRate
						: blocksPerSecond * 0.7 + instantRate * 0.3;
				}
			}

			lastBlockHeight = info.blocks;
			lastUpdateTime = Date.now();
			chainInfo = info;
			error = null;
			loading = false;
			isFetching = false;
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			loading = false;
			isFetching = false;
			return false;
		}
	}

	// Computed values
	const networkHeight = $derived($blockHeight || 0);
	const validatedHeight = $derived(chainInfo?.blocks || 0);
	const blocksRemaining = $derived(Math.max(0, networkHeight - validatedHeight));
	const syncProgress = $derived(calcProgress(validatedHeight, networkHeight));
	const progressBarWidth = $derived(`${syncProgress}%`);
	const sessionDuration = $derived(now - sessionStartTime);
	const blocksThisSession = $derived(validatedHeight - sessionStartBlocks);
	const estimatedDate = $derived(estimateBlockDate(validatedHeight));
	// Smarter sync detection: don't trust initialblockdownload alone
	// If we have 0 validated blocks but network has blocks, we're clearly not synced
	const isSynced = $derived(() => {
		if (!chainInfo) return false;
		// If node says we're in IBD, trust that
		if (chainInfo.initialblockdownload) return false;
		// If we have no validated blocks but network has blocks, we're not synced
		if (validatedHeight === 0 && networkHeight > 0) return false;
		// If we're more than 10 blocks behind, we're not synced
		if (blocksRemaining > 10) return false;
		// Otherwise trust the node
		return true;
	});

	// Mode display (detected from node)
	const modeLabel = $derived(MODE_LABELS[$detectedMode] || 'Syncing');

	onMount(() => {
		// Initial fetch
		fetchChainInfo();
		// Also fetch external data (block height, hashrate)
		connection.fetchExternalData();

		// Smart polling with backoff on errors
		let currentInterval = POLL_INTERVAL;

		const poll = async () => {
			const success = await fetchChainInfo();
			// Use longer interval when disconnected to avoid flooding
			currentInterval = success ? POLL_INTERVAL : ERROR_BACKOFF_INTERVAL;
			pollInterval = setTimeout(poll, currentInterval);
		};

		// Start polling after initial delay
		pollInterval = setTimeout(poll, POLL_INTERVAL);

		// Fetch external data less frequently (every 30s)
		const externalPoll = setInterval(() => {
			connection.fetchExternalData();
		}, 30000);

		// Update time for durations
		timeInterval = setInterval(() => {
			now = Date.now();
		}, 1000);

		// Cleanup function needs to handle both interval types
		return () => {
			if (pollInterval) clearTimeout(pollInterval);
			clearInterval(externalPoll);
			if (timeInterval) clearInterval(timeInterval);
		};
	});

	// Note: Cleanup is handled by onMount return function
	// onDestroy kept as backup for edge cases
	onDestroy(() => {
		if (pollInterval) {
			clearTimeout(pollInterval);
			clearInterval(pollInterval);
		}
		if (timeInterval) clearInterval(timeInterval);
	});
</script>

<style>
	/* Progress bar animation */
	.progress-fill {
		transition: width 0.5s ease-out;
	}

	/* Timeline markers */
	.timeline-marker {
		position: absolute;
		bottom: -1.5rem;
		transform: translateX(-50%);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	/* Stat value stability */
	.stat-value {
		min-height: 2rem;
		min-width: 3rem;
		display: inline-block;
	}
</style>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between flex-wrap gap-4">
		<div>
			<h1 class="text-3xl font-light text-echo-text">Your Validation Journey</h1>
			<p class="text-echo-muted mt-1">Independently verifying every transaction since 2009</p>
		</div>

		<div class="flex items-center gap-3">
			{#if loading}
				<Badge variant="warning">Connecting...</Badge>
			{:else if error}
				<Badge variant="error">Disconnected</Badge>
			{:else if isSynced()}
				<Badge variant="success">Synced</Badge>
			{:else}
				<Badge variant="warning">Syncing {syncProgress.toFixed(1)}%</Badge>
			{/if}
			<span class="text-xs text-echo-dim font-mono">{modeLabel}</span>
		</div>
	</div>

	<!-- Error state -->
	{#if error}
		<Card>
			<div class="text-center py-8">
				<p class="text-echo-text mb-2">Unable to connect to node</p>
				<p class="text-sm text-echo-muted">{error}</p>
				<p class="text-xs text-echo-dim mt-4">Make sure the Bitcoin Echo node is running</p>
			</div>
		</Card>
	{:else if loading}
		<div class="flex items-center justify-center py-16">
			<Spinner size="md" />
			<span class="ml-3 text-echo-muted">Connecting to node...</span>
		</div>
	{:else}
		<!-- Timeline Progress Bar -->
		<Card>
			<div class="mb-8">
				<div class="flex justify-between items-baseline mb-2">
					<span class="text-sm text-echo-muted">Timeline: 2009 to Present</span>
					<span class="text-sm font-mono text-echo-text">
						{formatNumber(validatedHeight)} / {formatNumber(networkHeight)} blocks
					</span>
				</div>

				<!-- Progress bar container -->
				<div class="relative h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
					<!-- Validated progress -->
					<div
						class="progress-fill absolute left-0 top-0 h-full bg-gradient-to-r from-echo-accent to-emerald-500 rounded-full"
						style="width: {progressBarWidth}"
					></div>
				</div>

				<!-- Timeline markers -->
				<div class="relative h-8 mt-1">
					<span class="timeline-marker left-0 text-echo-dim">2009</span>
					<span class="timeline-marker text-echo-dim" style="left: 25%">2013</span>
					<span class="timeline-marker text-echo-dim" style="left: 50%">2017</span>
					<span class="timeline-marker text-echo-dim" style="left: 75%">2021</span>
					<span class="timeline-marker right-0 text-echo-text" style="left: 100%">Now</span>

					<!-- Current position marker -->
					{#if syncProgress > 0 && syncProgress < 100}
						<span
							class="timeline-marker text-echo-accent font-bold"
							style="left: {progressBarWidth}"
						>
							You
						</span>
					{/if}
				</div>
			</div>

			<!-- Current position info -->
			<div class="text-center py-4 border-t border-echo-border">
				<p class="text-echo-muted text-sm">Currently validating blocks from</p>
				<p class="text-2xl font-light text-echo-text mt-1">{formatDate(estimatedDate)}</p>
				<p class="text-xs text-echo-dim mt-1">Block #{formatNumber(validatedHeight)}</p>
			</div>
		</Card>

		<!-- Dual Column: Network vs Local -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Live Network (from mempool.space) -->
			<Card>
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-light text-echo-text">Live Network</h2>
					<span class="text-xs text-echo-dim">via mempool.space</span>
				</div>

				<div class="space-y-4">
					<div class="flex justify-between">
						<span class="text-echo-muted">Block Height</span>
						<span class="font-mono text-echo-text stat-value">{formatNumber(networkHeight)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Hashrate</span>
						<span class="font-mono text-echo-text stat-value">
							{$networkHashrate > 0 ? $networkHashrate.toFixed(2) + ' EH/s' : '...'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Chain</span>
						<span class="font-mono text-echo-text">{chainInfo?.chain || 'main'}net</span>
					</div>
				</div>
			</Card>

			<!-- Your Progress (from local node) -->
			<Card>
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-lg font-light text-echo-text">Your Progress</h2>
					<span class="text-xs text-echo-dim">local validation</span>
				</div>

				<div class="space-y-4">
					<div class="flex justify-between">
						<span class="text-echo-muted">Validated</span>
						<span class="font-mono text-echo-text stat-value">{formatNumber(validatedHeight)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Remaining</span>
						<span class="font-mono text-echo-text stat-value">{formatNumber(blocksRemaining)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Progress</span>
						<span class="font-mono text-echo-text stat-value">{syncProgress.toFixed(2)}%</span>
					</div>
				</div>
			</Card>
		</div>

		<!-- Performance Metrics -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			<Card>
				<div class="text-sm text-echo-muted mb-1">Speed</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{blocksPerSecond > 0 ? blocksPerSecond.toFixed(1) : '...'} <span class="text-sm">blk/s</span>
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">ETA</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{formatETA(blocksRemaining, blocksPerSecond)}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">Session</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{formatDuration(sessionDuration)}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">This Session</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					+{formatNumber(blocksThisSession)} <span class="text-sm">blocks</span>
				</div>
			</Card>
		</div>

		<!-- Storage & Chain Info -->
		<Card>
			<h2 class="text-lg font-light text-echo-text mb-4">Chain Details</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-echo-muted">Best Block</span>
						<Hash
							value={chainInfo?.bestblockhash || ''}
							truncate={true}
							truncateLength={12}
							copyable={true}
						/>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Chain Work</span>
						<Hash
							value={chainInfo?.chainwork || ''}
							truncate={true}
							truncateLength={12}
						/>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Headers</span>
						<span class="font-mono text-echo-text">{formatNumber(chainInfo?.headers || 0)}</span>
					</div>
				</div>

				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-echo-muted">Disk Usage</span>
						<span class="font-mono text-echo-text">{formatBytes(chainInfo?.size_on_disk || 0)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Pruning</span>
						<span class="font-mono text-echo-text">
							{chainInfo?.pruned ? 'Enabled' : 'Disabled'}
						</span>
					</div>
					{#if chainInfo?.pruned && chainInfo.pruneheight !== undefined}
						<div class="flex justify-between">
							<span class="text-echo-muted">Pruned Height</span>
							<span class="font-mono text-echo-text">{formatNumber(chainInfo.pruneheight)}</span>
						</div>
					{/if}
				</div>
			</div>
		</Card>

		<!-- Currently Validating Indicator -->
		{#if !isSynced()}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-echo-accent animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Validating block #{formatNumber(validatedHeight)}...
					</p>
				</div>
			</div>
		{:else}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-emerald-500"></div>
					<p class="text-sm text-echo-text font-mono">
						Fully synced - validating new blocks as they arrive
					</p>
				</div>
			</div>
		{/if}
	{/if}
</div>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSyncDataBatch } from '$lib/rpc/client';
	import { connection, blockHeight, networkHashrate } from '$lib/stores/connection';
	import { detectedMode, MODE_LABELS } from '$lib/stores/nodeMode';
	import {
		sessionHistory,
		isResumeSession,
		lastKnownHeight,
		lastKnownProgress,
		totalSessionCount,
		allSessions,
		syncCompletion
	} from '$lib/stores/sessionHistory';
	import Card from '$lib/components/Card.svelte';
	import Hash from '$lib/components/Hash.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import MilestoneNotification from '$lib/components/MilestoneNotification.svelte';
	import WelcomeBack from '$lib/components/WelcomeBack.svelte';
	import SyncComplete from '$lib/components/SyncComplete.svelte';
	import type { BlockchainInfo, SyncStatus } from '$lib/rpc/types';
	import type { Milestone } from '$lib/data/milestones';
	import {
		getMilestonesBetween,
		getLastPassedMilestone,
		getNextMilestone,
		getMilestoneUrl,
		CATEGORY_INFO
	} from '$lib/data/milestones';

	// View state: 'loading' | 'resume' | 'syncing' | 'complete'
	let viewState = $state<'loading' | 'resume' | 'syncing' | 'complete'>('loading');

	// Track if we've shown the resume overlay this browser session
	const SESSION_KEY_RESUME_SHOWN = 'bitcoin-echo-resume-shown-session';

	// Sync state
	let chainInfo = $state<BlockchainInfo | null>(null);
	let syncStatus = $state<SyncStatus | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	// Session tracking
	let sessionStartTime = $state(Date.now());
	let sessionStartBlocks = $state(0);
	let hasSessionStart = $state(false);
	let sessionTrackerStarted = $state(false);

	// Performance tracking
	let blocksPerSecond = $state(0);
	let lastBlockHeight = $state(0);
	let lastUpdateTime = $state(Date.now());

	// Header sync tracking
	let headersPerSecond = $state(0);
	let lastHeaderCount = $state(0);
	let lastHeaderUpdateTime = $state(Date.now());

	// Observer stats (from batch RPC)
	let peerCount = $state(0);
	let nodeUptime = $state(0);
	let nodeStartHeight = $state(0);

	// Polling
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let now = $state(Date.now());
	let isFetching = $state(false); // Prevent overlapping requests

	// Milestone tracking
	let currentMilestoneNotification = $state<Milestone | null>(null);
	let dismissedMilestones = $state<Set<number>>(new Set());
	let lastMilestoneCheckHeight = $state(0);

	/**
	 * Poll interval - golden ratio (1.618s) matches observer page
	 */
	const POLL_INTERVAL = 1618;

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
	 * Check for milestones passed since last check
	 * Shows notification for the most recently passed milestone
	 */
	function checkMilestones(currentHeight: number): void {
		if (lastMilestoneCheckHeight === 0) {
			// First check — just set the baseline, don't show notifications for past milestones
			lastMilestoneCheckHeight = currentHeight;
			return;
		}

		if (currentHeight <= lastMilestoneCheckHeight) {
			return; // No progress
		}

		// Find milestones passed since last check
		const passedMilestones = getMilestonesBetween(lastMilestoneCheckHeight + 1, currentHeight);

		// Show the most recent milestone that hasn't been dismissed
		for (let i = passedMilestones.length - 1; i >= 0; i--) {
			const milestone = passedMilestones[i];
			if (!dismissedMilestones.has(milestone.height)) {
				currentMilestoneNotification = milestone;
				break;
			}
		}

		lastMilestoneCheckHeight = currentHeight;
	}

	/**
	 * Dismiss the current milestone notification
	 */
	function dismissMilestone(): void {
		if (currentMilestoneNotification) {
			dismissedMilestones = new Set([...dismissedMilestones, currentMilestoneNotification.height]);
			currentMilestoneNotification = null;
		}
	}

	/**
	 * Fetch all sync data in one batch RPC call
	 * Returns true if successful, false if error (for backoff logic)
	 */
	async function fetchChainInfo(): Promise<boolean> {
		// Prevent overlapping requests
		if (isFetching) return !error;
		isFetching = true;

		try {
			const config = connection.getConfig();
			const { chainInfo: info, observerStats, syncStatus: status } = await getSyncDataBatch({
				endpoint: config.endpoint,
				timeout: config.timeout
			});

			// Update observer stats (peer count, uptime, start height)
			peerCount = observerStats.peer_count;
			nodeUptime = observerStats.uptime_seconds;
			nodeStartHeight = observerStats.start_height;

			// Track session start
			if (!hasSessionStart && info.blocks > 0) {
				sessionStartBlocks = info.blocks;
				sessionStartTime = Date.now();
				hasSessionStart = true;
				lastBlockHeight = info.blocks;
				lastUpdateTime = Date.now();
			}

			// Use node's blocks_per_second as the source of truth
			// This replaces the inaccurate client-side EMA calculation
			blocksPerSecond = status.blocks_per_second;

			// Calculate headers per second (for headers-first sync phase)
			if (lastHeaderCount > 0 && info.headers > lastHeaderCount) {
				const headersDelta = info.headers - lastHeaderCount;
				const timeDelta = (Date.now() - lastHeaderUpdateTime) / 1000;
				if (timeDelta > 0) {
					const instantRate = headersDelta / timeDelta;
					headersPerSecond = headersPerSecond === 0
						? instantRate
						: headersPerSecond * 0.7 + instantRate * 0.3;
				}
			}
			lastHeaderCount = info.headers;
			lastHeaderUpdateTime = Date.now();

			lastBlockHeight = info.blocks;
			lastUpdateTime = Date.now();
			chainInfo = info;
			syncStatus = status;
			error = null;
			loading = false;
			isFetching = false;

			// Check for milestones passed
			checkMilestones(info.blocks);

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
	const headerCount = $derived(chainInfo?.headers || 0);
	const blocksRemaining = $derived(Math.max(0, networkHeight - validatedHeight));
	const syncProgress = $derived(calcProgress(validatedHeight, networkHeight));
	const progressBarWidth = $derived(`${syncProgress}%`);
	const sessionDuration = $derived(now - sessionStartTime);
	const blocksThisSession = $derived(validatedHeight - sessionStartBlocks);
	const estimatedDate = $derived(estimateBlockDate(validatedHeight));

	// Headers-first sync phase detection and progress
	const isHeadersPhase = $derived(headerCount > 0 && validatedHeight === 0);
	const headerSyncProgress = $derived(networkHeight > 0 ? (headerCount / networkHeight) * 100 : 0);
	const headersRemaining = $derived(Math.max(0, networkHeight - headerCount));
	const headerProgressBarWidth = $derived(`${Math.min(headerSyncProgress, 100)}%`);
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

	// Track if sync just completed (transition from syncing to synced)
	let wasNotSynced = $state(true);
	let justCompletedSync = $state(false);

	// Get last session date for resume screen
	const lastSessionDate = $derived(() => {
		const sessions = $allSessions;
		if (sessions.length === 0) return null;
		const lastSession = sessions[sessions.length - 1];
		return lastSession.endTime ? new Date(lastSession.endTime) : null;
	});

	/**
	 * Handle continue sync from resume screen
	 */
	function handleContinueSync(): void {
		// Mark resume as shown for this browser session
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(SESSION_KEY_RESUME_SHOWN, 'true');
		}
		viewState = 'syncing';
	}

	/**
	 * Handle observe network instead
	 */
	function handleObserve(): void {
		goto('/observer');
	}

	/**
	 * Handle entering the dashboard after sync complete
	 */
	function handleEnterDashboard(): void {
		// For now, stay on sync page but clear the completion view
		// In the future, this could navigate to a dashboard view
		viewState = 'syncing';
	}

	/**
	 * Start session tracking
	 */
	function startSessionTracking(): void {
		if (sessionTrackerStarted || !chainInfo) return;
		sessionTrackerStarted = true;
		sessionHistory.startSession(chainInfo.blocks, networkHeight);
	}

	/**
	 * Check if we should show resume screen
	 */
	function shouldShowResume(): boolean {
		if (typeof window === 'undefined') return false;

		// Don't show if already dismissed this browser session
		const alreadyShown = sessionStorage.getItem(SESSION_KEY_RESUME_SHOWN) === 'true';
		if (alreadyShown) return false;

		// Show if user has previous sessions
		return $isResumeSession;
	}

	// Mode display (detected from node)
	const modeLabel = $derived(MODE_LABELS[$detectedMode] || 'Syncing');

	// Milestone tracking (derived)
	const lastMilestone = $derived(getLastPassedMilestone(validatedHeight));
	const nextMilestone = $derived(getNextMilestone(validatedHeight));

	onMount(() => {
		// Stop the global health check - this page handles its own polling
		connection.stopAutoHealthCheck();

		// Determine initial view state
		if (shouldShowResume() && !$syncCompletion) {
			viewState = 'resume';
		} else {
			viewState = 'syncing';
		}

		// Initial fetch (gets both blockchain info and observer stats in one batch)
		fetchChainInfo();
		// Also fetch external data (block height, hashrate)
		connection.fetchExternalData();

		// Smart polling with backoff on errors
		let currentInterval = POLL_INTERVAL;

		const poll = async () => {
			// Single batch RPC call gets blockchain info + observer stats
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

			// End session when leaving page
			if (sessionTrackerStarted && chainInfo) {
				sessionHistory.endSession(chainInfo.blocks);
			}

			// Resume global health check when leaving sync page
			connection.resumeAutoHealthCheck();
			connection.connect();
		};
	});

	// Effect: Track session progress and detect sync completion
	$effect(() => {
		if (!chainInfo || loading) return;

		// Start session tracking when we have chain data and are in syncing view
		if (viewState === 'syncing' && !isSynced()) {
			startSessionTracking();
		}

		// Update progress periodically
		if (sessionTrackerStarted && validatedHeight > 0) {
			sessionHistory.updateProgress(validatedHeight, syncProgress);
		}

		// Detect sync completion (transition from not synced to synced)
		if (wasNotSynced && isSynced() && validatedHeight > 0) {
			wasNotSynced = false;
			justCompletedSync = true;

			// Only show completion celebration if not already completed
			if (!$syncCompletion) {
				sessionHistory.markComplete(validatedHeight);
				viewState = 'complete';
			}
		}
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

<!-- View State Routing -->
{#if viewState === 'resume'}
	<WelcomeBack
		lastSessionDate={lastSessionDate()}
		onContinue={handleContinueSync}
		onObserve={handleObserve}
	/>
{:else if viewState === 'complete'}
	<SyncComplete
		bestBlockHash={chainInfo?.bestblockhash || ''}
		chainWork={chainInfo?.chainwork || ''}
		onEnterDashboard={handleEnterDashboard}
	/>
{:else}
	<!-- Main Sync View -->
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
		<!-- Timeline Progress Bar (hidden during headers phase - no blocks validated yet) -->
		{#if !isHeadersPhase}
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
		{/if}

		<!-- Headers-First Sync Phase (shown when downloading headers before blocks) -->
		{#if isHeadersPhase}
			<Card>
				<div class="border-l-4 border-amber-500 pl-4">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
							<h2 class="text-lg font-light text-echo-text">Downloading Headers</h2>
						</div>
						<span class="text-xs text-echo-dim font-mono">Phase 1 of 2</span>
					</div>

					<p class="text-sm text-echo-muted mb-4">
						Bitcoin Echo uses headers-first sync: downloading all block headers before requesting full blocks.
						This allows verification of proof-of-work before committing to download ~600GB of block data.
					</p>

					<!-- Header progress bar -->
					<div class="mb-2">
						<div class="flex justify-between text-sm mb-1">
							<span class="text-echo-muted">Header Progress</span>
							<span class="font-mono text-echo-text">
								{formatNumber(headerCount)} / {formatNumber(networkHeight)}
							</span>
						</div>
						<div class="h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
							<div
								class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
								style="width: {headerProgressBarWidth}"
							></div>
						</div>
					</div>

					<!-- Header stats -->
					<div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-echo-border">
						<div>
							<div class="text-xs text-echo-dim mb-1">Speed</div>
							<div class="font-mono text-echo-text">
								{headersPerSecond > 0 ? Math.round(headersPerSecond).toLocaleString() : '...'} <span class="text-xs text-echo-muted">hdr/s</span>
							</div>
						</div>
						<div>
							<div class="text-xs text-echo-dim mb-1">Remaining</div>
							<div class="font-mono text-echo-text">
								{formatNumber(headersRemaining)}
							</div>
						</div>
						<div>
							<div class="text-xs text-echo-dim mb-1">ETA</div>
							<div class="font-mono text-echo-text">
								{headersPerSecond > 0 ? formatETA(headersRemaining, headersPerSecond) : 'Calculating...'}
							</div>
						</div>
					</div>

					<p class="text-xs text-echo-dim mt-4">
						After headers complete, block download will begin automatically.
					</p>
				</div>
			</Card>
		{/if}

		<!-- Milestone Notification (appears when passing a milestone) -->
		{#if currentMilestoneNotification}
			<MilestoneNotification
				milestone={currentMilestoneNotification}
				onDismiss={dismissMilestone}
			/>
		{/if}

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
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
			<Card>
				<div class="text-sm text-echo-muted mb-1">Speed</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{#if isHeadersPhase || validatedHeight === 0}
						— <span class="text-sm">blk/s</span>
					{:else}
						{blocksPerSecond > 0 ? blocksPerSecond.toFixed(1) : '...'} <span class="text-sm">blk/s</span>
					{/if}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">ETA</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{#if isHeadersPhase || validatedHeight === 0}
						—
					{:else if syncStatus && syncStatus.eta_seconds > 0}
						{formatDuration(syncStatus.eta_seconds * 1000)}
					{:else}
						Calculating...
					{/if}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">Peers</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{peerCount}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">Uptime</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{formatDuration(nodeUptime * 1000)}
				</div>
			</Card>

			<Card>
				<div class="text-sm text-echo-muted mb-1">This Session</div>
				<div class="stat-value text-2xl font-light text-echo-text">
					{#if isHeadersPhase || validatedHeight === 0}
						— <span class="text-sm">blocks</span>
					{:else}
						+{formatNumber(Math.max(0, validatedHeight - nodeStartHeight))} <span class="text-sm">blocks</span>
					{/if}
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
		{#if isHeadersPhase}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Downloading headers... {formatNumber(headerCount)} / {formatNumber(networkHeight)} ({headerSyncProgress.toFixed(1)}%)
					</p>
				</div>
			</div>
		{:else if !isSynced()}
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

		<!-- Milestones Section -->
		{#if lastMilestone || nextMilestone}
			<div class="border-t border-echo-border pt-6">
				<h3 class="text-xs font-mono uppercase tracking-wider text-echo-dim mb-4">
					Milestones
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Last Passed Milestone -->
					{#if lastMilestone}
						{@const categoryInfo = CATEGORY_INFO[lastMilestone.category]}
						<a
							href={getMilestoneUrl(lastMilestone)}
							target="_blank"
							rel="noopener noreferrer"
							class="group block bg-echo-surface/50 border border-echo-border rounded-lg p-4 hover:border-echo-accent/50 transition-colors"
						>
							<div class="flex items-start gap-3">
								{#if lastMilestone.icon}
									<span class="text-xl opacity-60 group-hover:opacity-100 transition-opacity">
										{lastMilestone.icon}
									</span>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs text-echo-dim">Passed</span>
										<span class="text-xs font-mono {categoryInfo.color}">
											#{lastMilestone.height.toLocaleString()}
										</span>
									</div>
									<p class="text-sm text-echo-text font-medium truncate">
										{lastMilestone.title}
									</p>
									<p class="text-xs text-echo-muted mt-0.5">
										{lastMilestone.date}
									</p>
								</div>
								<svg class="h-4 w-4 text-echo-dim opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</div>
						</a>
					{/if}

					<!-- Next Upcoming Milestone -->
					{#if nextMilestone}
						{@const categoryInfo = CATEGORY_INFO[nextMilestone.category]}
						{@const blocksAway = nextMilestone.height - validatedHeight}
						<a
							href={getMilestoneUrl(nextMilestone)}
							target="_blank"
							rel="noopener noreferrer"
							class="group block bg-echo-surface/50 border border-echo-border rounded-lg p-4 hover:border-echo-accent/50 transition-colors"
						>
							<div class="flex items-start gap-3">
								{#if nextMilestone.icon}
									<span class="text-xl opacity-40 group-hover:opacity-80 transition-opacity">
										{nextMilestone.icon}
									</span>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs text-echo-dim">Upcoming</span>
										<span class="text-xs font-mono text-echo-muted">
											{blocksAway.toLocaleString()} blocks
										</span>
									</div>
									<p class="text-sm text-echo-muted font-medium truncate">
										{nextMilestone.title}
									</p>
									<p class="text-xs text-echo-dim mt-0.5">
										Block #{nextMilestone.height.toLocaleString()}
									</p>
								</div>
								<svg class="h-4 w-4 text-echo-dim opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</div>
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
	</div>
{/if}

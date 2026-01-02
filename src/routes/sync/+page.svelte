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
	import type { BlockchainInfo, SyncStatus, SyncMode } from '$lib/rpc/types';
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
	let consecutiveErrors = $state(0); // Track errors for resilience
	const ERROR_THRESHOLD = 3; // Show error UI after 3 consecutive failures

	// Session tracking
	let sessionStartTime = $state(Date.now());
	let sessionStartBlocks = $state(0);
	let hasSessionStart = $state(false);
	let sessionTrackerStarted = $state(false);

	// Decoupled IBD state - current values from RPC
	let blocksDownloaded = $state(0);
	let blocksValidated = $state(0);
	let consecutiveTip = $state(0);
	let downloadRateBps = $state(0);
	let validationRateBps = $state(0);
	let storageUsedBytes = $state(0);
	let storagePruneTarget = $state(0);
	let storageHeadroomLimit = $state(0);
	let currentChunkStart = $state(0);
	let currentChunkEnd = $state(0);
	let isThrottled = $state(false);
	let syncMode = $state<SyncMode>('DOWNLOADING');

	// Tweening - previous values for smooth animation
	let prevBlocksDownloaded = $state(0);
	let prevBlocksValidated = $state(0);
	let prevConsecutiveTip = $state(0);
	let prevDownloadRateBps = $state(0);
	let prevValidationRateBps = $state(0);
	let prevStorageUsedBytes = $state(0);
	let lastRpcUpdate = $state(Date.now());
	let lastBlockHeight = $state(0);
	let lastUpdateTime = $state(Date.now());

	// Header sync tracking
	let headersPerSecond = $state(0);
	let lastHeaderCount = $state(0);
	let lastHeaderUpdateTime = $state(Date.now());

	// Header sync tweening (previous values for smooth animation)
	let prevHeaderCount = $state(0);
	let prevHeadersPerSecond = $state(0);
	let headerEtaSeconds = $state(0); // Last calculated ETA from RPC
	let lastHeaderEtaUpdate = $state(Date.now()); // When we calculated it

	// Block sync ETA tweening (simple tween, not countdown - ETA fluctuates too much)
	let prevBlockEtaSeconds = $state(0);

	// Peer count tweening
	let prevPeerCount = $state(0);

	// Observer stats (from batch RPC)
	let peerCount = $state(0);
	let serverUptime = $state(0); // Last known uptime from node
	let lastUptimeUpdate = $state(Date.now()); // When we received it
	let nodeStartHeight = $state(0);

	// Polling
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let now = $state(Date.now());
	let isFetching = $state(false); // Prevent overlapping requests

	// Smoothly interpolated uptime (increments locally between RPC polls)
	const displayedUptime = $derived(
		serverUptime + Math.floor((now - lastUptimeUpdate) / 1000)
	);

	// Tweening helper - eases between previous and current value over poll interval
	function tweenValue(prev: number, current: number): number {
		const elapsed = now - lastRpcUpdate;
		const progress = Math.min(elapsed / POLL_INTERVAL, 1);
		// Ease-out for smooth feel
		const eased = 1 - Math.pow(1 - progress, 2);
		return Math.round(prev + (current - prev) * eased);
	}

	// Milestone tracking
	let currentMilestoneNotification = $state<Milestone | null>(null);
	let dismissedMilestones = $state<Set<number>>(new Set());
	let lastMilestoneCheckHeight = $state(0);

	/**
	 * Poll interval (5s) - reduced from 1.618s to minimize RPC load during IBD
	 */
	const POLL_INTERVAL = 5000;

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
	 * Format difficulty to human readable (1.5K, 2.3M, 102.5T, etc.)
	 */
	function formatDifficulty(diff: number): string {
		if (diff >= 1e12) return (diff / 1e12).toFixed(2) + ' T';
		if (diff >= 1e9) return (diff / 1e9).toFixed(2) + ' B';
		if (diff >= 1e6) return (diff / 1e6).toFixed(2) + ' M';
		if (diff >= 1e3) return (diff / 1e3).toFixed(2) + ' K';
		return diff.toFixed(2);
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
	 * Format ETA - use "--" for unknown instead of "Calculating..."
	 */
	function formatETA(blocksRemaining: number, blocksPerSec: number): string {
		if (blocksPerSec <= 0) return '--';
		const secondsRemaining = blocksRemaining / blocksPerSec;
		return formatDuration(secondsRemaining * 1000);
	}

	/**
	 * Get mode badge styling based on sync mode
	 */
	function getModeStyle(mode: SyncMode): { color: string; bgColor: string; pulse: boolean } {
		switch (mode) {
			case 'DOWNLOADING':
				return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', pulse: true };
			case 'THROTTLED':
				return { color: 'text-amber-400', bgColor: 'bg-amber-500/20', pulse: false };
			case 'VALIDATING':
				return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', pulse: true };
			case 'FLUSHING':
				return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', pulse: false };
			case 'PRUNING':
				return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', pulse: false };
			case 'DONE':
				return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', pulse: false };
			default:
				return { color: 'text-echo-muted', bgColor: 'bg-echo-surface', pulse: false };
		}
	}

	/**
	 * Get mode description for tooltip/display
	 */
	function getModeDescription(mode: SyncMode): string {
		switch (mode) {
			case 'DOWNLOADING':
				return 'Gathering blocks from the network';
			case 'THROTTLED':
				return 'Waiting for validation to catch up';
			case 'VALIDATING':
				return 'Verifying every transaction';
			case 'FLUSHING':
				return 'Saving progress to disk';
			case 'PRUNING':
				return 'Freeing space for more blocks';
			case 'DONE':
				return 'Fully synced';
			default:
				return '';
		}
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
			prevPeerCount = peerCount; // Store previous for tweening
			peerCount = observerStats.peer_count;
			serverUptime = observerStats.uptime_seconds;
			lastUptimeUpdate = Date.now(); // Reset interpolation reference
			nodeStartHeight = observerStats.start_height;

			// Track session start
			if (!hasSessionStart && info.blocks > 0) {
				sessionStartBlocks = info.blocks;
				sessionStartTime = Date.now();
				hasSessionStart = true;
				lastBlockHeight = info.blocks;
				lastUpdateTime = Date.now();
			}

			// Store previous values for tweening before updating
			prevBlocksDownloaded = blocksDownloaded;
			prevBlocksValidated = blocksValidated;
			prevConsecutiveTip = consecutiveTip;
			prevDownloadRateBps = downloadRateBps;
			prevValidationRateBps = validationRateBps;
			prevStorageUsedBytes = storageUsedBytes;

			// Update decoupled IBD state from RPC
			blocksDownloaded = status.blocks_downloaded ?? 0;
			blocksValidated = status.blocks_validated ?? 0;
			consecutiveTip = status.consecutive_tip ?? 0;
			downloadRateBps = status.download_rate_bps ?? 0;
			validationRateBps = status.validation_rate_bps ?? 0;
			storageUsedBytes = status.storage_used_bytes ?? 0;
			storagePruneTarget = status.storage_prune_target ?? 0;
			storageHeadroomLimit = status.storage_headroom_limit ?? 0;
			currentChunkStart = status.current_chunk_start ?? 0;
			currentChunkEnd = status.current_chunk_end ?? 0;
			isThrottled = status.is_throttled ?? false;
			syncMode = status.mode ?? 'DOWNLOADING';
			lastRpcUpdate = Date.now();

			// Store previous header values for tweening before updating
			prevHeaderCount = lastHeaderCount;
			prevHeadersPerSecond = headersPerSecond;

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

			// Calculate header sync ETA for countdown display
			const currentHeadersRemaining = ($blockHeight || 0) - info.headers;
			if (headersPerSecond > 0 && currentHeadersRemaining > 0) {
				headerEtaSeconds = Math.round(currentHeadersRemaining / headersPerSecond);
				lastHeaderEtaUpdate = Date.now();
			}

			lastBlockHeight = info.blocks;
			lastUpdateTime = Date.now();

			// Store previous block ETA for simple tweening (not countdown - ETA fluctuates too much)
			prevBlockEtaSeconds = syncStatus?.eta_seconds ?? 0;

			chainInfo = info;
			syncStatus = status;

			error = null;
			consecutiveErrors = 0; // Reset on success
			loading = false;
			isFetching = false;

			// Check for milestones passed
			checkMilestones(info.blocks);

			return true;
		} catch (e) {
			consecutiveErrors++;
			// Only show error UI after ERROR_THRESHOLD consecutive failures
			// This prevents brief network blips from disrupting the view
			if (consecutiveErrors >= ERROR_THRESHOLD) {
				error = e instanceof Error ? e.message : 'Unknown error';
			}
			loading = false;
			isFetching = false;
			return false;
		}
	}

	// Computed values
	const networkHeight = $derived($blockHeight || 0);
	const validatedHeight = $derived(chainInfo?.blocks || 0);
	const headerCount = $derived(chainInfo?.headers || 0);
	const validationBuffer = $derived(Math.max(0, blocksDownloaded - blocksValidated)); // The gap is a feature!
	const blocksRemaining = $derived(Math.max(0, networkHeight - blocksDownloaded));
	const downloadProgress = $derived(calcProgress(blocksDownloaded, networkHeight)); // Downloads (ahead of validation)
	const validationProgress = $derived(calcProgress(blocksValidated, networkHeight)); // True sync progress
	const progressBarWidth = $derived(`${validationProgress}%`); // Use validation for main progress bar
	const sessionDuration = $derived(now - sessionStartTime);
	const blocksThisSession = $derived(blocksValidated - sessionStartBlocks);
	const estimatedDate = $derived(estimateBlockDate(blocksValidated));
	const isPrunedNode = $derived(storagePruneTarget > 0);
	const storagePercentage = $derived(
		storagePruneTarget > 0 ? (storageUsedBytes / storagePruneTarget) * 100 : 0
	);

	// Tweened display values (smooth animation between RPC updates)
	const displayedDownloaded = $derived(tweenValue(prevBlocksDownloaded, blocksDownloaded));
	const displayedValidated = $derived(tweenValue(prevBlocksValidated, blocksValidated));
	const displayedConsecutiveTip = $derived(tweenValue(prevConsecutiveTip, consecutiveTip));
	const displayedDownloadRate = $derived(tweenValue(prevDownloadRateBps, Math.round(downloadRateBps * 10)) / 10);
	const displayedValidationRate = $derived(tweenValue(prevValidationRateBps, Math.round(validationRateBps * 10)) / 10);
	const displayedStorageUsed = $derived(tweenValue(prevStorageUsedBytes, storageUsedBytes));
	const displayedValidationBuffer = $derived(Math.max(0, displayedDownloaded - displayedValidated));

	// Tweened progress bars (smooth animation)
	const displayedDownloadProgress = $derived(networkHeight > 0 ? (displayedDownloaded / networkHeight) * 100 : 0);
	const displayedDownloadProgressBarWidth = $derived(`${Math.min(displayedDownloadProgress, 100)}%`);
	const displayedBlocksProgress = $derived(networkHeight > 0 ? (displayedValidated / networkHeight) * 100 : 0);
	const displayedBlocksProgressBarWidth = $derived(`${Math.min(displayedBlocksProgress, 100)}%`);

	// Header sync tweened display values
	const displayedHeaderCount = $derived(tweenValue(prevHeaderCount, headerCount));
	const displayedHeadersPerSecond = $derived(tweenValue(prevHeadersPerSecond, Math.round(headersPerSecond)));
	const displayedHeadersRemaining = $derived(Math.max(0, networkHeight - displayedHeaderCount));
	// Header ETA counts down between polls (opposite of uptime counting up)
	const displayedHeaderEta = $derived(
		Math.max(0, headerEtaSeconds - Math.floor((now - lastHeaderEtaUpdate) / 1000))
	);
	// Tweened header progress bar (uses displayedHeaderCount for smooth animation)
	const displayedHeaderProgress = $derived(networkHeight > 0 ? (displayedHeaderCount / networkHeight) * 100 : 0);
	const displayedHeaderProgressBarWidth = $derived(`${Math.min(displayedHeaderProgress, 100)}%`);

	// Block ETA tweened value (simple tween, not countdown - ETA fluctuates too much)
	const currentBlockEta = $derived(syncStatus?.eta_seconds ?? 0);
	const displayedBlockEta = $derived(tweenValue(prevBlockEtaSeconds, currentBlockEta));

	// Peer count tweened value
	const displayedPeerCount = $derived(tweenValue(prevPeerCount, peerCount));

	// Headers-first sync phase detection and progress
	const isHeadersPhase = $derived(headerCount > 0 && blocksValidated === 0 && blocksDownloaded === 0);
	const headerSyncProgress = $derived(networkHeight > 0 ? (headerCount / networkHeight) * 100 : 0);
	const headersRemaining = $derived(Math.max(0, networkHeight - headerCount));
	const headerProgressBarWidth = $derived(`${Math.min(headerSyncProgress, 100)}%`);
	// Smarter sync detection: don't trust initialblockdownload alone
	// If we have 0 validated blocks but network has blocks, we're clearly not synced
	const isSynced = $derived(() => {
		if (!chainInfo) return false;
		// If sync mode says DONE, we're synced
		if (syncMode === 'DONE') return true;
		// If node says we're in IBD, trust that
		if (chainInfo.initialblockdownload) return false;
		// If we have no validated blocks but network has blocks, we're not synced
		if (blocksValidated === 0 && networkHeight > 0) return false;
		// If we're more than 10 blocks behind on validation, we're not synced
		if (networkHeight - blocksValidated > 10) return false;
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

		// Update time for durations and smooth animations (250ms for 20 tween steps per RPC poll)
		timeInterval = setInterval(() => {
			now = Date.now();
		}, 250);

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
			sessionHistory.updateProgress(validatedHeight, validationProgress);
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
					<Badge variant="warning">Syncing {validationProgress.toFixed(1)}%</Badge>
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
		<!-- Dual Progress Bars (hidden during headers phase - no blocks yet) -->
		{#if !isHeadersPhase}
		{@const modeStyle = getModeStyle(syncMode)}
		<Card>
			<!-- Mode badge and header -->
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-full {modeStyle.bgColor}">
						<div class="w-2 h-2 rounded-full {modeStyle.color.replace('text-', 'bg-')} {modeStyle.pulse ? 'animate-pulse' : ''}"></div>
						<span class="text-sm font-medium {modeStyle.color}">{syncMode}</span>
					</div>
					<span class="text-xs text-echo-dim">{getModeDescription(syncMode)}</span>
				</div>
				{#if isThrottled}
					<span class="text-xs text-amber-400 font-mono">Downloads paused</span>
				{/if}
			</div>

			<!-- Dual progress bars section -->
			<div class="space-y-4 mb-6">
				<!-- Downloaded progress (blue) -->
				<div>
					<div class="flex justify-between items-baseline mb-1.5">
						<span class="text-sm text-blue-400 font-medium">Downloaded</span>
						<span class="text-sm font-mono text-echo-text">
							{formatNumber(displayedDownloaded)} / {formatNumber(networkHeight)} <span class="text-echo-dim">({displayedDownloadProgress.toFixed(1)}%)</span>
						</span>
					</div>
					<div class="relative h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
						<div
							class="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
							style="width: {displayedDownloadProgressBarWidth}"
						></div>
					</div>
				</div>

				<!-- Validated progress (green) -->
				<div>
					<div class="flex justify-between items-baseline mb-1.5">
						<span class="text-sm text-emerald-400 font-medium">Validated</span>
						<span class="text-sm font-mono text-echo-text">
							{formatNumber(displayedValidated)} / {formatNumber(networkHeight)} <span class="text-echo-dim">({displayedBlocksProgress.toFixed(1)}%)</span>
						</span>
					</div>
					<div class="relative h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
						<div
							class="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-300"
							style="width: {displayedBlocksProgressBarWidth}"
						></div>
					</div>
				</div>
			</div>

			<!-- Timeline markers -->
			<div class="relative h-8 mb-4">
				<span class="timeline-marker left-0 text-echo-dim">2009</span>
				<span class="timeline-marker text-echo-dim" style="left: 25%">2013</span>
				<span class="timeline-marker text-echo-dim" style="left: 50%">2017</span>
				<span class="timeline-marker text-echo-dim" style="left: 75%">2021</span>
				<span class="timeline-marker right-0 text-echo-text" style="left: 100%">Now</span>

				<!-- Current position marker (validation position) -->
				{#if validationProgress > 0 && validationProgress < 100}
					<span
						class="timeline-marker text-emerald-400 font-bold"
						style="left: {progressBarWidth}"
					>
						You
					</span>
				{/if}
			</div>

			<!-- Stats grid - row 1: block counts and rates -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-echo-border">
				<div class="text-center">
					<div class="text-xs text-blue-400 mb-1">Downloaded</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(displayedDownloaded)}</div>
					<div class="text-xs text-echo-muted">{formatNumber(blocksRemaining)} to go</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-emerald-400 mb-1">Validated</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(displayedValidated)}</div>
					<div class="text-xs text-echo-muted">{formatDate(estimatedDate)}</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-blue-400 mb-1">Download Rate</div>
					<div class="text-xl font-light text-blue-400">
						{displayedDownloadRate > 0 ? displayedDownloadRate.toFixed(1) : '--'}
					</div>
					<div class="text-xs text-echo-muted">blk/s</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-emerald-400 mb-1">Validation Rate</div>
					<div class="text-xl font-light text-emerald-400">
						{displayedValidationRate > 0 ? displayedValidationRate.toFixed(1) : '--'}
					</div>
					<div class="text-xs text-echo-muted">{syncMode === 'VALIDATING' ? 'blk/s' : 'idle'}</div>
				</div>
			</div>

			<!-- Stats grid - row 2: buffer, ETA, peers, storage -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-echo-border">
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">Validation Buffer</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(displayedValidationBuffer)}</div>
					<div class="text-xs text-echo-muted">blocks ready</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">ETA</div>
					<div class="text-xl font-light text-echo-text">
						{#if displayedBlockEta > 0}
							{formatDuration(displayedBlockEta * 1000)}
						{:else}
							--
						{/if}
					</div>
					<div class="text-xs text-echo-muted">{validationProgress.toFixed(1)}% complete</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">Peers</div>
					<div class="text-xl font-light text-echo-text">{displayedPeerCount}</div>
					<div class="text-xs text-echo-muted">{syncStatus?.active_sync_peers ?? 0} syncing</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">Disk Usage</div>
					{#if isPrunedNode}
						<div class="text-xl font-light text-echo-text">{formatBytes(displayedStorageUsed)}</div>
						<div class="text-xs text-echo-muted">/ {formatBytes(storagePruneTarget)}</div>
						<!-- Mini storage bar -->
						<div class="mt-1 h-1 bg-echo-surface rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-300 {storagePercentage > 90 ? 'bg-amber-500' : 'bg-echo-accent'}"
								style="width: {Math.min(storagePercentage, 100)}%"
							></div>
						</div>
					{:else}
						<div class="text-xl font-light text-echo-text">{formatBytes(displayedStorageUsed)}</div>
						<div class="text-xs text-echo-muted">archival</div>
					{/if}
				</div>
			</div>

			<!-- Uptime row -->
			<div class="flex justify-center pt-4 mt-4 border-t border-echo-border">
				<div class="text-center">
					<span class="text-xs text-echo-dim">Node uptime:</span>
					<span class="text-sm font-mono text-echo-text ml-2">{formatDuration(displayedUptime * 1000)}</span>
				</div>
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
								{formatNumber(displayedHeaderCount)} / {formatNumber(networkHeight)}
							</span>
						</div>
						<div class="h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
							<div
								class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
								style="width: {displayedHeaderProgressBarWidth}"
							></div>
						</div>
					</div>

					<!-- Header stats -->
					<div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-echo-border">
						<div>
							<div class="text-xs text-echo-dim mb-1">Speed</div>
							<div class="font-mono text-echo-text">
								{displayedHeadersPerSecond > 0 ? displayedHeadersPerSecond.toLocaleString() : '...'} <span class="text-xs text-echo-muted">hdr/s</span>
							</div>
						</div>
						<div>
							<div class="text-xs text-echo-dim mb-1">Remaining</div>
							<div class="font-mono text-echo-text">
								{formatNumber(displayedHeadersRemaining)}
							</div>
						</div>
						<div>
							<div class="text-xs text-echo-dim mb-1">ETA</div>
							<div class="font-mono text-echo-text">
								{displayedHeaderEta > 0 ? formatDuration(displayedHeaderEta * 1000) : '--'}
							</div>
						</div>
					</div>

					<p class="text-xs text-echo-dim mt-4">
						After headers complete, block download will begin automatically.
					</p>
				</div>

				<!-- Stats grid during headers phase - show peers/uptime, emdash for block metrics -->
				<div class="grid grid-cols-3 md:grid-cols-6 gap-4 pt-4 mt-4 border-t border-echo-border">
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Downloaded</div>
						<div class="text-xl font-light text-echo-text">—</div>
						<div class="text-xs text-echo-muted">waiting</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Validated</div>
						<div class="text-xl font-light text-echo-text">—</div>
						<div class="text-xs text-echo-muted">waiting</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Pending</div>
						<div class="text-xl font-light text-echo-text">—</div>
						<div class="text-xs text-echo-muted">waiting</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">ETA</div>
						<div class="text-xl font-light text-echo-text">—</div>
						<div class="text-xs text-echo-muted">phase 2</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Peers</div>
						<div class="text-xl font-light text-echo-text">{displayedPeerCount}</div>
						<div class="text-xs text-echo-muted">connected</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Uptime</div>
						<div class="text-xl font-light text-echo-text">{formatDuration(displayedUptime * 1000)}</div>
						<div class="text-xs text-echo-muted">node running</div>
					</div>
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

		<!-- Chain Details (collapsible) -->
		<Card>
			<h2 class="text-lg font-light text-echo-text mb-4">Chain Details</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-echo-muted">Network Height</span>
						<span class="font-mono text-echo-text">{formatNumber(displayedHeaderCount)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-echo-muted">Best Block Difficulty</span>
						<span class="font-mono text-echo-text">{formatDifficulty(chainInfo?.difficulty || 0)}</span>
					</div>
					<div class="flex justify-between items-center gap-4">
						<span class="text-echo-muted flex-shrink-0">Best Block</span>
						<Hash
							value={chainInfo?.bestblockhash || ''}
							expand={true}
							copyable={true}
							explorerUrl={chainInfo?.bestblockhash ? `https://mempool.space/block/${chainInfo.bestblockhash}` : undefined}
						/>
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

		<!-- Current Activity Indicator -->
		{#if isHeadersPhase}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Downloading headers... {formatNumber(displayedHeaderCount)} / {formatNumber(networkHeight)} ({displayedHeaderProgress.toFixed(1)}%)
					</p>
				</div>
			</div>
		{:else if syncMode === 'DONE' || isSynced()}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-emerald-500"></div>
					<p class="text-sm text-echo-text font-mono">
						Fully synced - validating new blocks as they arrive
					</p>
				</div>
			</div>
		{:else if syncMode === 'DOWNLOADING'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Downloading blocks... {formatNumber(displayedDownloaded)} received, {formatNumber(blocksRemaining)} to go
					</p>
				</div>
			</div>
		{:else if syncMode === 'VALIDATING'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Validating blocks {formatNumber(currentChunkStart)} - {formatNumber(currentChunkEnd)}...
					</p>
				</div>
			</div>
		{:else if syncMode === 'THROTTLED'}
			<div class="bg-echo-surface border border-amber-500/50 rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-amber-500"></div>
					<p class="text-sm text-amber-400 font-mono">
						Downloads paused - waiting for validation to free disk space
					</p>
				</div>
			</div>
		{:else if syncMode === 'PRUNING'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Pruning old blocks to free disk space...
					</p>
				</div>
			</div>
		{:else if syncMode === 'FLUSHING'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Flushing UTXO changes to disk...
					</p>
				</div>
			</div>
		{:else}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-echo-accent animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Syncing... {formatNumber(displayedValidated)} blocks validated
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

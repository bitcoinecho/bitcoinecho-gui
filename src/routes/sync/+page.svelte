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
	let consecutiveErrors = $state(0);
	const ERROR_THRESHOLD = 3;

	// Session tracking
	let sessionStartTime = $state(Date.now());
	let sessionStartBlocks = $state(0);
	let hasSessionStart = $state(false);
	let sessionTrackerStarted = $state(false);

	// Batch IBD state - current values from RPC
	let syncMode = $state<SyncMode>('IDLE');
	let blocksDownloaded = $state(0);
	let blocksValidated = $state(0);
	let downloadRateBps = $state(0);
	let validationRateBps = $state(0);
	let storageUsedBytes = $state(0);
	let storagePruneTarget = $state(0);

	// Tweening - previous values for smooth animation
	let prevBlocksDownloaded = $state(0);
	let prevBlocksValidated = $state(0);
	let prevDownloadRateBps = $state(0);
	let prevValidationRateBps = $state(0);
	let prevStorageUsedBytes = $state(0);
	let lastRpcUpdate = $state(Date.now());

	// Header sync tracking
	let headersPerSecond = $state(0);
	let lastHeaderCount = $state(0);
	let lastHeaderUpdateTime = $state(Date.now());
	let prevHeaderCount = $state(0);
	let prevHeadersPerSecond = $state(0);
	let headerEtaSeconds = $state(0);
	let lastHeaderEtaUpdate = $state(Date.now());

	// Block sync ETA tweening
	let prevBlockEtaSeconds = $state(0);

	// Peer count tweening
	let prevPeerCount = $state(0);

	// Observer stats (from batch RPC)
	let peerCount = $state(0);
	let serverUptime = $state(0);
	let lastUptimeUpdate = $state(Date.now());
	let nodeStartHeight = $state(0);

	// Polling
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let timeInterval: ReturnType<typeof setInterval> | null = null;
	let now = $state(Date.now());
	let isFetching = $state(false);

	// Smoothly interpolated uptime
	const displayedUptime = $derived(
		serverUptime + Math.floor((now - lastUptimeUpdate) / 1000)
	);

	// Tweening helper - eases between previous and current value over poll interval
	function tweenValue(prev: number, current: number): number {
		const elapsed = now - lastRpcUpdate;
		const progress = Math.min(elapsed / POLL_INTERVAL, 1);
		const eased = 1 - Math.pow(1 - progress, 2);
		return Math.round(prev + (current - prev) * eased);
	}

	// Milestone tracking
	let currentMilestoneNotification = $state<Milestone | null>(null);
	let dismissedMilestones = $state<Set<number>>(new Set());
	let lastMilestoneCheckHeight = $state(0);

	const POLL_INTERVAL = 5000;
	const ERROR_BACKOFF_INTERVAL = 10000;
	const GENESIS_DATE = new Date('2009-01-03T18:15:05Z');

	function estimateBlockDate(height: number): Date {
		const msPerBlock = 10 * 60 * 1000;
		return new Date(GENESIS_DATE.getTime() + height * msPerBlock);
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString(undefined, {
			month: 'short',
			year: 'numeric'
		});
	}

	function formatNumber(n: number): string {
		return n.toLocaleString();
	}

	function formatBytes(bytes: number): string {
		if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
		if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
		if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
		if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
		return bytes + ' B';
	}

	function formatDifficulty(diff: number): string {
		if (diff >= 1e12) return (diff / 1e12).toFixed(2) + ' T';
		if (diff >= 1e9) return (diff / 1e9).toFixed(2) + ' B';
		if (diff >= 1e6) return (diff / 1e6).toFixed(2) + ' M';
		if (diff >= 1e3) return (diff / 1e3).toFixed(2) + ' K';
		return diff.toFixed(2);
	}

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

	function formatRate(rate: number): string {
		if (rate <= 0) return '0';
		if (rate >= 1000) return (rate / 1000).toFixed(1) + 'k';
		return rate.toFixed(1);
	}

	/**
	 * Get phase description for activity indicator
	 */
	function getPhaseDescription(mode: SyncMode): string {
		switch (mode) {
			case 'DOWNLOAD': return 'Downloading blocks from peers';
			case 'DRAIN': return 'Waiting for in-flight requests';
			case 'VALIDATE': return 'Validating blocks and updating UTXO set';
			case 'FLUSH': return 'Persisting changes to database';
			case 'PRUNE': return 'Removing old block files';
			case 'DONE': return 'Fully synced';
			case 'HEADERS': return 'Downloading block headers';
			default: return '';
		}
	}

	/**
	 * Get phase color for UI elements
	 */
	function getPhaseColor(mode: SyncMode): string {
		switch (mode) {
			case 'DOWNLOAD': return 'blue';
			case 'DRAIN': return 'gray';
			case 'VALIDATE': return 'emerald';
			case 'FLUSH': return 'gray';
			case 'PRUNE': return 'gray';
			case 'DONE': return 'emerald';
			case 'HEADERS': return 'amber';
			default: return 'gray';
		}
	}

	/**
	 * Check if download progress bar should be active (tweening)
	 */
	function isDownloadActive(mode: SyncMode): boolean {
		return mode === 'DOWNLOAD';
	}

	/**
	 * Check if validation progress bar should be active (tweening)
	 */
	function isValidationActive(mode: SyncMode): boolean {
		return mode === 'VALIDATE';
	}

	function calcProgress(value: number, total: number): number {
		if (total <= 0) return 0;
		return Math.min((value / total) * 100, 100);
	}

	function checkMilestones(currentHeight: number): void {
		if (lastMilestoneCheckHeight === 0) {
			lastMilestoneCheckHeight = currentHeight;
			return;
		}

		if (currentHeight <= lastMilestoneCheckHeight) return;

		const passedMilestones = getMilestonesBetween(lastMilestoneCheckHeight + 1, currentHeight);
		for (let i = passedMilestones.length - 1; i >= 0; i--) {
			const milestone = passedMilestones[i];
			if (!dismissedMilestones.has(milestone.height)) {
				currentMilestoneNotification = milestone;
				break;
			}
		}

		lastMilestoneCheckHeight = currentHeight;
	}

	function dismissMilestone(): void {
		if (currentMilestoneNotification) {
			dismissedMilestones = new Set([...dismissedMilestones, currentMilestoneNotification.height]);
			currentMilestoneNotification = null;
		}
	}

	async function fetchChainInfo(): Promise<boolean> {
		if (isFetching) return !error;
		isFetching = true;

		try {
			const config = connection.getConfig();
			const { chainInfo: info, observerStats, syncStatus: status } = await getSyncDataBatch({
				endpoint: config.endpoint,
				timeout: config.timeout
			});

			// Update observer stats
			prevPeerCount = peerCount;
			peerCount = observerStats.peer_count;
			serverUptime = observerStats.uptime_seconds;
			lastUptimeUpdate = Date.now();
			nodeStartHeight = observerStats.start_height;

			// Track session start
			if (!hasSessionStart && info.blocks > 0) {
				sessionStartBlocks = info.blocks;
				sessionStartTime = Date.now();
				hasSessionStart = true;
			}

			// Store previous values for tweening
			prevBlocksDownloaded = blocksDownloaded;
			prevBlocksValidated = blocksValidated;
			prevDownloadRateBps = downloadRateBps;
			prevValidationRateBps = validationRateBps;
			prevStorageUsedBytes = storageUsedBytes;

			// Update batch IBD state from RPC
			// Handle both old and new field names for compatibility
			syncMode = (status.mode as SyncMode) ?? 'IDLE';
			blocksValidated = status.blocks_validated ?? status.tip_height ?? info.blocks ?? 0;
			// Use blocks_downloaded from RPC (total blocks received from peers)
			blocksDownloaded = status.blocks_downloaded ?? blocksValidated;
			downloadRateBps = status.download_rate_bps ?? 0;
			validationRateBps = status.validation_rate_bps ?? 0;
			storageUsedBytes = status.storage_used_bytes ?? info.size_on_disk ?? 0;
			storagePruneTarget = status.storage_prune_target ?? 0;
			lastRpcUpdate = Date.now();

			// Header sync tracking
			prevHeaderCount = lastHeaderCount;
			prevHeadersPerSecond = headersPerSecond;

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

			const currentHeadersRemaining = ($blockHeight || 0) - info.headers;
			if (headersPerSecond > 0 && currentHeadersRemaining > 0) {
				headerEtaSeconds = Math.round(currentHeadersRemaining / headersPerSecond);
				lastHeaderEtaUpdate = Date.now();
			}

			prevBlockEtaSeconds = syncStatus?.eta_seconds ?? 0;

			chainInfo = info;
			syncStatus = status;

			error = null;
			consecutiveErrors = 0;
			loading = false;
			isFetching = false;

			checkMilestones(info.blocks);

			return true;
		} catch (e) {
			consecutiveErrors++;
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
	const blocksRemaining = $derived(Math.max(0, networkHeight - blocksValidated));
	const validationProgress = $derived(calcProgress(blocksValidated, networkHeight));
	const downloadProgress = $derived(calcProgress(blocksDownloaded, networkHeight));
	const progressBarWidth = $derived(`${validationProgress}%`);
	const sessionDuration = $derived(now - sessionStartTime);
	const blocksThisSession = $derived(blocksValidated - sessionStartBlocks);
	const estimatedDate = $derived(estimateBlockDate(blocksValidated));
	const isPrunedNode = $derived(storagePruneTarget > 0);
	const storagePercentage = $derived(
		storagePruneTarget > 0 ? (storageUsedBytes / storagePruneTarget) * 100 : 0
	);

	// Tweened display values
	const displayedDownloaded = $derived(
		isDownloadActive(syncMode) ? tweenValue(prevBlocksDownloaded, blocksDownloaded) : blocksDownloaded
	);
	const displayedValidated = $derived(
		isValidationActive(syncMode) ? tweenValue(prevBlocksValidated, blocksValidated) : blocksValidated
	);
	const displayedDownloadRate = $derived(
		isDownloadActive(syncMode)
			? tweenValue(Math.round(prevDownloadRateBps * 10), Math.round(downloadRateBps * 10)) / 10
			: downloadRateBps
	);
	const displayedValidationRate = $derived(
		isValidationActive(syncMode)
			? tweenValue(Math.round(prevValidationRateBps * 10), Math.round(validationRateBps * 10)) / 10
			: validationRateBps
	);
	const displayedStorageUsed = $derived(tweenValue(prevStorageUsedBytes, storageUsedBytes));

	// Progress bar widths
	const displayedDownloadProgress = $derived(networkHeight > 0 ? (displayedDownloaded / networkHeight) * 100 : 0);
	const displayedDownloadProgressBarWidth = $derived(`${Math.min(displayedDownloadProgress, 100)}%`);
	const displayedValidationProgress = $derived(networkHeight > 0 ? (displayedValidated / networkHeight) * 100 : 0);
	const displayedValidationProgressBarWidth = $derived(`${Math.min(displayedValidationProgress, 100)}%`);

	// Header sync tweened display values
	const displayedHeaderCount = $derived(tweenValue(prevHeaderCount, headerCount));
	const displayedHeadersPerSecond = $derived(tweenValue(prevHeadersPerSecond, Math.round(headersPerSecond)));
	const displayedHeadersRemaining = $derived(Math.max(0, networkHeight - displayedHeaderCount));
	const displayedHeaderEta = $derived(
		Math.max(0, headerEtaSeconds - Math.floor((now - lastHeaderEtaUpdate) / 1000))
	);
	const displayedHeaderProgress = $derived(networkHeight > 0 ? (displayedHeaderCount / networkHeight) * 100 : 0);
	const displayedHeaderProgressBarWidth = $derived(`${Math.min(displayedHeaderProgress, 100)}%`);

	// Block ETA tweened value
	const currentBlockEta = $derived(syncStatus?.eta_seconds ?? 0);
	const displayedBlockEta = $derived(tweenValue(prevBlockEtaSeconds, currentBlockEta));

	// Peer count tweened value
	const displayedPeerCount = $derived(tweenValue(prevPeerCount, peerCount));

	// Headers-first sync phase detection
	const isHeadersPhase = $derived(syncMode === 'HEADERS' || (headerCount > 0 && blocksValidated === 0 && blocksDownloaded === 0));

	// Sync detection
	const isSynced = $derived(() => {
		if (!chainInfo) return false;
		if (syncMode === 'DONE') return true;
		if (chainInfo.initialblockdownload) return false;
		if (blocksValidated === 0 && networkHeight > 0) return false;
		if (networkHeight - blocksValidated > 10) return false;
		return true;
	});

	// Track sync completion
	let wasNotSynced = $state(true);
	let justCompletedSync = $state(false);

	const lastSessionDate = $derived(() => {
		const sessions = $allSessions;
		if (sessions.length === 0) return null;
		const lastSession = sessions[sessions.length - 1];
		return lastSession.endTime ? new Date(lastSession.endTime) : null;
	});

	function handleContinueSync(): void {
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(SESSION_KEY_RESUME_SHOWN, 'true');
		}
		viewState = 'syncing';
	}

	function handleObserve(): void {
		goto('/observer');
	}

	function handleEnterDashboard(): void {
		viewState = 'syncing';
	}

	function startSessionTracking(): void {
		if (sessionTrackerStarted || !chainInfo) return;
		sessionTrackerStarted = true;
		sessionHistory.startSession(chainInfo.blocks, networkHeight);
	}

	function shouldShowResume(): boolean {
		if (typeof window === 'undefined') return false;
		const alreadyShown = sessionStorage.getItem(SESSION_KEY_RESUME_SHOWN) === 'true';
		if (alreadyShown) return false;
		return $isResumeSession;
	}

	const modeLabel = $derived(MODE_LABELS[$detectedMode] || 'Syncing');
	const lastMilestone = $derived(getLastPassedMilestone(validatedHeight));
	const nextMilestone = $derived(getNextMilestone(validatedHeight));

	onMount(() => {
		connection.stopAutoHealthCheck();

		if (shouldShowResume() && !$syncCompletion) {
			viewState = 'resume';
		} else {
			viewState = 'syncing';
		}

		fetchChainInfo();
		connection.fetchExternalData();

		let currentInterval = POLL_INTERVAL;

		const poll = async () => {
			const success = await fetchChainInfo();
			currentInterval = success ? POLL_INTERVAL : ERROR_BACKOFF_INTERVAL;
			pollInterval = setTimeout(poll, currentInterval);
		};

		pollInterval = setTimeout(poll, POLL_INTERVAL);

		const externalPoll = setInterval(() => {
			connection.fetchExternalData();
		}, 30000);

		timeInterval = setInterval(() => {
			now = Date.now();
		}, 250);

		return () => {
			if (pollInterval) clearTimeout(pollInterval);
			clearInterval(externalPoll);
			if (timeInterval) clearInterval(timeInterval);

			if (sessionTrackerStarted && chainInfo) {
				sessionHistory.endSession(chainInfo.blocks);
			}

			connection.resumeAutoHealthCheck();
			connection.connect();
		};
	});

	$effect(() => {
		if (!chainInfo || loading) return;

		if (viewState === 'syncing' && !isSynced()) {
			startSessionTracking();
		}

		if (sessionTrackerStarted && validatedHeight > 0) {
			sessionHistory.updateProgress(validatedHeight, validationProgress);
		}

		if (wasNotSynced && isSynced() && validatedHeight > 0) {
			wasNotSynced = false;
			justCompletedSync = true;

			if (!$syncCompletion) {
				sessionHistory.markComplete(validatedHeight);
				viewState = 'complete';
			}
		}
	});

	onDestroy(() => {
		if (pollInterval) {
			clearTimeout(pollInterval);
			clearInterval(pollInterval);
		}
		if (timeInterval) clearInterval(timeInterval);
	});
</script>

<style>
	.timeline-marker {
		position: absolute;
		bottom: -1.5rem;
		transform: translateX(-50%);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.stat-value {
		min-height: 2rem;
		min-width: 3rem;
		display: inline-block;
	}

	/* Active bar shimmer effect */
	.bar-active {
		background-size: 200% 100%;
		animation: shimmer 2s linear infinite;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* Static bar desaturation */
	.bar-static {
		filter: saturate(0.5) brightness(0.8);
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
				<!-- Subtle phase indicator -->
				{#if !loading && !error && syncMode !== 'DONE' && syncMode !== 'IDLE'}
					<span class="text-xs text-echo-dim font-mono px-2 py-0.5 rounded bg-echo-surface">
						{syncMode}
					</span>
				{/if}
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
		<!-- Dual Progress Bars (hidden during headers phase) -->
		{#if !isHeadersPhase}
		<Card>
			<!-- Dual progress bars section -->
			<div class="space-y-4 mb-6">
				<!-- Downloaded progress (blue) -->
				<div>
					<div class="flex justify-between items-baseline mb-1.5">
						<span class="text-sm font-medium {isDownloadActive(syncMode) ? 'text-blue-400' : 'text-blue-400/50'}">
							Downloaded
						</span>
						<span class="text-sm font-mono text-echo-text">
							{formatNumber(displayedDownloaded)} / {formatNumber(networkHeight)}
							<span class="text-echo-dim">({displayedDownloadProgress.toFixed(1)}%)</span>
						</span>
					</div>
					<div class="relative h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
						<div
							class="absolute left-0 top-0 h-full rounded-full transition-all duration-300
								{isDownloadActive(syncMode)
									? 'bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 bar-active'
									: 'bg-gradient-to-r from-blue-600 to-blue-400 bar-static'}"
							style="width: {displayedDownloadProgressBarWidth}"
						></div>
					</div>
				</div>

				<!-- Validated progress (green) -->
				<div>
					<div class="flex justify-between items-baseline mb-1.5">
						<span class="text-sm font-medium {isValidationActive(syncMode) ? 'text-emerald-400' : 'text-emerald-400/50'}">
							Validated
						</span>
						<span class="text-sm font-mono text-echo-text">
							{formatNumber(displayedValidated)} / {formatNumber(networkHeight)}
							<span class="text-echo-dim">({displayedValidationProgress.toFixed(1)}%)</span>
						</span>
					</div>
					<div class="relative h-3 bg-echo-surface rounded-full border border-echo-border overflow-hidden">
						<div
							class="absolute left-0 top-0 h-full rounded-full transition-all duration-300
								{isValidationActive(syncMode)
									? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 bar-active'
									: 'bg-gradient-to-r from-emerald-600 to-emerald-400 bar-static'}"
							style="width: {displayedValidationProgressBarWidth}"
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

				<!-- Current position marker (tied to validation, not download) -->
				{#if validationProgress > 0 && validationProgress < 100}
					<span
						class="timeline-marker text-emerald-400 font-bold"
						style="left: {progressBarWidth}"
					>
						You
					</span>
				{/if}
			</div>

			<!-- Stats grid - row 1: counts and rates -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-echo-border">
				<div class="text-center">
					<div class="text-xs {isDownloadActive(syncMode) ? 'text-blue-400' : 'text-echo-dim'} mb-1">Downloaded</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(displayedDownloaded)}</div>
					<div class="text-xs text-echo-muted">
						{isDownloadActive(syncMode) && displayedDownloadRate > 0
							? `${formatRate(displayedDownloadRate)} blk/s`
							: 'idle'}
					</div>
				</div>
				<div class="text-center">
					<div class="text-xs {isValidationActive(syncMode) ? 'text-emerald-400' : 'text-echo-dim'} mb-1">Validated</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(displayedValidated)}</div>
					<div class="text-xs text-echo-muted">
						{isValidationActive(syncMode) && displayedValidationRate > 0
							? `${formatRate(displayedValidationRate)} blk/s`
							: formatDate(estimatedDate)}
					</div>
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
			</div>

			<!-- Stats grid - row 2: storage and uptime -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-echo-border">
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
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">Remaining</div>
					<div class="text-xl font-light text-echo-text">{formatNumber(blocksRemaining)}</div>
					<div class="text-xs text-echo-muted">blocks</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">History Date</div>
					<div class="text-xl font-light text-echo-text">{formatDate(estimatedDate)}</div>
					<div class="text-xs text-echo-muted">validating</div>
				</div>
				<div class="text-center">
					<div class="text-xs text-echo-dim mb-1">Uptime</div>
					<div class="text-xl font-light text-echo-text">{formatDuration(displayedUptime * 1000)}</div>
					<div class="text-xs text-echo-muted">node running</div>
				</div>
			</div>
		</Card>
		{/if}

		<!-- Headers-First Sync Phase -->
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
								class="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 rounded-full bar-active"
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

				<!-- Stats during headers phase -->
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
						<div class="text-xs text-echo-dim mb-1">Blocks ETA</div>
						<div class="text-xl font-light text-echo-text">—</div>
						<div class="text-xs text-echo-muted">phase 2</div>
					</div>
					<div class="text-center">
						<div class="text-xs text-echo-dim mb-1">Storage</div>
						<div class="text-xl font-light text-echo-text">{formatBytes(displayedStorageUsed)}</div>
						<div class="text-xs text-echo-muted">{isPrunedNode ? 'pruned' : 'archival'}</div>
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

		<!-- Milestone Notification -->
		{#if currentMilestoneNotification}
			<MilestoneNotification
				milestone={currentMilestoneNotification}
				onDismiss={dismissMilestone}
			/>
		{/if}

		<!-- Chain Details -->
		<Card>
			<h2 class="text-lg font-light text-echo-text mb-4">Chain Details</h2>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-echo-muted">Network Height</span>
						<span class="font-mono text-echo-text">{formatNumber(networkHeight)}</span>
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
							{isPrunedNode ? `Enabled (${formatBytes(storagePruneTarget)})` : 'Disabled'}
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

		<!-- Activity Indicator -->
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
						Fully synced — validating new blocks as they arrive
					</p>
				</div>
			</div>
		{:else if syncMode === 'DOWNLOAD'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Downloading blocks... {formatNumber(displayedDownloaded)} received
						{#if displayedDownloadRate > 0}
							at {formatRate(displayedDownloadRate)} blk/s
						{/if}
					</p>
				</div>
			</div>
		{:else if syncMode === 'DRAIN'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Waiting for in-flight requests to complete...
					</p>
				</div>
			</div>
		{:else if syncMode === 'VALIDATE'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Validating blocks... {formatNumber(displayedValidated)} verified
						{#if displayedValidationRate > 0}
							at {formatRate(displayedValidationRate)} blk/s
						{/if}
					</p>
				</div>
			</div>
		{:else if syncMode === 'FLUSH'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Flushing UTXO changes to database...
					</p>
				</div>
			</div>
		{:else if syncMode === 'PRUNE'}
			<div class="bg-echo-surface border border-echo-border rounded px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
					<p class="text-sm text-echo-muted font-mono">
						Pruning old block files to free space...
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

					{#if nextMilestone}
						{@const categoryInfo = CATEGORY_INFO[nextMilestone.category]}
						{@const blocksAway = nextMilestone.height - blocksValidated}
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

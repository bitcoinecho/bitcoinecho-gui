<script lang="ts">
	/**
	 * Welcome Back Overlay
	 *
	 * Session 2.4: Resume & Completion Experience
	 *
	 * Shows a resume context when user returns to continue syncing.
	 * Displays last session info, progress saved, and encouragement.
	 *
	 * Updated to show headers-first sync progress correctly:
	 * - During headers phase: shows header count and header progress
	 * - During blocks phase: shows validated block count and block progress
	 */

	import { onMount } from 'svelte';
	import { detectedMode, MODE_LABELS, pruneTargetMB } from '$lib/stores/nodeMode';
	import { totalSessionCount } from '$lib/stores/sessionHistory';
	import { connection, blockHeight } from '$lib/stores/connection';
	import { getBlockchainInfo } from '$lib/rpc/client';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Button from '$lib/components/Button.svelte';

	interface Props {
		lastSessionDate: Date | null;
		onContinue: () => void;
		onObserve?: () => void;
	}

	let { lastSessionDate = null, onContinue, onObserve }: Props = $props();

	// Live sync state from node
	let blocks = $state(0);
	let headers = $state(0);
	let loading = $state(true);

	// Fetch current sync state from node
	onMount(async () => {
		try {
			const config = connection.getConfig();
			const info = await getBlockchainInfo({ endpoint: config.endpoint, timeout: config.timeout });
			blocks = info.blocks;
			headers = info.headers;
		} catch (e) {
			console.warn('Failed to fetch blockchain info:', e);
		} finally {
			loading = false;
		}
	});

	// Derived: Are we in headers-first sync phase?
	const isHeadersPhase = $derived(headers > 0 && blocks === 0);

	// Derived: Network height (from mempool.space)
	const networkHeight = $derived($blockHeight || 928000); // Fallback to approximate

	// Derived: Current progress (based on phase)
	const currentProgress = $derived(() => {
		if (networkHeight <= 0) return 0;
		if (isHeadersPhase) {
			return Math.min((headers / networkHeight) * 100, 100);
		}
		return Math.min((blocks / networkHeight) * 100, 100);
	});

	// Derived: Display height (headers during headers phase, blocks otherwise)
	const displayHeight = $derived(isHeadersPhase ? headers : blocks);

	/**
	 * Format date for display
	 */
	function formatDate(date: Date): string {
		return date.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	/**
	 * Format time for display
	 */
	function formatTime(date: Date): string {
		return date.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	/**
	 * Format storage size for display
	 */
	function formatStorage(mb: number | null): string {
		if (mb === null) return '~10 GB';
		if (mb >= 1000) {
			return `~${(mb / 1000).toFixed(1)} GB`;
		}
		return `~${mb} MB`;
	}

	/**
	 * Estimate block date from height (rough approximation)
	 */
	function estimateBlockDate(height: number): string {
		const GENESIS_DATE = new Date('2009-01-03T18:15:05Z');
		const msPerBlock = 10 * 60 * 1000; // 10 minutes average
		const date = new Date(GENESIS_DATE.getTime() + height * msPerBlock);
		return date.toLocaleDateString(undefined, {
			month: 'short',
			year: 'numeric'
		});
	}

	// Mode-specific text
	const modeText = $derived(
		$detectedMode === 'validate-lite'
			? `Validate Lite${$pruneTargetMB !== null ? ` (${formatStorage($pruneTargetMB)})` : ''}`
			: MODE_LABELS[$detectedMode] || 'Syncing'
	);
</script>

<div class="relative flex min-h-screen items-center justify-center bg-echo-bg px-4">
	<!-- Theme Toggle -->
	<div class="absolute right-6 top-6">
		<ThemeToggle />
	</div>

	<div class="w-full max-w-lg text-center">
		<!-- Greeting -->
		<div class="mb-10">
			<h1 class="mb-4 font-mono text-2xl uppercase tracking-widest text-echo-text">
				Welcome Back
			</h1>
			<p class="text-echo-muted">Your validation journey continues.</p>
		</div>

		<!-- Progress Card -->
		<div class="mb-8 border border-echo-accent p-6 text-left">
			{#if lastSessionDate}
				<p class="mb-4 text-sm text-echo-dim">
					Last session: {formatDate(lastSessionDate)} at {formatTime(lastSessionDate)}
				</p>
			{/if}

			<div class="space-y-4">
				<!-- Current Progress -->
				<div class="flex items-baseline justify-between">
					<span class="text-echo-muted">
						{isHeadersPhase ? 'Header sync progress' : 'Validation progress'}
					</span>
					<span class="font-mono text-xl text-echo-accent">
						{#if loading}
							...
						{:else}
							{currentProgress().toFixed(1)}%
						{/if}
					</span>
				</div>

				<!-- Headers or Blocks count -->
				<div class="flex items-baseline justify-between">
					<span class="text-echo-muted">
						{isHeadersPhase ? 'Headers downloaded' : 'Blocks validated'}
					</span>
					<span class="font-mono text-echo-text">
						{#if loading}
							...
						{:else}
							{displayHeight.toLocaleString()}
						{/if}
					</span>
				</div>

				<!-- Estimated Era (for block validation phase) -->
				{#if !isHeadersPhase && displayHeight > 0}
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Currently at</span>
						<span class="font-mono text-echo-text">
							{estimateBlockDate(displayHeight)}
						</span>
					</div>
				{/if}

				<!-- Phase indicator for headers sync -->
				{#if isHeadersPhase}
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Phase</span>
						<span class="font-mono text-amber-500">
							1 of 2 (Headers)
						</span>
					</div>
				{/if}

				<!-- Sessions -->
				{#if $totalSessionCount > 0}
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Sessions</span>
						<span class="font-mono text-echo-text">
							{$totalSessionCount}
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Mode Info -->
		<div class="mb-8 border border-echo-border p-4 text-left">
			<p class="text-sm text-echo-dim">
				Your node is running in
				<span class="font-mono text-echo-accent">{modeText}</span>
				mode.
			</p>
		</div>

		<!-- Progress Visualization -->
		<div class="mb-8">
			<div class="mb-2 flex justify-between text-xs text-echo-dim">
				<span>2009</span>
				<span>Present</span>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-echo-surface">
				<div
					class="h-full rounded-full transition-all duration-500"
					class:bg-gradient-to-r={!isHeadersPhase}
					class:from-echo-accent={!isHeadersPhase}
					class:to-emerald-500={!isHeadersPhase}
					class:bg-amber-500={isHeadersPhase}
					style="width: {currentProgress()}%"
				></div>
			</div>
			{#if isHeadersPhase}
				<p class="mt-2 text-xs text-amber-500">
					Downloading headers before block validation begins
				</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-4">
			<Button variant="primary" onclick={onContinue}>Continue Sync</Button>

			{#if onObserve}
				<Button variant="secondary" onclick={onObserve}>Observe Network Instead</Button>
			{/if}
		</div>

		<!-- Encouragement -->
		<p class="mt-10 font-mono text-xs tracking-wide text-echo-dim">
			Every block you validate is a vote of confidence in the protocol's rules.
		</p>
	</div>
</div>

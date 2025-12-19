<script lang="ts">
	/**
	 * Sync Complete Celebration
	 *
	 * Session 2.4: Resume & Completion Experience
	 *
	 * Celebrates the completion of blockchain sync with journey statistics.
	 * Shows total time, sessions, blocks validated, and the final affirmation.
	 */

	import { onMount } from 'svelte';
	import {
		syncCompletion,
		totalSessionCount,
		totalSessionTime,
		lastKnownHeight
	} from '$lib/stores/sessionHistory';
	import { detectedMode, MODE_LABELS, pruneTargetMB } from '$lib/stores/nodeMode';
	import Button from '$lib/components/Button.svelte';
	import Hash from '$lib/components/Hash.svelte';

	interface Props {
		bestBlockHash: string;
		chainWork: string;
		onEnterDashboard: () => void;
	}

	let { bestBlockHash, chainWork, onEnterDashboard }: Props = $props();

	// Animation state
	let showStats = $state(false);
	let showAffirmation = $state(false);
	let showButton = $state(false);

	onMount(() => {
		// Staggered animation reveal
		setTimeout(() => {
			showStats = true;
		}, 500);

		setTimeout(() => {
			showAffirmation = true;
		}, 1500);

		setTimeout(() => {
			showButton = true;
		}, 2500);
	});

	/**
	 * Format duration for display
	 */
	function formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		const parts: string[] = [];
		if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
		if (hours % 24 > 0) parts.push(`${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`);
		if (minutes % 60 > 0 && days === 0)
			parts.push(`${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`);

		return parts.length > 0 ? parts.join(', ') : 'Less than a minute';
	}

	/**
	 * Format large numbers with commas
	 */
	function formatNumber(n: number): string {
		return n.toLocaleString();
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

	// Mode-specific text
	const modeText = $derived(
		$detectedMode === 'validate-lite'
			? `Validate Lite (${formatStorage($pruneTargetMB)})`
			: MODE_LABELS[$detectedMode] || 'Full Node'
	);
</script>

<style>
	.fade-in {
		animation: fadeIn 0.8s ease-out forwards;
		opacity: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.checkmark {
		animation: checkmarkPop 0.5s ease-out forwards;
		transform: scale(0);
	}

	@keyframes checkmarkPop {
		0% {
			transform: scale(0);
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
		}
	}
</style>

<div class="flex min-h-screen items-center justify-center bg-echo-bg px-4">
	<div class="w-full max-w-lg text-center">
		<!-- Checkmark -->
		<div class="mb-8">
			<div
				class="checkmark mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-500"
			>
				<svg class="h-12 w-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
				</svg>
			</div>
		</div>

		<!-- Title -->
		<h1 class="mb-4 font-mono text-3xl uppercase tracking-widest text-echo-text">Fully Synced</h1>

		<p class="mb-8 text-echo-muted">
			Your node has validated the entire Bitcoin blockchain from genesis to the present.
		</p>

		<!-- Stats Card -->
		{#if showStats}
			<div class="fade-in mb-8 border border-echo-accent p-6 text-left">
				<h2 class="mb-4 font-mono text-xs uppercase tracking-wider text-echo-dim">Your Journey</h2>

				<div class="space-y-4">
					<!-- Final Block -->
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Final block</span>
						<span class="font-mono text-xl text-echo-accent">
							#{formatNumber($lastKnownHeight)}
						</span>
					</div>

					<!-- Chain Work -->
					<div class="flex items-baseline justify-between gap-4">
						<span class="text-echo-muted">Chain work</span>
						<Hash value={chainWork} truncate={true} truncateLength={16} />
					</div>

					<!-- Total Time -->
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Total time</span>
						<span class="font-mono text-echo-text">
							{formatDuration($totalSessionTime)}
						</span>
					</div>

					<!-- Sessions -->
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Sessions</span>
						<span class="font-mono text-echo-text">
							{$totalSessionCount}
						</span>
					</div>

					<!-- Mode -->
					<div class="flex items-baseline justify-between">
						<span class="text-echo-muted">Mode</span>
						<span class="font-mono text-echo-text">
							{modeText}
						</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- What You Verified -->
		{#if showStats}
			<div class="fade-in mb-8 text-left" style="animation-delay: 0.3s">
				<p class="text-sm text-echo-muted">
					You've independently verified every transaction in Bitcoin's history. Every signature
					checked. Every rule enforced. No trust required.
				</p>
			</div>
		{/if}

		<!-- Affirmation -->
		{#if showAffirmation}
			<div class="fade-in mb-10 border-t border-echo-border pt-8">
				<p class="font-mono text-xl tracking-wide text-echo-accent">"Don't trust. Verify."</p>
				<p class="mt-2 font-mono text-2xl text-emerald-500">&#x2713;</p>
			</div>
		{/if}

		<!-- Best Block Hash -->
		{#if showStats && bestBlockHash}
			<div class="fade-in mb-8" style="animation-delay: 0.6s">
				<p class="mb-2 text-xs text-echo-dim">Best Block Hash</p>
				<div class="overflow-hidden rounded border border-echo-border bg-echo-surface p-3">
					<code class="break-all font-mono text-xs text-echo-muted">{bestBlockHash}</code>
				</div>
			</div>
		{/if}

		<!-- Enter Dashboard Button -->
		{#if showButton}
			<div class="fade-in">
				<Button variant="primary" onclick={onEnterDashboard}>Enter Full Node Mode</Button>
			</div>
		{/if}
	</div>
</div>

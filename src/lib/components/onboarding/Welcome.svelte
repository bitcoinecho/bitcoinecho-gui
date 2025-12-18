<script lang="ts">
	import { onboarding } from '$lib/stores/onboarding';
	import { detectedMode, isModeLoading, MODE_LABELS, pruneTargetMB } from '$lib/stores/nodeMode';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Button from '$lib/components/Button.svelte';

	function handleDismiss() {
		onboarding.dismissGuide();
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

	// Dynamic description based on actual prune target
	const liteDescription = $derived(
		$pruneTargetMB !== null
			? `Full validation with pruned storage (${formatStorage($pruneTargetMB)})`
			: 'Full validation with pruned storage'
	);

	// Dynamic CLI command showing actual prune value if active
	const liteCLI = $derived(
		$detectedMode === 'validate-lite' && $pruneTargetMB !== null
			? `./echo --prune=${$pruneTargetMB}`
			: './echo --prune=<MB>'
	);

	// Dynamic mode description
	const modeDescription = $derived(() => {
		if ($detectedMode === 'validate-lite' && $pruneTargetMB !== null) {
			return `Full validation with pruned storage (${formatStorage($pruneTargetMB)})`;
		}
		const descriptions: Record<string, string> = {
			observer: 'Watch the live Bitcoin network without validation or storage',
			'validate-lite': 'Full validation with pruned storage',
			'validate-archival': 'Full validation with complete block archive (~600 GB)',
			unknown: 'Waiting for connection to node...'
		};
		return descriptions[$detectedMode] || 'Unknown mode';
	});
</script>

<div class="relative flex min-h-screen items-center justify-center bg-echo-bg px-4">
	<!-- Theme Toggle -->
	<div class="absolute right-6 top-6">
		<ThemeToggle />
	</div>
	<div class="w-full max-w-lg text-center">
		<!-- Logo / Title -->
		<div class="mb-10">
			<h1 class="mb-4 font-mono text-2xl uppercase tracking-widest text-echo-text">Bitcoin Echo</h1>
			<p class="text-echo-muted">
				A faithful implementation of the Bitcoin protocol, built for permanence.
			</p>
		</div>

		{#if $isModeLoading || $detectedMode === 'unknown'}
			<!-- Loading State -->
			<div class="mb-10 border border-echo-border p-8">
				<div class="mb-4 flex justify-center">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-echo-dim border-t-echo-accent"
					></div>
				</div>
				<p class="text-echo-muted">Detecting node mode...</p>
				<p class="mt-2 text-sm text-echo-dim">Waiting for connection to Bitcoin Echo node</p>
			</div>
		{:else}
			<!-- Mode Detected -->
			<div class="mb-8 border border-echo-accent p-6">
				<p class="mb-2 font-mono text-xs uppercase tracking-wide text-echo-dim">
					Your node is running in
				</p>
				<h2 class="mb-4 font-mono text-xl uppercase tracking-wide text-echo-accent">
					{MODE_LABELS[$detectedMode]}
				</h2>
				<p class="text-echo-muted">
					{modeDescription()}
				</p>
			</div>

			<!-- Mode Explanations -->
			<div class="space-y-4 text-left">
				<!-- Observer -->
				<div
					class="border p-4 {$detectedMode === 'observer'
						? 'border-echo-accent bg-echo-accent/5'
						: 'border-echo-border'}"
				>
					<div class="mb-2 flex items-center gap-3">
						<span
							class="font-mono text-lg {$detectedMode === 'observer'
								? 'text-echo-accent'
								: 'text-echo-dim'}"
						>
							&#x25CB;
						</span>
						<span class="font-mono text-sm uppercase tracking-wide text-echo-text">Observer</span>
						{#if $detectedMode === 'observer'}
							<span
								class="ml-auto rounded bg-echo-accent/20 px-2 py-0.5 font-mono text-xs text-echo-accent"
							>
								ACTIVE
							</span>
						{/if}
					</div>
					<p class="text-sm text-echo-muted">
						Watch the live Bitcoin network without validation or storage. Perfect for learning and
						exploration.
					</p>
					<p class="mt-2 font-mono text-xs text-echo-dim">
						Start with: <code class="text-echo-muted">./echo --observe</code>
					</p>
				</div>

				<!-- Validate Lite -->
				<div
					class="border p-4 {$detectedMode === 'validate-lite'
						? 'border-echo-accent bg-echo-accent/5'
						: 'border-echo-border'}"
				>
					<div class="mb-2 flex items-center gap-3">
						<span
							class="font-mono text-lg {$detectedMode === 'validate-lite'
								? 'text-echo-accent'
								: 'text-echo-dim'}"
						>
							&#x2713;
						</span>
						<span class="font-mono text-sm uppercase tracking-wide text-echo-text"
							>Validate Lite</span
						>
						{#if $detectedMode === 'validate-lite'}
							<span
								class="ml-auto rounded bg-echo-accent/20 px-2 py-0.5 font-mono text-xs text-echo-accent"
							>
								ACTIVE
							</span>
						{/if}
					</div>
					<p class="text-sm text-echo-muted">
						Full validation of every block since 2009, with pruned storage. Every signature checked,
						then old blocks discarded.
						{#if $detectedMode === 'validate-lite' && $pruneTargetMB !== null}
							<span class="font-mono text-echo-accent">({formatStorage($pruneTargetMB)})</span>
						{/if}
					</p>
					<p class="mt-2 font-mono text-xs text-echo-dim">
						Start with: <code class="text-echo-muted">{liteCLI}</code>
					</p>
				</div>

				<!-- Validate Archival -->
				<div
					class="border p-4 {$detectedMode === 'validate-archival'
						? 'border-echo-accent bg-echo-accent/5'
						: 'border-echo-border'}"
				>
					<div class="mb-2 flex items-center gap-3">
						<span
							class="font-mono text-lg {$detectedMode === 'validate-archival'
								? 'text-echo-accent'
								: 'text-echo-dim'}"
						>
							&#x2630;
						</span>
						<span class="font-mono text-sm uppercase tracking-wide text-echo-text"
							>Validate Archival</span
						>
						{#if $detectedMode === 'validate-archival'}
							<span
								class="ml-auto rounded bg-echo-accent/20 px-2 py-0.5 font-mono text-xs text-echo-accent"
							>
								ACTIVE
							</span>
						{/if}
					</div>
					<p class="text-sm text-echo-muted">
						Full validation with complete block archive (~600 GB). The gold standard: keep every
						block, serve the network.
					</p>
					<p class="mt-2 font-mono text-xs text-echo-dim">
						Start with: <code class="text-echo-muted">./echo</code> (default)
					</p>
				</div>
			</div>

			<!-- How to Change Modes -->
			<div class="mt-8 border border-echo-border p-4 text-left">
				<h3 class="mb-2 font-mono text-xs uppercase tracking-wide text-echo-dim">
					Changing Modes
				</h3>
				<p class="text-sm text-echo-muted">
					To switch modes, stop the node and restart with different command-line flags. The node
					determines the mode &mdash; the GUI adapts automatically.
				</p>
			</div>
		{/if}

		<!-- Dismiss Button -->
		<div class="mt-10">
			<Button variant="primary" onclick={handleDismiss} disabled={$isModeLoading}>
				Got it
			</Button>
		</div>

		<!-- Tagline -->
		<p class="mt-10 font-mono text-xs tracking-wide text-echo-dim">"Don't trust. Verify."</p>
	</div>
</div>

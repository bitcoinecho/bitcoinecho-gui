<script lang="ts">
	import { onboarding, selectedMode } from '$lib/stores/onboarding';
	import Button from '$lib/components/Button.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	$: isLite = $selectedMode === 'validate-lite';

	function handleContinue() {
		onboarding.completeValidateInfo();
	}

	function handleBack() {
		onboarding.goBack();
	}
</script>

<div class="relative flex min-h-screen items-center justify-center bg-echo-bg px-4">
	<!-- Theme Toggle -->
	<div class="absolute right-6 top-6">
		<ThemeToggle />
	</div>
	<div class="w-full max-w-lg">
		<!-- Header -->
		<div class="mb-10 text-center">
			<h1 class="mb-2 font-mono text-xl uppercase tracking-wide text-echo-text">
				{isLite ? 'Lite Mode' : 'Archival Mode'}
			</h1>
			<p class="text-echo-muted">What you need to know</p>
		</div>

		<!-- Info Sections -->
		<div class="space-y-8">
			<!-- Storage Requirements -->
			<div class="border border-echo-border p-6">
				<h2 class="mb-3 font-mono text-xs uppercase tracking-wide text-echo-dim">
					Storage Requirements
				</h2>
				{#if isLite}
					<p class="text-echo-text">
						Pruned mode requires approximately <span class="font-mono text-echo-accent">10 GB</span>
						of storage.
					</p>
					<p class="mt-2 text-sm text-echo-muted">
						Bitcoin Echo validates every block from genesis, then discards old block data once
						safely buried. Only the UTXO set and recent blocks are kept.
					</p>
				{:else}
					<p class="text-echo-text">
						The Bitcoin blockchain is approximately <span class="font-mono text-echo-accent">600 GB</span>
						and growing.
					</p>
					<p class="mt-2 text-sm text-echo-muted">
						Bitcoin Echo stores all validated blocks and the UTXO set locally. An SSD is recommended
						for optimal performance during initial sync.
					</p>
				{/if}
			</div>

			<!-- What's Different (Lite only) -->
			{#if isLite}
				<div class="border border-echo-border p-6">
					<h2 class="mb-3 font-mono text-xs uppercase tracking-wide text-echo-dim">
						Full Validation, Minimal Storage
					</h2>
					<p class="text-echo-text">
						Lite mode validates <span class="font-mono text-echo-accent">everything</span> &mdash;
						every signature, every rule, every block since 2009.
					</p>
					<p class="mt-2 text-sm text-echo-muted">
						The only difference from archival mode is that old block data is pruned after validation.
						Your node cannot serve historical blocks to other nodes, but your validation is identical.
					</p>
				</div>
			{/if}

			<!-- Data Directory -->
			<div class="border border-echo-border p-6">
				<h2 class="mb-3 font-mono text-xs uppercase tracking-wide text-echo-dim">Data Directory</h2>
				<p class="text-echo-text">Data is stored in your home directory:</p>
				<p class="mt-2 font-mono text-sm text-echo-muted">~/.bitcoin-echo/</p>
				<p class="mt-2 text-sm text-echo-dim">
					{#if isLite}
						This includes the UTXO set, recent blocks, and configuration files.
					{:else}
						This includes all blocks, chainstate, and configuration files.
					{/if}
				</p>
			</div>

			<!-- What Happens Next -->
			<div class="border border-echo-border p-6">
				<h2 class="mb-3 font-mono text-xs uppercase tracking-wide text-echo-dim">
					What Happens Next
				</h2>
				<div class="space-y-3 text-sm text-echo-muted">
					<p class="flex items-start gap-3">
						<span class="font-mono text-echo-dim">1.</span>
						<span>Your node connects to Bitcoin peers</span>
					</p>
					<p class="flex items-start gap-3">
						<span class="font-mono text-echo-dim">2.</span>
						<span>Downloads and validates blocks from genesis (2009)</span>
					</p>
					<p class="flex items-start gap-3">
						<span class="font-mono text-echo-dim">3.</span>
						<span>Builds the UTXO set by verifying every transaction</span>
					</p>
					{#if isLite}
						<p class="flex items-start gap-3">
							<span class="font-mono text-echo-dim">4.</span>
							<span>Prunes old block data as you go</span>
						</p>
						<p class="flex items-start gap-3">
							<span class="font-mono text-echo-dim">5.</span>
							<span>Progress saves automatically &mdash; resume anytime</span>
						</p>
					{:else}
						<p class="flex items-start gap-3">
							<span class="font-mono text-echo-dim">4.</span>
							<span>Progress saves automatically &mdash; resume anytime</span>
						</p>
					{/if}
				</div>
				<p class="mt-4 text-sm text-echo-text">
					{#if isLite}
						Initial sync typically takes <span class="font-mono">several hours to 2 days</span>
						depending on your hardware and connection.
					{:else}
						Initial sync typically takes <span class="font-mono">1&ndash;7 days</span> depending on
						your hardware and connection.
					{/if}
				</p>
			</div>
		</div>

		<!-- Actions -->
		<div class="mt-10 flex items-center justify-between">
			<Button variant="ghost" onclick={handleBack}>
				&larr; Back
			</Button>
			<Button variant="primary" onclick={handleContinue}>
				Begin Validation &rarr;
			</Button>
		</div>

		<!-- Tagline -->
		<p class="mt-10 text-center font-mono text-xs tracking-wide text-echo-dim">
			Every signature verified. Every rule checked.
		</p>
	</div>
</div>

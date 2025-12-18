<script lang="ts">
	import { onboarding } from '$lib/stores/onboarding';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	function handleObserve() {
		onboarding.selectObserve();
	}

	function handleValidateLite() {
		onboarding.selectValidateLite();
	}

	function handleValidateArchival() {
		onboarding.selectValidateArchival();
	}
</script>

<div class="relative flex min-h-screen items-center justify-center bg-echo-bg px-4">
	<!-- Theme Toggle -->
	<div class="absolute right-6 top-6">
		<ThemeToggle />
	</div>
	<div class="w-full max-w-md text-center">
		<!-- Logo / Title -->
		<div class="mb-12">
			<h1 class="mb-4 font-mono text-2xl uppercase tracking-widest text-echo-text">Bitcoin Echo</h1>
			<p class="text-echo-muted">
				A faithful implementation of the Bitcoin protocol, built for permanence.
			</p>
		</div>

		<!-- Mode Selection -->
		<div class="space-y-4">
			<!-- Observe Option -->
			<button
				onclick={handleObserve}
				class="group w-full border border-echo-border bg-transparent p-6 text-left transition-all duration-300 hover:border-echo-accent"
			>
				<div class="mb-2 flex items-center gap-3">
					<span class="font-mono text-lg text-echo-dim group-hover:text-echo-accent">
						&#x25CB;
					</span>
					<span class="font-mono text-sm uppercase tracking-wide text-echo-text">Observe</span>
				</div>
				<p class="text-sm text-echo-muted">Watch the live Bitcoin network</p>
				<p class="mt-1 font-mono text-xs text-echo-dim">No storage needed &bull; Instant start</p>
			</button>

			<!-- Validate Lite Option -->
			<button
				onclick={handleValidateLite}
				class="group w-full border border-echo-border bg-transparent p-6 text-left transition-all duration-300 hover:border-echo-accent"
			>
				<div class="mb-2 flex items-center gap-3">
					<span class="font-mono text-lg text-echo-dim group-hover:text-echo-accent">
						&#x2713;
					</span>
					<span class="font-mono text-sm uppercase tracking-wide text-echo-text">Validate Lite</span>
				</div>
				<p class="text-sm text-echo-muted">Full validation, minimal storage</p>
				<p class="mt-1 font-mono text-xs text-echo-dim">~10 GB storage &bull; Fastest sync</p>
			</button>

			<!-- Validate Archival Option -->
			<button
				onclick={handleValidateArchival}
				class="group w-full border border-echo-border bg-transparent p-6 text-left transition-all duration-300 hover:border-echo-accent"
			>
				<div class="mb-2 flex items-center gap-3">
					<span class="font-mono text-lg text-echo-dim group-hover:text-echo-accent">
						&#x2630;
					</span>
					<span class="font-mono text-sm uppercase tracking-wide text-echo-text">Validate Archival</span>
				</div>
				<p class="text-sm text-echo-muted">Full validation, complete history</p>
				<p class="mt-1 font-mono text-xs text-echo-dim">~600 GB storage &bull; Serve the network</p>
			</button>
		</div>

		<!-- Tagline -->
		<p class="mt-12 font-mono text-xs tracking-wide text-echo-dim">
			"Don't trust. Verify."
		</p>
	</div>
</div>

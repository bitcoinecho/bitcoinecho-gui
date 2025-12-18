<script lang="ts">
	let showTooltip = $state(false);

	function toggleTooltip() {
		showTooltip = !showTooltip;
	}

	function closeTooltip() {
		showTooltip = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeTooltip();
		}
	}
</script>

<div class="relative inline-block">
	<button
		onclick={toggleTooltip}
		onkeydown={handleKeydown}
		class="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-echo-dim hover:text-echo-muted transition-colors"
		aria-expanded={showTooltip}
		aria-haspopup="true"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
			<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
		</svg>
		<span>What am I seeing?</span>
	</button>

	{#if showTooltip}
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-40"
			onclick={closeTooltip}
		></div>

		<!-- Tooltip -->
		<div
			class="absolute left-0 top-full mt-2 z-50 w-80 bg-echo-elevated border border-echo-border shadow-xl"
			role="tooltip"
		>
			<div class="p-4 space-y-3">
				<h3 class="font-mono text-sm uppercase tracking-wide text-echo-text">
					Observer Mode
				</h3>

				<div class="text-sm text-echo-muted space-y-2">
					<p>
						Your node is connected to the live Bitcoin network, watching blocks and transactions as they propagate across the globe.
					</p>

					<p>
						<strong class="text-echo-text">Blocks:</strong> When miners find a new block, your node sees it announced by connected peers. The peer count shows how many nodes reported each block.
					</p>

					<p>
						<strong class="text-echo-text">Transactions:</strong> Unconfirmed transactions flow through the network before being included in blocks. You're seeing them in real-time.
					</p>

					<p>
						<strong class="text-echo-text">Protocol Messages:</strong> Every interaction with peers uses specific message types. VERSION and VERACK complete the handshake. INV announces new blocks and transactions.
					</p>
				</div>

				<div class="border-t border-echo-border pt-3 text-xs text-echo-dim">
					<p>
						Observer mode doesn't validate or store blocks. For full validation, run Bitcoin Echo without the <code class="bg-echo-bg px-1">--observe</code> flag.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>

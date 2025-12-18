<script lang="ts">
	import { testConnection } from '$lib/rpc/client';
	import { connection } from '$lib/stores/connection';
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	// Local state for the form
	let endpoint = $state(connection.getConfig().endpoint);
	let testing = $state(false);
	let testResult = $state<'success' | 'error' | null>(null);
	let testError = $state<string | null>(null);

	// Reset state when modal opens
	$effect(() => {
		if (open) {
			endpoint = connection.getConfig().endpoint;
			testResult = null;
			testError = null;
		}
	});

	async function handleTest() {
		testing = true;
		testResult = null;
		testError = null;

		try {
			const success = await testConnection({ endpoint, timeout: 5000 });
			if (success) {
				testResult = 'success';
			} else {
				testResult = 'error';
				testError = 'Could not connect to the node. Make sure Bitcoin Echo is running.';
			}
		} catch (error) {
			testResult = 'error';
			if (error instanceof Error) {
				// Provide user-friendly error messages
				if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
					testError = 'Network error. Check if the node is running and the URL is correct.';
				} else if (error.message.includes('CORS')) {
					testError = 'CORS error. The node may not be configured to accept browser requests.';
				} else if (error.message.includes('timeout')) {
					testError = 'Connection timed out. The node may be unreachable.';
				} else {
					testError = error.message;
				}
			} else {
				testError = 'Unknown error occurred';
			}
		} finally {
			testing = false;
		}
	}

	function handleSave() {
		connection.setConfig({ endpoint });
		onClose();
	}

	function handleCancel() {
		onClose();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="connection-settings-title"
	>
		<div class="w-full max-w-md bg-echo-elevated border border-echo-border mx-4">
			<!-- Header -->
			<div class="border-b border-echo-border px-6 py-4">
				<h2 id="connection-settings-title" class="font-mono text-sm uppercase tracking-wide text-echo-text">
					Connection Settings
				</h2>
			</div>

			<!-- Content -->
			<div class="px-6 py-6 space-y-6">
				<!-- Endpoint Input -->
				<div class="space-y-2">
					<label for="rpc-endpoint" class="block font-mono text-xs uppercase tracking-wide text-echo-muted">
						RPC Endpoint
					</label>
					<input
						id="rpc-endpoint"
						type="url"
						bind:value={endpoint}
						placeholder="http://localhost:8332"
						class="w-full bg-echo-bg border border-echo-border px-4 py-3 font-mono text-sm text-echo-text placeholder:text-echo-dim focus:border-echo-accent focus:outline-none"
					/>
					<p class="text-xs text-echo-dim">
						The URL where Bitcoin Echo's RPC server is running
					</p>
				</div>

				<!-- Test Connection -->
				<div class="space-y-3">
					<Button variant="secondary" onclick={handleTest} disabled={testing || !endpoint}>
						{#if testing}
							<Spinner size="sm" />
							<span class="ml-2">Testing...</span>
						{:else}
							Test Connection
						{/if}
					</Button>

					{#if testResult === 'success'}
						<div class="flex items-center gap-2 text-sm">
							<span class="h-2 w-2 rounded-full bg-green-500"></span>
							<span class="text-green-400 font-mono">Connection successful</span>
						</div>
					{/if}

					{#if testResult === 'error' && testError}
						<div class="bg-red-900/20 border border-red-900/50 px-4 py-3 text-sm">
							<p class="text-red-400">{testError}</p>
						</div>
					{/if}
				</div>

				<!-- CORS Help -->
				<div class="border-t border-echo-border pt-4">
					<details class="group">
						<summary class="cursor-pointer font-mono text-xs uppercase tracking-wide text-echo-dim hover:text-echo-muted">
							Troubleshooting
						</summary>
						<div class="mt-3 space-y-2 text-xs text-echo-dim">
							<p>
								<strong class="text-echo-muted">Connection refused:</strong> Make sure Bitcoin Echo is running with RPC enabled.
							</p>
							<p>
								<strong class="text-echo-muted">CORS errors:</strong> Bitcoin Echo includes CORS support. If you see CORS errors, you may be running an older version.
							</p>
							<p>
								<strong class="text-echo-muted">Timeout:</strong> Check that the URL is correct and the node is reachable on your network.
							</p>
							<p class="pt-2">
								Start observer mode: <code class="bg-echo-bg px-1.5 py-0.5">./echo --observe</code>
							</p>
						</div>
					</details>
				</div>
			</div>

			<!-- Footer -->
			<div class="border-t border-echo-border px-6 py-4 flex justify-end gap-3">
				<Button variant="ghost" onclick={handleCancel}>
					Cancel
				</Button>
				<Button variant="primary" onclick={handleSave}>
					Save
				</Button>
			</div>
		</div>
	</div>
{/if}

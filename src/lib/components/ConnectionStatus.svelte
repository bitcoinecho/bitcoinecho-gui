<script lang="ts">
	import type { ConnectionStatus } from '$lib/rpc/types';
	import ConnectionSettings from './ConnectionSettings.svelte';

	interface Props {
		status: ConnectionStatus;
		error?: string | null;
	}

	let { status, error = null }: Props = $props();

	let settingsOpen = $state(false);

	function openSettings() {
		settingsOpen = true;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	// Determine display properties based on status
	const display = $derived.by(() => {
		switch (status) {
			case 'connected':
				return {
					text: 'Connected',
					dotClass: 'bg-echo-text',
					textClass: 'text-echo-muted',
					pulse: false
				};
			case 'connecting':
				return {
					text: 'Connecting...',
					dotClass: 'bg-yellow-500',
					textClass: 'text-echo-dim',
					pulse: true
				};
			case 'error':
				return {
					text: 'Error',
					dotClass: 'bg-red-500',
					textClass: 'text-red-400',
					pulse: false
				};
			case 'disconnected':
			default:
				return {
					text: 'Offline',
					dotClass: 'bg-echo-dim',
					textClass: 'text-echo-dim',
					pulse: false
				};
		}
	});
</script>

<button
	onclick={openSettings}
	class="flex items-center gap-2 transition-opacity hover:opacity-70 focus:outline-none {display.textClass}"
	title={error || `Status: ${display.text}. Click to configure connection.`}
>
	<span
		class="h-2 w-2 rounded-full transition-colors duration-500 {display.dotClass}"
		class:animate-pulse={display.pulse}
	></span>
	<span class="font-mono text-sm uppercase tracking-wide">{display.text}</span>
</button>

<ConnectionSettings open={settingsOpen} onClose={closeSettings} />

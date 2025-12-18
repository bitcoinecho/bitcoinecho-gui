<script lang="ts">
	/**
	 * Root Layout
	 *
	 * Session 2.1R: Architecture Rework
	 *
	 * Updated to:
	 * 1. Connect to node on mount
	 * 2. Detect node mode after connection
	 * 3. Show guide overlay based on showGuide store
	 */
	import { onMount } from 'svelte';
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { Onboarding } from '$lib/components/onboarding';
	import {
		connection,
		connectionStatus,
		connectionError,
		blockHeight,
		networkHashrate,
		isConnected
	} from '$lib/stores/connection';
	import { showGuide } from '$lib/stores/onboarding';
	import { nodeMode, detectedMode } from '$lib/stores/nodeMode';

	let { children } = $props();

	// Track if we've already attempted mode detection
	let hasDetected = $state(false);

	// Auto-connect to node when app loads (browser only)
	onMount(() => {
		connection.connect();
	});

	// Detect node mode when connection is established
	$effect(() => {
		if ($isConnected && !hasDetected) {
			hasDetected = true;
			const config = connection.getConfig();
			nodeMode.detect(config);
		}
	});
</script>

{#if $showGuide}
	<Onboarding />
{:else}
	<div class="flex h-screen flex-col bg-echo-bg text-echo-text">
		<Header
			status={$connectionStatus}
			error={$connectionError}
			syncing={false}
			blockHeight={$blockHeight}
			hashrate={$networkHashrate}
		/>

		<div class="flex flex-1 overflow-hidden">
			<Sidebar />

			<main class="flex-1 overflow-y-auto px-12 py-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}

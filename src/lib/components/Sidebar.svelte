<script lang="ts">
	/**
	 * Sidebar Navigation
	 *
	 * Session 2.1R: Architecture Rework
	 * Updated IBD 9.6.7: Mode-aware page availability
	 *
	 * Navigation rules:
	 * - Observer mode (--observe): Only Observer page available
	 * - IBD mode (syncing): Only Sync page available
	 * - Synced (post-IBD): All pages available
	 *
	 * Unavailable pages show helpful guidance messages.
	 */
	import { page } from '$app/stores';
	import { onboarding } from '$lib/stores/onboarding';
	import { isValidateMode, isObserverMode, isIBD } from '$lib/stores/nodeMode';

	interface NavItem {
		href: string;
		label: string;
	}

	/**
	 * All nav items - always displayed, availability determined by mode
	 */
	const navItems: NavItem[] = [
		{ href: '/sync', label: 'Sync' },
		{ href: '/observer', label: 'Observer' },
		{ href: '/', label: 'Dashboard' },
		{ href: '/blocks', label: 'Blocks' },
		{ href: '/broadcast', label: 'Broadcast' },
		{ href: '/console', label: 'Console' }
	];

	/**
	 * Track which item's unavailable message is showing
	 */
	let showingMessageFor: string | null = $state(null);
	let messageTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Determine if a nav item is available based on current mode
	 */
	function isItemAvailable(href: string): boolean {
		// Observer mode: only Observer page is available
		if ($isObserverMode) {
			return href === '/observer';
		}

		// IBD mode (validate mode, still syncing): only Sync page available
		if ($isValidateMode && $isIBD) {
			return href === '/sync';
		}

		// Synced (post-IBD): all pages available
		return true;
	}

	/**
	 * Get the unavailability message for a nav item
	 */
	function getUnavailableMessage(href: string): string {
		if ($isObserverMode) {
			if (href === '/sync') {
				return 'Sync requires validation mode. Run ./echo without --observe to sync.';
			}
			return 'This page requires validation mode. Run ./echo without --observe to access.';
		}

		if ($isValidateMode && $isIBD) {
			if (href === '/observer') {
				return 'Observer mode watches the network live. Run ./echo --observe to observe.';
			}
			return 'This page will be available once sync completes. Check Sync for progress.';
		}

		return '';
	}

	/**
	 * Handle nav item click - navigate if available, show message if not
	 */
	function handleNavClick(event: MouseEvent, item: NavItem) {
		if (!isItemAvailable(item.href)) {
			event.preventDefault();

			// Clear any existing timeout
			if (messageTimeout) {
				clearTimeout(messageTimeout);
			}

			// Show message for this item
			showingMessageFor = item.href;

			// Auto-hide after 4 seconds
			messageTimeout = setTimeout(() => {
				showingMessageFor = null;
			}, 4000);
		}
	}

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname.startsWith(href);
	}

	function handleShowHelp() {
		onboarding.showGuide();
	}
</script>

<aside class="w-52 border-r border-echo-border">
	<nav class="flex flex-col py-8">
		{#each navItems as item}
			{@const active = isActive(item.href, $page.url.pathname)}
			{@const available = isItemAvailable(item.href)}
			{@const showingMessage = showingMessageFor === item.href}

			<div class="relative">
				<a
					href={item.href}
					onclick={(e) => handleNavClick(e, item)}
					class="relative block px-6 py-3 font-mono text-sm uppercase tracking-wide transition-all duration-300
						{active
						? 'text-echo-text'
						: available
							? 'text-echo-muted hover:text-echo-text hover:pl-7'
							: 'cursor-not-allowed text-echo-dim opacity-50'}"
				>
					{#if active}
						<span class="absolute left-0 top-1/2 h-6 w-px -translate-y-1/2 bg-echo-text"></span>
					{/if}
					{item.label}
				</a>

				<!-- Unavailable message tooltip -->
				{#if showingMessage}
					<div
						class="absolute left-full top-0 z-50 ml-2 w-64 rounded border border-echo-border bg-echo-bg p-3 shadow-lg"
					>
						<p class="font-mono text-xs leading-relaxed text-echo-muted">
							{getUnavailableMessage(item.href)}
						</p>
						<button
							onclick={() => (showingMessageFor = null)}
							class="absolute right-1 top-1 text-echo-dim hover:text-echo-muted"
							title="Dismiss"
						>
							<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</nav>

	<!-- Footer -->
	<div class="absolute bottom-0 left-0 w-52 border-t border-echo-border px-6 py-4">
		<div class="flex items-center justify-between">
			<p class="font-mono text-xs text-echo-dim">v0.1.0</p>
			<button
				onclick={handleShowHelp}
				class="group text-echo-dim transition-colors duration-300 hover:text-echo-muted"
				title="Help"
			>
				<!-- Question mark icon -->
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			</button>
		</div>
	</div>
</aside>

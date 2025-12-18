<script lang="ts">
	/**
	 * Sidebar Navigation
	 *
	 * Session 2.1R: Architecture Rework
	 *
	 * Updated to use nodeMode store (detected from node) instead of
	 * onboarding store (user-selected). Help icon (?) instead of settings gear.
	 */
	import { page } from '$app/stores';
	import { onboarding } from '$lib/stores/onboarding';
	import { isValidateMode, isObserverMode } from '$lib/stores/nodeMode';

	interface NavItem {
		href: string;
		label: string;
		validateOnly?: boolean; // Only show in validate mode
		observerOnly?: boolean; // Only show in observer mode
	}

	const navItems: NavItem[] = [
		{ href: '/sync', label: 'Sync', validateOnly: true },
		{ href: '/observer', label: 'Observer' },
		{ href: '/', label: 'Dashboard' },
		{ href: '/blocks', label: 'Blocks' },
		{ href: '/broadcast', label: 'Broadcast' },
		{ href: '/console', label: 'Console' }
	];

	// Filter nav items based on mode
	const visibleNavItems = $derived(
		navItems.filter((item) => {
			if (item.validateOnly && !$isValidateMode) return false;
			if (item.observerOnly && !$isObserverMode) return false;
			return true;
		})
	);

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
		{#each visibleNavItems as item}
			{@const active = isActive(item.href, $page.url.pathname)}
			<a
				href={item.href}
				class="relative px-6 py-3 font-mono text-sm uppercase tracking-wide transition-all duration-300
          {active ? 'text-echo-text' : 'text-echo-muted hover:text-echo-text hover:pl-7'}"
			>
				{#if active}
					<span class="absolute left-0 top-1/2 h-6 w-px -translate-y-1/2 bg-echo-text"></span>
				{/if}
				{item.label}
			</a>
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

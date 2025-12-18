<script lang="ts">
	import { theme, isDark } from '$lib/stores/theme';

	function toggleTheme() {
		theme.toggle();
	}
</script>

<button
	onclick={toggleTheme}
	class="flex items-center justify-center w-9 h-9 rounded-full border border-echo-border text-echo-muted transition-all duration-300 hover:border-echo-dim hover:text-echo-text hover:scale-105 focus:outline-none"
	aria-label={$isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={$isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if $isDark}
		<!-- Sun icon (shown in dark mode, click to go light) -->
		<svg class="w-[18px] h-[18px] transition-transform duration-300 hover:rotate-[15deg]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	{:else}
		<!-- Moon icon (shown in light mode, click to go dark) -->
		<svg class="w-[18px] h-[18px] transition-transform duration-300 hover:rotate-[15deg]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	{/if}
</button>

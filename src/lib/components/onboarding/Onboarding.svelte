<script lang="ts">
	/**
	 * Onboarding Container
	 *
	 * Session 2.1R: Architecture Rework
	 *
	 * Simplified container that just shows the Welcome guide.
	 * No more multi-step flow - the guide is purely educational.
	 */
	import Welcome from './Welcome.svelte';
</script>

<style>
	/* Fade transition animation */
	.guide-container {
		position: fixed;
		inset: 0;
		z-index: 100;
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>

<div class="guide-container bg-echo-bg">
	<Welcome />
</div>

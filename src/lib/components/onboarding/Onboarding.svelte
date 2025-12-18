<script lang="ts">
	import { currentStep } from '$lib/stores/onboarding';
	import Welcome from './Welcome.svelte';
	import ValidateInfo from './ValidateInfo.svelte';

	// Track previous step for transition direction
	let previousStep = $state($currentStep);
	let transitionDirection = $state<'forward' | 'backward'>('forward');

	$effect(() => {
		const stepOrder = ['welcome', 'validate-info', 'complete'];
		const prevIndex = stepOrder.indexOf(previousStep);
		const currIndex = stepOrder.indexOf($currentStep);

		transitionDirection = currIndex >= prevIndex ? 'forward' : 'backward';
		previousStep = $currentStep;
	});
</script>

<style>
	/* Fade transition animations */
	.onboarding-container {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	.step-container {
		animation: fadeIn 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

<div class="onboarding-container bg-echo-bg">
	{#if $currentStep === 'welcome'}
		<div class="step-container">
			<Welcome />
		</div>
	{:else if $currentStep === 'validate-info'}
		<div class="step-container">
			<ValidateInfo />
		</div>
	{/if}
</div>

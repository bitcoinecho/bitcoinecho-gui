<script lang="ts">
	import type { Milestone } from '$lib/data/milestones';
	import { CATEGORY_INFO, getMilestoneUrl } from '$lib/data/milestones';

	interface Props {
		milestone: Milestone;
		onDismiss?: () => void;
	}

	let { milestone, onDismiss }: Props = $props();

	const categoryInfo = $derived(CATEGORY_INFO[milestone.category]);
	const milestoneUrl = $derived(getMilestoneUrl(milestone));
</script>

<div
	class="relative overflow-hidden rounded-lg border border-echo-border bg-echo-surface p-4"
	role="alert"
>
	<!-- Animated gradient background -->
	<div
		class="absolute inset-0 opacity-20"
		style="background: linear-gradient(135deg, {categoryInfo.bgColor.replace('bg-', '')} 0%, transparent 50%)"
	></div>

	<!-- Content -->
	<div class="relative">
		<!-- Header with icon and category -->
		<div class="mb-2 flex items-start justify-between">
			<div class="flex items-center gap-2">
				{#if milestone.icon}
					<span class="text-2xl" role="img" aria-label={milestone.category}>
						{milestone.icon}
					</span>
				{/if}
				<div>
					<span
						class="inline-block rounded px-1.5 py-0.5 text-xs font-mono uppercase tracking-wide {categoryInfo.color} {categoryInfo.bgColor}"
					>
						{categoryInfo.label}
					</span>
				</div>
			</div>

			{#if onDismiss}
				<button
					onclick={onDismiss}
					class="text-echo-dim hover:text-echo-text transition-colors"
					aria-label="Dismiss milestone notification"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Title -->
		<h3 class="text-lg font-light text-echo-text mb-1">
			{milestone.title}
		</h3>

		<!-- Block height and date -->
		<p class="text-xs font-mono text-echo-dim mb-2">
			Block #{milestone.height.toLocaleString()} • {milestone.date}
		</p>

		<!-- Description -->
		<p class="text-sm text-echo-muted leading-relaxed">
			{milestone.description}
		</p>

		<!-- View on mempool.space link -->
		<a
			href={milestoneUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-1 mt-3 text-xs text-echo-accent hover:text-echo-text transition-colors"
		>
			View on mempool.space
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
				/>
			</svg>
		</a>
	</div>
</div>

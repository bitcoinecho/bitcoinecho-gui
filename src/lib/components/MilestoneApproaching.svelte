<script lang="ts">
	import type { Milestone } from '$lib/data/milestones';
	import { CATEGORY_INFO } from '$lib/data/milestones';

	interface Props {
		milestone: Milestone;
		blocksAway: number;
	}

	let { milestone, blocksAway }: Props = $props();

	const categoryInfo = $derived(CATEGORY_INFO[milestone.category]);

	/**
	 * Format blocks away for display
	 */
	function formatBlocksAway(blocks: number): string {
		if (blocks < 10) return `${blocks} blocks`;
		if (blocks < 100) return `~${Math.round(blocks / 10) * 10} blocks`;
		return `~${blocks.toLocaleString()} blocks`;
	}
</script>

<div
	class="flex items-center gap-3 rounded border border-echo-border/50 bg-echo-surface/50 px-3 py-2"
>
	<!-- Pulse indicator -->
	<div class="relative flex items-center justify-center">
		<div class="absolute h-3 w-3 rounded-full {categoryInfo.bgColor} animate-ping"></div>
		<div class="relative h-2 w-2 rounded-full {categoryInfo.bgColor}"></div>
	</div>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		<p class="text-xs text-echo-muted truncate">
			<span class="font-medium {categoryInfo.color}">Approaching:</span>
			<span class="text-echo-text">{milestone.title}</span>
		</p>
	</div>

	<!-- Blocks away -->
	<div class="flex-shrink-0">
		<span class="text-xs font-mono text-echo-dim">
			{formatBlocksAway(blocksAway)}
		</span>
	</div>
</div>

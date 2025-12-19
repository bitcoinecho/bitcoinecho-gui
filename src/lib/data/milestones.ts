/**
 * Bitcoin Echo GUI — Historical Milestones
 *
 * Significant moments in Bitcoin's blockchain history.
 * Displayed during sync to educate users about Bitcoin's evolution.
 *
 * Session 2.3: Historical Milestones
 *
 * Sources:
 * - https://en.bitcoin.it/wiki
 * - https://github.com/bitcoin/bips
 * - https://bitcoinops.org
 */

/**
 * Milestone category for visual styling
 */
export type MilestoneCategory =
	| 'genesis' // The beginning
	| 'halving' // Block reward halvings
	| 'protocol' // Soft forks, BIP activations
	| 'historic'; // Notable real-world events

/**
 * A historical Bitcoin milestone
 */
export interface Milestone {
	/** Block height when this milestone occurred */
	height: number;
	/** Short title for the milestone */
	title: string;
	/** Longer description of the milestone */
	description: string;
	/** Approximate date (for display) */
	date: string;
	/** Category for styling */
	category: MilestoneCategory;
	/** Optional icon emoji */
	icon?: string;
	/** Optional specific URL (if not provided, block explorer URL is generated) */
	url?: string;
}

/**
 * Generate a mempool.space URL for a milestone
 * Uses specific URLs when available, otherwise links to the block
 */
export function getMilestoneUrl(milestone: Milestone): string {
	if (milestone.url) {
		return milestone.url;
	}
	return `https://mempool.space/block/${milestone.height}`;
}

/**
 * Historical Bitcoin milestones, ordered by block height
 *
 * This is embedded static data — not fetched from an API.
 * These are consensus-relevant or historically significant blocks.
 */
export const MILESTONES: Milestone[] = [
	// ═══════════════════════════════════════════════════════════════
	// 2009 — The Beginning
	// ═══════════════════════════════════════════════════════════════
	{
		height: 0,
		title: 'Genesis Block',
		description:
			'The first Bitcoin block, mined by Satoshi Nakamoto. Contains the message: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks"',
		date: 'January 3, 2009',
		category: 'genesis',
		icon: '🌅',
		url: 'https://commons.wikimedia.org/wiki/File:Bitcoin-Genesis-block.jpg'
	},
	{
		height: 170,
		title: 'First Transaction',
		description:
			'Satoshi Nakamoto sends 10 BTC to Hal Finney — the first person-to-person Bitcoin transaction ever recorded.',
		date: 'January 12, 2009',
		category: 'historic',
		icon: '📤'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2010 — Early Adoption
	// ═══════════════════════════════════════════════════════════════
	{
		height: 57043,
		title: 'Bitcoin Pizza Day',
		description:
			'Laszlo Hanyecz pays 10,000 BTC for two pizzas — the first real-world Bitcoin purchase. Now celebrated annually.',
		date: 'May 22, 2010',
		category: 'historic',
		icon: '🍕',
		url: 'https://mempool.space/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2012 — First Protocol Upgrades
	// ═══════════════════════════════════════════════════════════════
	{
		height: 173805,
		title: 'P2SH Activates',
		description:
			'BIP-16 (Pay-to-Script-Hash) enables complex scripts with simple addresses. Foundation for multi-signature wallets.',
		date: 'April 1, 2012',
		category: 'protocol',
		icon: '📜'
	},
	{
		height: 210000,
		title: 'First Halving',
		description:
			'Block reward drops from 50 BTC to 25 BTC. The first of the halvings hardcoded into Bitcoin\'s monetary policy.',
		date: 'November 28, 2012',
		category: 'halving',
		icon: '⚡'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2013 — BIP-34
	// ═══════════════════════════════════════════════════════════════
	{
		height: 227931,
		title: 'BIP-34 Activates',
		description:
			'Block version 2 requires height in coinbase. Prevents duplicate transaction IDs across blocks.',
		date: 'March 25, 2013',
		category: 'protocol',
		icon: '🔢'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2015 — DER & CLTV
	// ═══════════════════════════════════════════════════════════════
	{
		height: 363725,
		title: 'BIP-66 Activates',
		description:
			'Strict DER signature encoding enforced. Eliminates signature malleability from non-standard encoding.',
		date: 'July 4, 2015',
		category: 'protocol',
		icon: '✍️'
	},
	{
		height: 388381,
		title: 'CHECKLOCKTIMEVERIFY Activates',
		description:
			'BIP-65 enables time-locked transactions. Essential building block for payment channels and atomic swaps.',
		date: 'December 14, 2015',
		category: 'protocol',
		icon: '🔒'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2016 — CSV & Second Halving
	// ═══════════════════════════════════════════════════════════════
	{
		height: 419328,
		title: 'CHECKSEQUENCEVERIFY Activates',
		description:
			'BIP-68/112/113 enable relative timelocks. Critical for Lightning Network payment channels.',
		date: 'July 4, 2016',
		category: 'protocol',
		icon: '⏱️'
	},
	{
		height: 420000,
		title: 'Second Halving',
		description: 'Block reward drops from 25 BTC to 12.5 BTC. Bitcoin surpasses $600 price.',
		date: 'July 9, 2016',
		category: 'halving',
		icon: '⚡'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2017 — SegWit
	// ═══════════════════════════════════════════════════════════════
	{
		height: 481824,
		title: 'SegWit Activates',
		description:
			'BIP-141 separates signatures from transaction data. Fixes malleability, enables Lightning Network, increases capacity.',
		date: 'August 24, 2017',
		category: 'protocol',
		icon: '🚀'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2020 — Third Halving
	// ═══════════════════════════════════════════════════════════════
	{
		height: 630000,
		title: 'Third Halving',
		description:
			'Block reward drops from 12.5 BTC to 6.25 BTC. Occurs during global pandemic; Bitcoin later reaches new all-time highs.',
		date: 'May 11, 2020',
		category: 'halving',
		icon: '⚡'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2021 — Taproot
	// ═══════════════════════════════════════════════════════════════
	{
		height: 709632,
		title: 'Taproot Activates',
		description:
			'BIP-340/341/342 bring Schnorr signatures and MAST. Enhanced privacy, efficiency, and smart contract capability.',
		date: 'November 14, 2021',
		category: 'protocol',
		icon: '🌳'
	},

	// ═══════════════════════════════════════════════════════════════
	// 2024 — Fourth Halving
	// ═══════════════════════════════════════════════════════════════
	{
		height: 840000,
		title: 'Fourth Halving',
		description:
			'Block reward drops from 6.25 BTC to 3.125 BTC. Bitcoin ETFs approved earlier in the year.',
		date: 'April 19, 2024',
		category: 'halving',
		icon: '⚡'
	}
];

/**
 * Get milestone by exact block height
 */
export function getMilestoneAtHeight(height: number): Milestone | undefined {
	return MILESTONES.find((m) => m.height === height);
}

/**
 * Get the most recently passed milestone for a given height
 */
export function getLastPassedMilestone(height: number): Milestone | undefined {
	// Find all milestones at or before this height
	const passed = MILESTONES.filter((m) => m.height <= height);
	// Return the most recent one
	return passed[passed.length - 1];
}

/**
 * Get the next upcoming milestone for a given height
 */
export function getNextMilestone(height: number): Milestone | undefined {
	return MILESTONES.find((m) => m.height > height);
}

/**
 * Get all milestones between two heights (inclusive)
 */
export function getMilestonesBetween(fromHeight: number, toHeight: number): Milestone[] {
	return MILESTONES.filter((m) => m.height >= fromHeight && m.height <= toHeight);
}

/**
 * Check if a specific height is a milestone
 */
export function isMilestoneHeight(height: number): boolean {
	return MILESTONES.some((m) => m.height === height);
}

/**
 * Get progress to next milestone as a percentage
 */
export function getProgressToNextMilestone(
	currentHeight: number
): { milestone: Milestone; progress: number } | null {
	const next = getNextMilestone(currentHeight);
	if (!next) return null;

	const lastMilestone = getLastPassedMilestone(currentHeight);
	const start = lastMilestone ? lastMilestone.height : 0;
	const total = next.height - start;
	const current = currentHeight - start;

	return {
		milestone: next,
		progress: Math.min((current / total) * 100, 100)
	};
}

/**
 * Threshold for "approaching" a milestone (blocks away)
 */
export const APPROACHING_THRESHOLD = 1000;

/**
 * Check if we're approaching a milestone
 */
export function isApproachingMilestone(
	currentHeight: number
): { milestone: Milestone; blocksAway: number } | null {
	const next = getNextMilestone(currentHeight);
	if (!next) return null;

	const blocksAway = next.height - currentHeight;
	if (blocksAway <= APPROACHING_THRESHOLD && blocksAway > 0) {
		return { milestone: next, blocksAway };
	}

	return null;
}

/**
 * Category display info
 */
export const CATEGORY_INFO: Record<
	MilestoneCategory,
	{ label: string; color: string; bgColor: string }
> = {
	genesis: {
		label: 'Genesis',
		color: 'text-amber-400',
		bgColor: 'bg-amber-400/10'
	},
	halving: {
		label: 'Halving',
		color: 'text-purple-400',
		bgColor: 'bg-purple-400/10'
	},
	protocol: {
		label: 'Protocol',
		color: 'text-blue-400',
		bgColor: 'bg-blue-400/10'
	},
	historic: {
		label: 'Historic',
		color: 'text-emerald-400',
		bgColor: 'bg-emerald-400/10'
	}
};

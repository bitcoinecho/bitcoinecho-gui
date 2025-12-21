/**
 * Bitcoin Echo GUI — Node Mode Store
 *
 * The node is the sole source of truth for operating mode.
 * This store queries the node at startup and adapts the GUI accordingly.
 *
 * Session 2.1R: Architecture Rework
 *
 * Modes detected from node:
 * - 'observer': Node running with --observe flag (no validation, no storage)
 * - 'validate-lite': Node running with --prune flag (full validation, pruned storage)
 * - 'validate-archival': Node running normally (full validation, full archive)
 * - 'unknown': Not yet queried or node not responding
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { getObserverStats, getBlockchainInfo } from '$lib/rpc/client';
import type { RPCConfig, ObserverStats, BlockchainInfo } from '$lib/rpc/types';

/**
 * Node operating mode (detected from node, not user-selected)
 */
export type NodeMode = 'observer' | 'validate-lite' | 'validate-archival' | 'unknown';

/**
 * Node mode state
 */
interface NodeModeState {
	mode: NodeMode;
	loading: boolean;
	lastError: string | null;
	observerStats: ObserverStats | null;
	blockchainInfo: BlockchainInfo | null;
}

/**
 * Internal node mode state store
 */
const nodeModeState: Writable<NodeModeState> = writable({
	mode: 'unknown',
	loading: false,
	lastError: null,
	observerStats: null,
	blockchainInfo: null
});

/**
 * Detect node mode from RPC responses
 *
 * Logic:
 * - If observerStats.mode === 'observer' → 'observer'
 * - If observerStats.mode === 'full':
 *   - If blockchainInfo.pruned === true → 'validate-lite'
 *   - If blockchainInfo.pruned === false → 'validate-archival'
 */
function detectMode(stats: ObserverStats | null, info: BlockchainInfo | null): NodeMode {
	if (!stats) return 'unknown';

	if (stats.mode === 'observer') {
		return 'observer';
	}

	if (stats.mode === 'full') {
		// For full mode, we need blockchain info to determine if pruned
		if (info) {
			return info.pruned ? 'validate-lite' : 'validate-archival';
		}
		// If we can't get blockchain info, assume archival (default)
		return 'validate-archival';
	}

	return 'unknown';
}

/**
 * Public node mode store interface
 */
export const nodeMode = {
	subscribe: nodeModeState.subscribe,

	/**
	 * Query the node to detect its mode
	 * Call this on app startup after connection is established
	 */
	async detect(config: RPCConfig): Promise<NodeMode> {
		nodeModeState.update((s) => ({ ...s, loading: true, lastError: null }));

		try {
			// First, get observer stats (always available)
			const stats = await getObserverStats(config);

			let blockchainInfo: BlockchainInfo | null = null;

			// If in full mode, also get blockchain info to check pruning status
			if (stats.mode === 'full') {
				try {
					blockchainInfo = await getBlockchainInfo(config);
				} catch {
					// Blockchain info might not be available yet during early sync
					// Default to archival mode
					console.warn('Could not fetch blockchain info, assuming archival mode');
				}
			}

			const detectedMode = detectMode(stats, blockchainInfo);

			nodeModeState.update((s) => ({
				...s,
				mode: detectedMode,
				loading: false,
				lastError: null,
				observerStats: stats,
				blockchainInfo
			}));

			return detectedMode;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			nodeModeState.update((s) => ({
				...s,
				mode: 'unknown',
				loading: false,
				lastError: errorMessage
			}));
			return 'unknown';
		}
	},

	/**
	 * Update mode from observer stats (called by connection store on each health check)
	 * This keeps mode in sync if the node restarts with different flags
	 */
	updateFromStats(stats: ObserverStats, blockchainInfo?: BlockchainInfo | null): void {
		const currentState = get(nodeModeState);
		const newMode = detectMode(stats, blockchainInfo ?? currentState.blockchainInfo);

		// Only update if mode actually changed
		if (newMode !== currentState.mode) {
			nodeModeState.update((s) => ({
				...s,
				mode: newMode,
				observerStats: stats,
				blockchainInfo: blockchainInfo ?? s.blockchainInfo
			}));
		} else {
			// Update stats without triggering mode change
			nodeModeState.update((s) => ({
				...s,
				observerStats: stats,
				blockchainInfo: blockchainInfo ?? s.blockchainInfo
			}));
		}
	},

	/**
	 * Get the current mode synchronously
	 */
	getMode(): NodeMode {
		return get(nodeModeState).mode;
	},

	/**
	 * Reset to unknown (for testing/debugging)
	 */
	reset(): void {
		nodeModeState.set({
			mode: 'unknown',
			loading: false,
			lastError: null,
			observerStats: null,
			blockchainInfo: null
		});
	}
};

/**
 * Derived store: Current detected mode
 */
export const detectedMode: Readable<NodeMode> = derived(nodeModeState, ($state) => $state.mode);

/**
 * Derived store: Is loading mode detection?
 */
export const isModeLoading: Readable<boolean> = derived(nodeModeState, ($state) => $state.loading);

/**
 * Derived store: Mode detection error
 */
export const modeError: Readable<string | null> = derived(
	nodeModeState,
	($state) => $state.lastError
);

/**
 * Derived store: Is in observer mode?
 */
export const isObserverMode: Readable<boolean> = derived(
	nodeModeState,
	($state) => $state.mode === 'observer'
);

/**
 * Derived store: Is in validate-lite mode (pruned)?
 */
export const isValidateLiteMode: Readable<boolean> = derived(
	nodeModeState,
	($state) => $state.mode === 'validate-lite'
);

/**
 * Derived store: Is in validate-archival mode (full)?
 */
export const isValidateArchivalMode: Readable<boolean> = derived(
	nodeModeState,
	($state) => $state.mode === 'validate-archival'
);

/**
 * Derived store: Is in any validate mode (lite or archival)?
 */
export const isValidateMode: Readable<boolean> = derived(
	nodeModeState,
	($state) => $state.mode === 'validate-lite' || $state.mode === 'validate-archival'
);

/**
 * Derived store: Is mode known (successfully detected)?
 */
export const isModeKnown: Readable<boolean> = derived(
	nodeModeState,
	($state) => $state.mode !== 'unknown'
);

/**
 * Derived store: Is in Initial Block Download (IBD)?
 * True when node is still syncing historical blocks.
 * Observer mode is never in IBD (it doesn't sync).
 */
export const isIBD: Readable<boolean> = derived(nodeModeState, ($state) => {
	// Observer mode doesn't do IBD
	if ($state.mode === 'observer') return false;

	// Check blockchain info for IBD flag
	return $state.blockchainInfo?.initialblockdownload ?? false;
});

/**
 * Derived store: Prune target in MB (if pruning enabled)
 * Returns the actual --prune value from the node, or null if not pruning
 */
export const pruneTargetMB: Readable<number | null> = derived(nodeModeState, ($state) => {
	if ($state.blockchainInfo?.pruned && $state.blockchainInfo.prune_target_size) {
		// prune_target_size is in bytes, convert to MB
		return Math.round($state.blockchainInfo.prune_target_size / (1024 * 1024));
	}
	return null;
});

/**
 * Human-readable mode names for display
 */
export const MODE_LABELS: Record<NodeMode, string> = {
	observer: 'Observer',
	'validate-lite': 'Validate Lite',
	'validate-archival': 'Validate Archival',
	unknown: 'Unknown'
};

/**
 * Mode descriptions for help text
 */
export const MODE_DESCRIPTIONS: Record<NodeMode, string> = {
	observer: 'Watch the live Bitcoin network without validation or storage',
	'validate-lite': 'Full validation with pruned storage (~10 GB)',
	'validate-archival': 'Full validation with complete block archive (~600 GB)',
	unknown: 'Waiting for connection to node...'
};

/**
 * CLI commands to start node in each mode
 */
export const MODE_CLI_COMMANDS: Record<Exclude<NodeMode, 'unknown'>, string> = {
	observer: './echo --observe',
	'validate-lite': './echo --prune=10000',
	'validate-archival': './echo'
};

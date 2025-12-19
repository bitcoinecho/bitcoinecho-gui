/**
 * Bitcoin Echo GUI — Connection Store
 *
 * Manages WebSocket-like connection state to the Bitcoin Echo RPC server.
 * Provides auto-reconnect and health checking via periodic getobserverstats calls.
 *
 * Session 1.1: Connection State Management
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { getObserverStats } from '$lib/rpc/client';
import type { ConnectionStatus, ObserverStats, RPCConfig } from '$lib/rpc/types';

/**
 * Connection state
 */
interface ConnectionState {
	status: ConnectionStatus;
	config: RPCConfig;
	lastError: string | null;
	lastCheck: number | null; // Timestamp of last successful health check
	stats: ObserverStats | null; // Latest observer stats
	blockHeight: number; // Current Bitcoin block height from mempool.space
	lastBlockHeightFetch: number; // Timestamp of last block height fetch
	networkHashrate: number; // Current network hashrate in EH/s
}

/**
 * Default connection configuration
 */
const DEFAULT_CONFIG: RPCConfig = {
	endpoint: 'http://localhost:8332',
	timeout: 15000 // Increased for heavy sync periods when node is busy
};

/**
 * Load config from localStorage or use defaults
 */
function loadConfig(): RPCConfig {
	if (typeof window === 'undefined') return DEFAULT_CONFIG;

	const saved = localStorage.getItem('bitcoin-echo-rpc-config');
	if (saved) {
		try {
			return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
		} catch {
			return DEFAULT_CONFIG;
		}
	}
	return DEFAULT_CONFIG;
}

/**
 * Save config to localStorage
 */
function saveConfig(config: RPCConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('bitcoin-echo-rpc-config', JSON.stringify(config));
}

/**
 * Internal connection state store
 */
const connectionState: Writable<ConnectionState> = writable({
	status: 'disconnected',
	config: loadConfig(),
	lastError: null,
	lastCheck: null,
	stats: null,
	blockHeight: 0,
	lastBlockHeightFetch: 0,
	networkHashrate: 0
});

/**
 * How often to refresh block height (30 seconds)
 */
const BLOCK_HEIGHT_REFRESH_INTERVAL = 30000;

/**
 * Fetch current block height from mempool.space
 */
async function fetchBlockHeight(): Promise<number> {
	try {
		const response = await fetch('https://mempool.space/api/blocks/tip/height');
		if (!response.ok) throw new Error('Failed to fetch block height');
		const height = await response.json();
		return typeof height === 'number' ? height : 0;
	} catch (error) {
		console.error('Failed to fetch block height from mempool.space:', error);
		return 0;
	}
}

/**
 * Fetch current network hashrate from mempool.space
 * Returns hashrate in EH/s (exahashes per second)
 */
async function fetchNetworkHashrate(): Promise<number> {
	try {
		const response = await fetch('https://mempool.space/api/v1/mining/hashrate/1m');
		if (!response.ok) throw new Error('Failed to fetch hashrate');
		const data = await response.json();
		// API returns hashrates array with timestamp and avgHashrate
		// avgHashrate is in H/s, convert to EH/s (divide by 1e18)
		if (data.currentHashrate) {
			return data.currentHashrate / 1e18;
		}
		return 0;
	} catch (error) {
		console.error('Failed to fetch network hashrate from mempool.space:', error);
		return 0;
	}
}

/**
 * Health check interval (milliseconds)
 * NOTE: Health checking is now driven by the observer page's 1.618s poll.
 * This value is only used for initial connection retry attempts.
 */
const HEALTH_CHECK_INTERVAL = 1618; // Golden ratio (matches observer page)

/**
 * Reconnect delay after failure (milliseconds)
 */
const RECONNECT_DELAY = 5000; // 5 seconds

/**
 * Health check timer
 */
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Flag to skip automatic health checking (used when observer page takes over)
 */
let skipAutoHealthCheck = false;

/**
 * Deep compare observer stats to check if they changed
 */
function statsChanged(oldStats: ObserverStats | null, newStats: ObserverStats | null): boolean {
	if (!oldStats && !newStats) return false;
	if (!oldStats || !newStats) return true;

	// Compare all relevant fields
	return (
		oldStats.peer_count !== newStats.peer_count ||
		oldStats.uptime_seconds !== newStats.uptime_seconds ||
		oldStats.messages_received.version !== newStats.messages_received.version ||
		oldStats.messages_received.verack !== newStats.messages_received.verack ||
		oldStats.messages_received.ping !== newStats.messages_received.ping ||
		oldStats.messages_received.pong !== newStats.messages_received.pong ||
		oldStats.messages_received.inv !== newStats.messages_received.inv ||
		oldStats.messages_received.getdata !== newStats.messages_received.getdata ||
		oldStats.messages_received.block !== newStats.messages_received.block ||
		oldStats.messages_received.tx !== newStats.messages_received.tx
	);
}

/**
 * Perform a health check
 */
async function healthCheck(): Promise<void> {
	const state = get(connectionState);

	// Skip if already connecting
	if (state.status === 'connecting') return;

	try {
		// Don't set to 'connecting' on health checks after initial connection
		// to avoid unnecessary UI updates
		const isFirstConnection = state.status !== 'connected';

		if (isFirstConnection) {
			connectionState.update((s) => ({ ...s, status: 'connecting' }));
		}

		const stats = await getObserverStats({ endpoint: state.config.endpoint, timeout: state.config.timeout });

		// Check if we need to fetch block height and hashrate:
		// 1. On first connection (blockHeight is 0)
		// 2. Every 30 seconds to stay current
		const currentState = get(connectionState);
		const now = Date.now();
		const needsExternalData = currentState.blockHeight === 0 ||
			(now - currentState.lastBlockHeightFetch > BLOCK_HEIGHT_REFRESH_INTERVAL);

		let newBlockHeight = currentState.blockHeight;
		let newHashrate = currentState.networkHashrate;
		let newLastFetch = currentState.lastBlockHeightFetch;
		if (needsExternalData) {
			// Fetch both in parallel
			const [height, hashrate] = await Promise.all([
				fetchBlockHeight(),
				fetchNetworkHashrate()
			]);
			newBlockHeight = height;
			newHashrate = hashrate;
			newLastFetch = now;
		}

		// Only update if stats actually changed OR status needs updating
		if (isFirstConnection || statsChanged(state.stats, stats) || newBlockHeight !== currentState.blockHeight || newHashrate !== currentState.networkHashrate) {
			connectionState.update((s) => ({
				...s,
				status: 'connected',
				lastError: null,
				lastCheck: Date.now(),
				stats,
				blockHeight: newBlockHeight || s.blockHeight,
				lastBlockHeightFetch: newLastFetch,
				networkHashrate: newHashrate || s.networkHashrate
			}));
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		connectionState.update((s) => ({
			...s,
			status: 'error',
			lastError: errorMessage,
			stats: null
		}));

		// Schedule reconnect
		setTimeout(healthCheck, RECONNECT_DELAY);
	}
}

/**
 * Start health checking
 */
function startHealthCheck(): void {
	if (healthCheckTimer) return;

	// Skip if observer page has taken over polling
	if (skipAutoHealthCheck) return;

	// Immediate first check
	healthCheck();

	// Then periodic checks
	healthCheckTimer = setInterval(healthCheck, HEALTH_CHECK_INTERVAL);
}

/**
 * Stop health checking
 */
function stopHealthCheck(): void {
	if (healthCheckTimer) {
		clearInterval(healthCheckTimer);
		healthCheckTimer = null;
	}
}

/**
 * Public connection store interface
 */
export const connection = {
	subscribe: connectionState.subscribe,

	/**
	 * Connect to the node
	 */
	connect(): void {
		startHealthCheck();
	},

	/**
	 * Disconnect from the node
	 */
	disconnect(): void {
		stopHealthCheck();
		connectionState.update((s) => ({
			...s,
			status: 'disconnected',
			stats: null
		}));
	},

	/**
	 * Update RPC configuration
	 */
	setConfig(config: Partial<RPCConfig>): void {
		connectionState.update((s) => {
			const newConfig = { ...s.config, ...config };
			saveConfig(newConfig);
			return { ...s, config: newConfig };
		});

		// Restart health check with new config
		if (healthCheckTimer) {
			stopHealthCheck();
			startHealthCheck();
		}
	},

	/**
	 * Get current configuration
	 */
	getConfig(): RPCConfig {
		return get(connectionState).config;
	},

	/**
	 * Manually trigger a health check update
	 * This is called by the observer page's poll loop to consolidate all RPC calls
	 */
	async updateStats(): Promise<void> {
		await healthCheck();
	},

	/**
	 * Update stats directly from batch request data
	 * Used by observer page to avoid duplicate RPC calls
	 */
	updateStatsFromBatch(stats: ObserverStats): void {
		const state = get(connectionState);

		// Only update if stats actually changed
		if (statsChanged(state.stats, stats)) {
			connectionState.update((s) => ({
				...s,
				status: 'connected',
				lastError: null,
				lastCheck: Date.now(),
				stats
			}));
		} else if (state.status !== 'connected') {
			// First connection - always update status
			connectionState.update((s) => ({
				...s,
				status: 'connected',
				lastError: null,
				lastCheck: Date.now(),
				stats
			}));
		}
	},

	/**
	 * Fetch and update external network data (block height, hashrate) from mempool.space
	 * Called periodically, respects the 30-second refresh interval
	 */
	async fetchExternalData(): Promise<void> {
		const state = get(connectionState);
		const now = Date.now();

		// Only fetch if enough time has passed since last fetch
		if (state.blockHeight !== 0 && now - state.lastBlockHeightFetch < BLOCK_HEIGHT_REFRESH_INTERVAL) {
			return;
		}

		// Fetch both in parallel
		const [height, hashrate] = await Promise.all([
			fetchBlockHeight(),
			fetchNetworkHashrate()
		]);

		// Update state if we got valid data
		if (height !== 0 || hashrate !== 0) {
			connectionState.update((s) => ({
				...s,
				blockHeight: height || s.blockHeight,
				networkHashrate: hashrate || s.networkHashrate,
				lastBlockHeightFetch: now
			}));
		}
	},

	/**
	 * Stop automatic health checking (used when observer page takes over polling)
	 */
	stopAutoHealthCheck(): void {
		skipAutoHealthCheck = true;
		stopHealthCheck();
	},

	/**
	 * Resume automatic health checking (used when leaving observer page)
	 */
	resumeAutoHealthCheck(): void {
		skipAutoHealthCheck = false;
	}
};

/**
 * Derived store: Is connected?
 */
export const isConnected: Readable<boolean> = derived(
	connectionState,
	($state) => $state.status === 'connected'
);

/**
 * Derived store: Current observer stats
 */
export const observerStats: Readable<ObserverStats | null> = derived(
	connectionState,
	($state) => $state.stats
);

/**
 * Derived store: Connection status
 */
export const connectionStatus: Readable<ConnectionStatus> = derived(
	connectionState,
	($state) => $state.status
);

/**
 * Derived store: Last error message
 */
export const connectionError: Readable<string | null> = derived(
	connectionState,
	($state) => $state.lastError
);

/**
 * Derived store: Current block height from mempool.space
 */
export const blockHeight: Readable<number> = derived(
	connectionState,
	($state) => $state.blockHeight
);

/**
 * Derived store: Current network hashrate in EH/s
 */
export const networkHashrate: Readable<number> = derived(
	connectionState,
	($state) => $state.networkHashrate
);

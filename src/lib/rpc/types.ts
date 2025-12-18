/**
 * Bitcoin Echo GUI — RPC Type Definitions
 *
 * TypeScript types for JSON-RPC responses from the Bitcoin Echo node.
 * These types match the exact structure returned by the C implementation.
 *
 * Session 1.1: Observer Mode Types
 */

/**
 * JSON-RPC 2.0 Response envelope
 */
export interface RPCResponse<T> {
	result: T | null;
	error: RPCError | null;
	id: string | number;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface RPCError {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * Observer mode statistics
 *
 * Returned by: getobserverstats
 */
export interface ObserverStats {
	mode: 'observer' | 'full';
	uptime_seconds: number;
	peer_count: number;
	messages_received: {
		version: number;
		verack: number;
		ping: number;
		pong: number;
		addr: number;
		inv: number;
		getdata: number;
		block: number;
		tx: number;
		headers: number;
		getblocks: number;
		getheaders: number;
		other: number;
	};
}

/**
 * Observed block announcement
 *
 * Returned by: getobservedblocks
 */
export interface ObservedBlock {
	hash: string; // Block hash (hex, reversed for display)
	first_seen: number; // Timestamp (milliseconds since epoch)
	peer_count: number; // Number of peers that announced this block
}

/**
 * Observed transaction announcement
 *
 * Returned by: getobservedtxs
 */
export interface ObservedTx {
	txid: string; // Transaction ID (hex, reversed for display)
	first_seen: number; // Timestamp (milliseconds since epoch)
}

/**
 * Container for observed blocks list
 */
export interface ObservedBlocksResponse {
	blocks: ObservedBlock[];
}

/**
 * Container for observed transactions list
 */
export interface ObservedTxsResponse {
	transactions: ObservedTx[];
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * RPC client configuration
 */
export interface RPCConfig {
	endpoint: string; // RPC endpoint URL (e.g., "http://localhost:8332")
	timeout: number; // Request timeout in milliseconds
}

/**
 * Blockchain info response
 *
 * Returned by: getblockchaininfo
 */
export interface BlockchainInfo {
	chain: string; // Network name (e.g., "main", "test", "regtest")
	blocks: number; // Current number of validated blocks
	headers: number; // Number of headers in chain
	bestblockhash: string; // Hash of the best (tip) block
	difficulty: number; // Current difficulty
	mediantime: number; // Median time past (MTP)
	verificationprogress: number; // Sync progress (0.0 - 1.0)
	initialblockdownload: boolean; // True if still syncing
	chainwork: string; // Total chain work (hex)
	size_on_disk: number; // Disk usage in bytes
	pruned: boolean; // True if pruning is enabled
	pruneheight?: number; // Lowest block with data (if pruned)
	prune_target_size?: number; // Prune target in bytes (if pruned)
}

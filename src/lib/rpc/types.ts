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
	start_height: number;
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

/**
 * Sync mode states for decoupled IBD architecture
 *
 * The node operates in distinct modes during sync:
 * - DOWNLOADING: Actively fetching blocks from peers (any order)
 * - THROTTLED: Downloads paused, waiting for validation to catch up (storage pressure)
 * - VALIDATING: Processing a consecutive chunk of blocks
 * - FLUSHING: Writing UTXO changes to disk
 * - PRUNING: Removing old block data to free space
 * - DONE: Fully synced, processing new blocks as they arrive
 */
export type SyncMode = 'DOWNLOADING' | 'THROTTLED' | 'VALIDATING' | 'FLUSHING' | 'PRUNING' | 'DONE';

/**
 * Sync status response
 *
 * Returned by: getsyncstatus
 *
 * Provides the "source of truth" sync metrics calculated by the node.
 * The GUI should display these values instead of calculating them client-side.
 *
 * DECOUPLED IBD ARCHITECTURE:
 * Downloads and validation run independently:
 * - Downloads: Blocks arrive from peers in any order, stored to disk immediately
 * - Validation: Runs on consecutive ranges when storage pressure triggers (pruned)
 *   or all blocks arrive (archival)
 * - Throttling: Downloads pause only when storage reaches 2x prune target
 *
 * The gap between blocks_downloaded and blocks_validated is the "validation buffer"
 * - this is a FEATURE, not a backlog. It represents blocks ready for validation.
 */
export interface SyncStatus {
	mode: SyncMode; // Current sync state
	blocks_validated: number; // Blocks with UTXO changes applied (strict order)
	blocks_downloaded: number; // Blocks received from network (any order)
	consecutive_tip: number; // Highest consecutive block on disk (validation can proceed to here)
	best_header_height: number; // Height of best known header
	download_rate_bps: number; // Blocks downloaded per second
	validation_rate_bps: number; // Blocks validated per second (0 when idle)
	storage_used_bytes: number; // Current disk usage
	storage_prune_target: number; // Prune target in bytes (0 if archival)
	storage_headroom_limit: number; // Throttle threshold (2x prune target)
	current_chunk_start: number; // Start of current validation chunk (0 if not validating)
	current_chunk_end: number; // End of current validation chunk (0 if not validating)
	is_throttled: boolean; // Downloads paused due to storage pressure
	sync_percentage: number; // Completion percentage (0.0 - 100.0)
	eta_seconds: number; // Estimated time remaining in seconds
	active_sync_peers: number; // Peers actively contributing blocks
	total_peers: number; // Total connected peers
	initialblockdownload: boolean; // True if in IBD
}

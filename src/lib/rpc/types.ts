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
 * Sync mode for batch IBD architecture
 *
 * Sequential phases - each completes before the next begins:
 *   HEADERS → DOWNLOAD → DRAIN → VALIDATE → FLUSH → PRUNE → loop (pruned)
 *   HEADERS → DOWNLOAD → DRAIN → VALIDATE → FLUSH → DONE (archival)
 *
 * HEADERS: Download and validate header chain (existing, unchanged)
 * DOWNLOAD: Fill disk with blocks up to prune target
 * DRAIN: Wait for in-flight requests to complete
 * VALIDATE: Validate consecutive block range, update UTXO set
 * FLUSH: Persist UTXO changes atomically to database
 * PRUNE: Delete old block files (pruned nodes only)
 * DONE: IBD complete, normal operation
 */
export type SyncMode =
	| 'IDLE'
	| 'HEADERS'
	| 'DOWNLOAD'
	| 'DRAIN'
	| 'VALIDATE'
	| 'FLUSH'
	| 'PRUNE'
	| 'DONE';

/**
 * Sync status response
 *
 * Returned by: getsyncstatus
 *
 * Provides the "source of truth" sync metrics calculated by the node.
 * The GUI should display these values instead of calculating them client-side.
 *
 * BATCH IBD ARCHITECTURE:
 * Phases are sequential, not parallel. Rate metrics are per-phase:
 * - download_rate_bps: blocks/sec during current DOWNLOAD phase only
 * - validation_rate_bps: blocks/sec during current VALIDATE phase only
 * Rates reset when phases restart (after PRUNE for pruned nodes).
 */
export interface SyncStatus {
	mode: SyncMode; // Current sync phase
	blocks_validated: number; // Total blocks validated (chainstate height)
	best_header_height: number; // Height of best known header
	tip_height: number; // Current validated blockchain height
	blocks_downloaded: number; // Total blocks received from peers
	blocks_pending: number; // Blocks queued but not yet downloaded
	blocks_in_flight: number; // Blocks currently being downloaded
	drain_target: number; // Target height for DRAIN phase (0 if not draining)
	drain_remaining: number; // Blocks remaining in DRAIN (inflight + pending + gaps)
	sync_percentage: number; // Completion percentage (0.0 - 100.0)
	download_rate_bps: number; // Blocks downloaded per second (THIS phase)
	validation_rate_bps: number; // Blocks validated per second (THIS phase)
	eta_seconds: number; // Estimated time remaining in seconds
	storage_used_bytes: number; // Current block storage size
	storage_prune_target: number; // Target storage size (0 = archival)
	active_sync_peers: number; // Peers actively contributing blocks
	total_peers: number; // Total connected peers
	initialblockdownload: boolean; // True if in IBD
}

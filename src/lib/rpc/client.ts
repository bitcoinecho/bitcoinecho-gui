/**
 * Bitcoin Echo GUI — RPC Client
 *
 * Minimal JSON-RPC 2.0 client for communicating with the Bitcoin Echo node.
 * Supports both single and batch requests.
 *
 * Session 1.1: Observer Mode RPC Client
 * Session 1.2: Batch Request Support
 */

import type {
	RPCResponse,
	RPCConfig,
	ObserverStats,
	ObservedBlocksResponse,
	ObservedTxsResponse
} from './types';

/**
 * Default RPC configuration
 */
const DEFAULT_CONFIG: RPCConfig = {
	endpoint: 'http://localhost:8332',
	timeout: 5000
};

/**
 * RPC request ID counter
 */
let requestId = 1;

/**
 * Make a JSON-RPC 1.0 request
 *
 * @param method - RPC method name
 * @param params - Method parameters (array)
 * @param config - RPC configuration (optional)
 * @returns Promise resolving to the result
 * @throws Error if RPC returns an error or network fails
 */
async function rpcCall<T>(
	method: string,
	params: unknown[] = [],
	config: Partial<RPCConfig> = {}
): Promise<T> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	// Build JSON-RPC 1.0 request
	const request = {
		method,
		params,
		id: requestId++
	};

	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

	try {
		const response = await fetch(finalConfig.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request),
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const rpcResponse: RPCResponse<T> = await response.json();

		// Check for RPC error
		if (rpcResponse.error) {
			throw new Error(`RPC Error ${rpcResponse.error.code}: ${rpcResponse.error.message}`);
		}

		if (rpcResponse.result === null) {
			throw new Error('RPC returned null result');
		}

		return rpcResponse.result;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				throw new Error(`RPC timeout after ${finalConfig.timeout}ms`);
			}
			throw error;
		}

		throw new Error('Unknown RPC error');
	}
}

/**
 * Make a JSON-RPC 2.0 batch request
 *
 * Sends multiple RPC calls in a single HTTP request, reducing network overhead.
 * All requests execute in sequence and return an array of responses.
 *
 * @param calls - Array of {method, params} objects
 * @param config - RPC configuration (optional)
 * @returns Promise resolving to array of results in same order as calls
 * @throws Error if network fails or any RPC returns an error
 */
async function rpcBatchCall<T extends unknown[]>(
	calls: Array<{ method: string; params?: unknown[] }>,
	config: Partial<RPCConfig> = {}
): Promise<T> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	// Build JSON-RPC 2.0 batch request
	const batchRequest = calls.map((call, index) => ({
		jsonrpc: '2.0',
		method: call.method,
		params: call.params || [],
		id: requestId + index
	}));

	requestId += calls.length;

	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

	try {
		const response = await fetch(finalConfig.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(batchRequest),
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const batchResponse: RPCResponse<unknown>[] = await response.json();

		// Check that response is an array
		if (!Array.isArray(batchResponse)) {
			throw new Error('Expected array response for batch request');
		}

		// Check each response for errors
		const results = batchResponse.map((rpcResponse, index) => {
			if (rpcResponse.error) {
				throw new Error(
					`RPC Error in call ${index} (${calls[index].method}): ${rpcResponse.error.code} - ${rpcResponse.error.message}`
				);
			}

			if (rpcResponse.result === null || rpcResponse.result === undefined) {
				throw new Error(`RPC returned null result for ${calls[index].method}`);
			}

			return rpcResponse.result;
		});

		return results as T;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				throw new Error(`RPC timeout after ${finalConfig.timeout}ms`);
			}
			throw error;
		}

		throw new Error('Unknown RPC error');
	}
}

/**
 * Observer Mode RPC Methods
 */

/**
 * Get observer mode statistics
 *
 * Returns current observer state including uptime, peer count,
 * and message counters.
 *
 * @param config - RPC configuration (optional)
 * @returns Observer statistics
 */
export async function getObserverStats(config?: Partial<RPCConfig>): Promise<ObserverStats> {
	return rpcCall<ObserverStats>('getobserverstats', [], config);
}

/**
 * Get recently observed block announcements
 *
 * Returns the last 100 blocks announced by peers (ring buffer).
 *
 * @param config - RPC configuration (optional)
 * @returns List of observed blocks
 */
export async function getObservedBlocks(
	config?: Partial<RPCConfig>
): Promise<ObservedBlocksResponse> {
	return rpcCall<ObservedBlocksResponse>('getobservedblocks', [], config);
}

/**
 * Get recently observed transaction announcements
 *
 * Returns the last 100 transactions announced by peers (most recent first).
 *
 * @param config - RPC configuration (optional)
 * @returns List of observed transactions
 */
export async function getObservedTxs(config?: Partial<RPCConfig>): Promise<ObservedTxsResponse> {
	return rpcCall<ObservedTxsResponse>('getobservedtxs', [], config);
}

/**
 * Test connection to the node
 *
 * Attempts to call getobserverstats to verify the node is reachable
 * and in observer mode.
 *
 * @param config - RPC configuration (optional)
 * @returns true if connection successful
 */
export async function testConnection(config?: Partial<RPCConfig>): Promise<boolean> {
	try {
		await getObserverStats(config);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get all observer data in a single batch request
 *
 * Efficient method to fetch stats, blocks, and transactions in one HTTP call.
 * This reduces network overhead from 3 HTTP requests to 1.
 *
 * @param config - RPC configuration (optional)
 * @returns Object containing stats, blocks, and transactions
 */
export async function getObserverDataBatch(config?: Partial<RPCConfig>): Promise<{
	stats: ObserverStats;
	blocks: ObservedBlocksResponse;
	txs: ObservedTxsResponse;
}> {
	const [stats, blocks, txs] = await rpcBatchCall<
		[ObserverStats, ObservedBlocksResponse, ObservedTxsResponse]
	>(
		[
			{ method: 'getobserverstats' },
			{ method: 'getobservedblocks' },
			{ method: 'getobservedtxs' }
		],
		config
	);

	return { stats, blocks, txs };
}

/**
 * Bitcoin Echo GUI — Session History Store
 *
 * Session 2.4: Resume & Completion Experience
 *
 * Tracks sync session history across browser sessions.
 * Each session records start/end times, blocks validated, and progress.
 * Persisted to localStorage for resume functionality.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

/**
 * A single sync session record
 */
export interface SyncSession {
	id: string; // Unique session ID (ISO timestamp)
	startTime: number; // Session start timestamp (ms since epoch)
	endTime: number | null; // Session end timestamp (null if active)
	startBlocks: number; // Block height at session start
	endBlocks: number | null; // Block height at session end
	networkHeight: number; // Network height at session start
}

/**
 * Sync completion record
 */
export interface SyncCompletion {
	completedAt: number; // Timestamp when sync completed
	totalSessions: number; // Total number of sessions
	totalBlocks: number; // Final block height
	totalTimeMs: number; // Total cumulative session time
}

/**
 * Session history state
 */
interface SessionHistoryState {
	sessions: SyncSession[];
	currentSession: SyncSession | null;
	completion: SyncCompletion | null;
	lastKnownHeight: number; // Last known validated height (for resume detection)
	lastKnownProgress: number; // Last known progress percentage
}

/**
 * LocalStorage keys
 */
const STORAGE_KEY_SESSIONS = 'bitcoin-echo-sessions';
const STORAGE_KEY_COMPLETION = 'bitcoin-echo-sync-completion';
const STORAGE_KEY_LAST_HEIGHT = 'bitcoin-echo-last-height';
const STORAGE_KEY_LAST_PROGRESS = 'bitcoin-echo-last-progress';

/**
 * Load initial state from localStorage
 */
function loadInitialState(): SessionHistoryState {
	if (typeof window === 'undefined') {
		return {
			sessions: [],
			currentSession: null,
			completion: null,
			lastKnownHeight: 0,
			lastKnownProgress: 0
		};
	}

	let sessions: SyncSession[] = [];
	let completion: SyncCompletion | null = null;
	let lastKnownHeight = 0;
	let lastKnownProgress = 0;

	try {
		const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
		if (savedSessions) {
			sessions = JSON.parse(savedSessions);
		}

		const savedCompletion = localStorage.getItem(STORAGE_KEY_COMPLETION);
		if (savedCompletion) {
			completion = JSON.parse(savedCompletion);
		}

		const savedHeight = localStorage.getItem(STORAGE_KEY_LAST_HEIGHT);
		if (savedHeight) {
			lastKnownHeight = parseInt(savedHeight, 10);
		}

		const savedProgress = localStorage.getItem(STORAGE_KEY_LAST_PROGRESS);
		if (savedProgress) {
			lastKnownProgress = parseFloat(savedProgress);
		}
	} catch {
		console.warn('Failed to load session history from localStorage');
	}

	return {
		sessions,
		currentSession: null,
		completion,
		lastKnownHeight,
		lastKnownProgress
	};
}

/**
 * Save state to localStorage
 */
function saveState(state: SessionHistoryState): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(state.sessions));

		if (state.completion) {
			localStorage.setItem(STORAGE_KEY_COMPLETION, JSON.stringify(state.completion));
		}

		localStorage.setItem(STORAGE_KEY_LAST_HEIGHT, String(state.lastKnownHeight));
		localStorage.setItem(STORAGE_KEY_LAST_PROGRESS, String(state.lastKnownProgress));
	} catch {
		console.warn('Failed to save session history to localStorage');
	}
}

/**
 * Internal session history state store
 */
const sessionHistoryState: Writable<SessionHistoryState> = writable(loadInitialState());

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
	return new Date().toISOString();
}

/**
 * Public session history store interface
 */
export const sessionHistory = {
	subscribe: sessionHistoryState.subscribe,

	/**
	 * Start a new sync session
	 * Called when sync page mounts and sync is in progress
	 */
	startSession(currentBlocks: number, networkHeight: number): void {
		const state = get(sessionHistoryState);

		// Don't start a new session if one is already active
		if (state.currentSession) return;

		const session: SyncSession = {
			id: generateSessionId(),
			startTime: Date.now(),
			endTime: null,
			startBlocks: currentBlocks,
			endBlocks: null,
			networkHeight
		};

		sessionHistoryState.update((s) => {
			const newState = {
				...s,
				currentSession: session,
				lastKnownHeight: currentBlocks
			};
			return newState;
		});
	},

	/**
	 * Update current session progress
	 * Called periodically during sync to track progress
	 */
	updateProgress(currentBlocks: number, progress: number): void {
		sessionHistoryState.update((s) => {
			const newState = {
				...s,
				lastKnownHeight: currentBlocks,
				lastKnownProgress: progress
			};
			saveState(newState);
			return newState;
		});
	},

	/**
	 * End the current session
	 * Called when user navigates away or closes the page
	 */
	endSession(endBlocks: number): void {
		sessionHistoryState.update((s) => {
			if (!s.currentSession) return s;

			const endedSession: SyncSession = {
				...s.currentSession,
				endTime: Date.now(),
				endBlocks
			};

			const newState = {
				...s,
				sessions: [...s.sessions, endedSession],
				currentSession: null,
				lastKnownHeight: endBlocks
			};

			saveState(newState);
			return newState;
		});
	},

	/**
	 * Mark sync as complete
	 * Called when sync reaches 100%
	 */
	markComplete(totalBlocks: number): void {
		const state = get(sessionHistoryState);

		// End current session first if active
		if (state.currentSession) {
			this.endSession(totalBlocks);
		}

		const updatedState = get(sessionHistoryState);

		// Calculate total time from all sessions
		const totalTimeMs = updatedState.sessions.reduce((total, session) => {
			if (session.endTime && session.startTime) {
				return total + (session.endTime - session.startTime);
			}
			return total;
		}, 0);

		const completion: SyncCompletion = {
			completedAt: Date.now(),
			totalSessions: updatedState.sessions.length,
			totalBlocks,
			totalTimeMs
		};

		sessionHistoryState.update((s) => {
			const newState = {
				...s,
				completion,
				lastKnownHeight: totalBlocks,
				lastKnownProgress: 100
			};
			saveState(newState);
			return newState;
		});
	},

	/**
	 * Get the last session (for resume info)
	 */
	getLastSession(): SyncSession | null {
		const state = get(sessionHistoryState);
		if (state.sessions.length === 0) return null;
		return state.sessions[state.sessions.length - 1];
	},

	/**
	 * Check if this is a resume (user had previous sessions)
	 */
	isResume(): boolean {
		const state = get(sessionHistoryState);
		return state.sessions.length > 0 || state.lastKnownHeight > 0;
	},

	/**
	 * Get total blocks validated across all sessions
	 */
	getTotalBlocksValidated(): number {
		const state = get(sessionHistoryState);
		return state.sessions.reduce((total, session) => {
			if (session.endBlocks !== null && session.startBlocks !== null) {
				return total + Math.max(0, session.endBlocks - session.startBlocks);
			}
			return total;
		}, 0);
	},

	/**
	 * Get total session count
	 */
	getSessionCount(): number {
		const state = get(sessionHistoryState);
		return state.sessions.length;
	},

	/**
	 * Reset all session history (for testing/debugging)
	 */
	reset(): void {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY_SESSIONS);
			localStorage.removeItem(STORAGE_KEY_COMPLETION);
			localStorage.removeItem(STORAGE_KEY_LAST_HEIGHT);
			localStorage.removeItem(STORAGE_KEY_LAST_PROGRESS);
		}

		sessionHistoryState.set({
			sessions: [],
			currentSession: null,
			completion: null,
			lastKnownHeight: 0,
			lastKnownProgress: 0
		});
	}
};

/**
 * Derived store: All completed sessions
 */
export const allSessions: Readable<SyncSession[]> = derived(
	sessionHistoryState,
	($state) => $state.sessions
);

/**
 * Derived store: Current active session
 */
export const currentSession: Readable<SyncSession | null> = derived(
	sessionHistoryState,
	($state) => $state.currentSession
);

/**
 * Derived store: Sync completion info
 */
export const syncCompletion: Readable<SyncCompletion | null> = derived(
	sessionHistoryState,
	($state) => $state.completion
);

/**
 * Derived store: Is sync complete?
 */
export const isSyncComplete: Readable<boolean> = derived(
	sessionHistoryState,
	($state) => $state.completion !== null
);

/**
 * Derived store: Last known block height
 */
export const lastKnownHeight: Readable<number> = derived(
	sessionHistoryState,
	($state) => $state.lastKnownHeight
);

/**
 * Derived store: Last known progress percentage
 */
export const lastKnownProgress: Readable<number> = derived(
	sessionHistoryState,
	($state) => $state.lastKnownProgress
);

/**
 * Derived store: Total session count
 */
export const totalSessionCount: Readable<number> = derived(
	sessionHistoryState,
	($state) => $state.sessions.length
);

/**
 * Derived store: Total cumulative session time (ms)
 */
export const totalSessionTime: Readable<number> = derived(sessionHistoryState, ($state) =>
	$state.sessions.reduce((total, session) => {
		if (session.endTime && session.startTime) {
			return total + (session.endTime - session.startTime);
		}
		return total;
	}, 0)
);

/**
 * Derived store: Is this a resume session? (has previous progress)
 */
export const isResumeSession: Readable<boolean> = derived(
	sessionHistoryState,
	($state) => $state.sessions.length > 0 || $state.lastKnownHeight > 0
);

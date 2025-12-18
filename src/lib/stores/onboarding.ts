/**
 * Bitcoin Echo GUI — Onboarding Store
 *
 * Session 2.1R: Architecture Rework
 *
 * The onboarding store now ONLY tracks whether the user has seen the
 * educational guide overlay. Mode detection is handled by the nodeMode store.
 *
 * Key change: The welcome screen is now an educational guide that explains
 * what mode the node is running in, NOT a configuration selector.
 * The node (via CLI flags) is the sole source of truth for mode.
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

/**
 * Onboarding state
 *
 * - hasSeenGuide: User has dismissed the welcome guide at least once
 * - showGuide: Currently showing the guide overlay
 */
interface OnboardingState {
	hasSeenGuide: boolean;
	showGuide: boolean;
}

/**
 * LocalStorage key for guide seen status
 */
const STORAGE_KEY_GUIDE_SEEN = 'bitcoin-echo-guide-seen';

/**
 * Load initial state from localStorage
 */
function loadInitialState(): OnboardingState {
	if (typeof window === 'undefined') {
		return {
			hasSeenGuide: false,
			showGuide: false // Will be set to true on first render if !hasSeenGuide
		};
	}

	const hasSeenGuide = localStorage.getItem(STORAGE_KEY_GUIDE_SEEN) === 'true';

	return {
		hasSeenGuide,
		// Show guide on first visit (when hasSeenGuide is false)
		showGuide: !hasSeenGuide
	};
}

/**
 * Internal onboarding state store
 */
const onboardingState: Writable<OnboardingState> = writable(loadInitialState());

/**
 * Save guide seen status to localStorage
 */
function saveGuideSeen(): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY_GUIDE_SEEN, 'true');
}

/**
 * Public onboarding store interface
 */
export const onboarding = {
	subscribe: onboardingState.subscribe,

	/**
	 * Dismiss the guide overlay
	 * Called when user clicks "Got it" or closes the guide
	 */
	dismissGuide(): void {
		onboardingState.update((s) => ({
			...s,
			hasSeenGuide: true,
			showGuide: false
		}));
		saveGuideSeen();
	},

	/**
	 * Show the guide again
	 * Called from help button in sidebar
	 */
	showGuide(): void {
		onboardingState.update((s) => ({
			...s,
			showGuide: true
		}));
	},

	/**
	 * Hide the guide (without marking as seen - for programmatic closing)
	 */
	hideGuide(): void {
		onboardingState.update((s) => ({
			...s,
			showGuide: false
		}));
	},

	/**
	 * Check if guide has been seen
	 */
	hasBeenSeen(): boolean {
		return get(onboardingState).hasSeenGuide;
	},

	/**
	 * Reset onboarding state (for testing/debugging)
	 */
	reset(): void {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY_GUIDE_SEEN);
			// Also clean up old localStorage keys from previous implementation
			localStorage.removeItem('bitcoin-echo-onboarding-completed');
			localStorage.removeItem('bitcoin-echo-mode');
		}
		onboardingState.set({
			hasSeenGuide: false,
			showGuide: true
		});
	}
};

/**
 * Derived store: Should show the guide overlay?
 */
export const showGuide: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.showGuide
);

/**
 * Derived store: Has user seen the guide before?
 */
export const hasSeenGuide: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.hasSeenGuide
);

// ============================================================================
// DEPRECATED EXPORTS FOR BACKWARD COMPATIBILITY
// These will be removed after all components are updated
// ============================================================================

/**
 * @deprecated Use showGuide instead
 */
export const showOnboarding: Readable<boolean> = showGuide;

/**
 * @deprecated Mode is now detected from node via nodeMode store
 */
export type NodeMode = 'observe' | 'validate-lite' | 'validate-archival' | null;

/**
 * @deprecated Use nodeMode store instead
 */
export const selectedMode: Readable<null> = derived(onboardingState, () => null);

/**
 * @deprecated Use nodeMode.isObserverMode instead
 */
export const isObserverMode: Readable<boolean> = derived(onboardingState, () => false);

/**
 * @deprecated Use nodeMode.isValidateLiteMode instead
 */
export const isValidateLiteMode: Readable<boolean> = derived(onboardingState, () => false);

/**
 * @deprecated Use nodeMode.isValidateArchivalMode instead
 */
export const isValidateArchivalMode: Readable<boolean> = derived(onboardingState, () => false);

/**
 * @deprecated Use nodeMode.isValidateMode instead
 */
export const isValidateMode: Readable<boolean> = derived(onboardingState, () => false);

/**
 * @deprecated No longer used - step flow removed
 */
export type OnboardingStep = 'welcome' | 'complete';

/**
 * @deprecated No longer used - step flow removed
 */
export const currentStep: Readable<'complete'> = derived(
	onboardingState,
	() => 'complete' as const
);

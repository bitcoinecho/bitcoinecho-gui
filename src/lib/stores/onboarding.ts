/**
 * Bitcoin Echo GUI — Onboarding Store
 *
 * Manages first-run detection and user mode preference.
 * Session 2.1: First-Run Onboarding Flow
 *
 * Three operating modes:
 * - observe: Watch the network without storing anything
 * - validate-lite: Full validation with pruned storage (~10 GB)
 * - validate-archival: Full validation with complete block archive (~600 GB)
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

/**
 * User's chosen operating mode
 *
 * - 'observe': Watch without downloading (no storage)
 * - 'validate-lite': Download just enough (~10 GB pruned)
 * - 'validate-archival': Download everything (~600 GB full)
 */
export type NodeMode = 'observe' | 'validate-lite' | 'validate-archival' | null;

/**
 * Current step in the onboarding flow
 */
export type OnboardingStep = 'welcome' | 'validate-info' | 'complete';

/**
 * Onboarding state
 */
interface OnboardingState {
	hasCompletedOnboarding: boolean;
	currentStep: OnboardingStep;
	selectedMode: NodeMode;
}

/**
 * LocalStorage keys
 */
const STORAGE_KEY_COMPLETED = 'bitcoin-echo-onboarding-completed';
const STORAGE_KEY_MODE = 'bitcoin-echo-mode';

/**
 * Load initial state from localStorage
 */
function loadInitialState(): OnboardingState {
	if (typeof window === 'undefined') {
		return {
			hasCompletedOnboarding: false,
			currentStep: 'welcome',
			selectedMode: null
		};
	}

	const completed = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
	const mode = localStorage.getItem(STORAGE_KEY_MODE) as NodeMode;

	return {
		hasCompletedOnboarding: completed,
		currentStep: completed ? 'complete' : 'welcome',
		selectedMode: mode
	};
}

/**
 * Internal onboarding state store
 */
const onboardingState: Writable<OnboardingState> = writable(loadInitialState());

/**
 * Save state to localStorage
 */
function saveState(state: OnboardingState): void {
	if (typeof window === 'undefined') return;

	if (state.hasCompletedOnboarding) {
		localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
	}
	if (state.selectedMode) {
		localStorage.setItem(STORAGE_KEY_MODE, state.selectedMode);
	}
}

/**
 * Public onboarding store interface
 */
export const onboarding = {
	subscribe: onboardingState.subscribe,

	/**
	 * Select observe mode (immediate completion)
	 */
	selectObserve(): void {
		onboardingState.update((s) => {
			const newState = {
				...s,
				selectedMode: 'observe' as NodeMode,
				currentStep: 'complete' as OnboardingStep,
				hasCompletedOnboarding: true
			};
			saveState(newState);
			return newState;
		});
	},

	/**
	 * Select validate-lite mode (shows info about pruned storage)
	 */
	selectValidateLite(): void {
		onboardingState.update((s) => ({
			...s,
			selectedMode: 'validate-lite' as NodeMode,
			currentStep: 'validate-info' as OnboardingStep
		}));
	},

	/**
	 * Select validate-archival mode (shows info about full storage)
	 */
	selectValidateArchival(): void {
		onboardingState.update((s) => ({
			...s,
			selectedMode: 'validate-archival' as NodeMode,
			currentStep: 'validate-info' as OnboardingStep
		}));
	},

	/**
	 * Complete the validate info step
	 */
	completeValidateInfo(): void {
		onboardingState.update((s) => {
			const newState = {
				...s,
				currentStep: 'complete' as OnboardingStep,
				hasCompletedOnboarding: true
			};
			saveState(newState);
			return newState;
		});
	},

	/**
	 * Go back to welcome step
	 */
	goBack(): void {
		onboardingState.update((s) => ({
			...s,
			currentStep: 'welcome' as OnboardingStep,
			selectedMode: null
		}));
	},

	/**
	 * Show onboarding again (keeps saved preference)
	 */
	showAgain(): void {
		onboardingState.update((s) => ({
			...s,
			hasCompletedOnboarding: false,
			currentStep: 'welcome'
		}));
	},

	/**
	 * Reset onboarding (for testing/debugging)
	 */
	reset(): void {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY_COMPLETED);
			localStorage.removeItem(STORAGE_KEY_MODE);
		}
		onboardingState.set({
			hasCompletedOnboarding: false,
			currentStep: 'welcome',
			selectedMode: null
		});
	},

	/**
	 * Get current mode preference
	 */
	getMode(): NodeMode {
		return get(onboardingState).selectedMode;
	}
};

/**
 * Derived store: Should show onboarding?
 */
export const showOnboarding: Readable<boolean> = derived(
	onboardingState,
	($state) => !$state.hasCompletedOnboarding
);

/**
 * Derived store: Current onboarding step
 */
export const currentStep: Readable<OnboardingStep> = derived(
	onboardingState,
	($state) => $state.currentStep
);

/**
 * Derived store: Selected mode
 */
export const selectedMode: Readable<NodeMode> = derived(
	onboardingState,
	($state) => $state.selectedMode
);

/**
 * Derived store: Is in observer mode?
 */
export const isObserverMode: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.selectedMode === 'observe'
);

/**
 * Derived store: Is in validate-lite mode (pruned)?
 */
export const isValidateLiteMode: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.selectedMode === 'validate-lite'
);

/**
 * Derived store: Is in validate-archival mode (full)?
 */
export const isValidateArchivalMode: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.selectedMode === 'validate-archival'
);

/**
 * Derived store: Is in any validate mode (lite or archival)?
 */
export const isValidateMode: Readable<boolean> = derived(
	onboardingState,
	($state) => $state.selectedMode === 'validate-lite' || $state.selectedMode === 'validate-archival'
);

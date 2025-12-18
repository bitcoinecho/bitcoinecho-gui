/**
 * Bitcoin Echo GUI — Theme Store
 *
 * Manages light/dark theme state with localStorage persistence
 * and system preference detection.
 *
 * Session 1.3: Theme Support
 */

import { writable, derived } from 'svelte/store';
import type { Readable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bitcoin-echo-theme';

/**
 * Get initial theme from localStorage or system preference
 */
function getInitialTheme(): Theme {
	if (typeof window === 'undefined') return 'dark';

	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') {
		return saved;
	}

	// Fall back to system preference
	if (window.matchMedia('(prefers-color-scheme: light)').matches) {
		return 'light';
	}

	return 'dark';
}

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;

	document.documentElement.setAttribute('data-theme', theme);

	// Update theme-color meta tag
	const themeColor = theme === 'dark' ? '#0a0a0a' : '#f8f6f3';
	const metaThemeColor = document.querySelector('meta[name="theme-color"]');
	if (metaThemeColor) {
		metaThemeColor.setAttribute('content', themeColor);
	}
}

/**
 * Internal theme store
 */
const themeStore = writable<Theme>('dark');

// Initialize on client
if (typeof window !== 'undefined') {
	const initial = getInitialTheme();
	themeStore.set(initial);
	applyTheme(initial);
}

/**
 * Public theme interface
 */
export const theme = {
	subscribe: themeStore.subscribe,

	/**
	 * Set theme explicitly
	 */
	set(newTheme: Theme): void {
		themeStore.set(newTheme);
		applyTheme(newTheme);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, newTheme);
		}
	},

	/**
	 * Toggle between light and dark
	 */
	toggle(): void {
		themeStore.update((current) => {
			const newTheme = current === 'dark' ? 'light' : 'dark';
			applyTheme(newTheme);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, newTheme);
			}
			return newTheme;
		});
	},

	/**
	 * Initialize theme (call in onMount)
	 */
	init(): void {
		const initial = getInitialTheme();
		themeStore.set(initial);
		applyTheme(initial);
	}
};

/**
 * Derived store: Is dark mode?
 */
export const isDark: Readable<boolean> = derived(themeStore, ($theme) => $theme === 'dark');

/**
 * Derived store: Is light mode?
 */
export const isLight: Readable<boolean> = derived(themeStore, ($theme) => $theme === 'light');

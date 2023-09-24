import { writable } from 'svelte/store';
import type { Event as NostrEvent } from 'nostr-tools';

export const storedLoginpubkey = writable('');
export const storedRelaysSelected = writable('default');
export const storedRelaysToUse = writable({});
export const storedTheme = writable('');

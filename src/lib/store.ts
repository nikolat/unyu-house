import { writable } from 'svelte/store';
import type { Event as NostrEvent } from 'nostr-tools';

export const storedLoginpubkey = writable('');
export const storedUseRelaysNIP07 = writable(false);
export const storedRelaysToUse = writable({});
export const storedTheme = writable('');
export const storedMuteList = writable<string[]>([]);
export const storedFavList = writable<string[]>([]);
export const storedFavedList = writable<NostrEvent[]>([]);

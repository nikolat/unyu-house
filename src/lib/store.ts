import type { nip19 } from 'nostr-tools';
import { writable, type Writable } from 'svelte/store';

export const storedLoginpubkey = writable('');
export const storedRelaysSelected = writable('default');
export const storedRelaysToUse = writable({});
export const storedTheme = writable('');
export const storedNeedApplyRelays = writable(false);
export const storedCurrentChannelId: Writable<string | null> = writable('');
export const storedCurrentPubkey: Writable<string | null> = writable('');
export const storedCurrentEvent: Writable<nip19.EventPointer | null> = writable(null);

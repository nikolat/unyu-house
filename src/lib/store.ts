import type { NostrEvent } from 'nostr-tools/pure';
import type { EventPointer } from 'nostr-tools/nip19';
import { writable, type Writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import { urlDefaultTheme } from './util';

export const storedFilterSelected = writable('default');
export const storedRelaysToUse = writable({});
export const storedNeedApplyRelays = writable(false);
export const storedCurrentChannelId: Writable<string | null> = writable('');
export const storedCurrentPubkey: Writable<string | null> = writable('');
export const storedCurrentEvent: Writable<EventPointer | null> = writable(null);
export const storedCurrentHashtag: Writable<string | null> = writable('');
export const storedEvents: Writable<NostrEvent[]> = writable([]);

export const preferences = persisted('preferences', {
	theme: urlDefaultTheme,
	loginPubkey: '',
	isLoggedin: false,
	relaysSelected: 'default'
});

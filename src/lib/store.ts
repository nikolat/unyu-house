import type { nip19, Event as NostrEvent } from 'nostr-tools';
import { writable, type Writable } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import { urlDefaultTheme } from './util';

export const storedIsLoggedin = writable(false);
export const storedLoginpubkey = writable('');
export const storedRelaysSelected = writable('default');
export const storedFilterSelected = writable('default');
export const storedRelaysToUse = writable({});
export const storedNeedApplyRelays = writable(false);
export const storedCurrentChannelId: Writable<string | null> = writable('');
export const storedCurrentPubkey: Writable<string | null> = writable('');
export const storedCurrentEvent: Writable<nip19.EventPointer | null> = writable(null);
export const storedCurrentHashtag: Writable<string | null> = writable('');
export const storedEvents: Writable<NostrEvent[]> = writable([]);

export const preferences = persisted('preferences', {
    theme: urlDefaultTheme
});

<script lang='ts'>
import { onMount } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { storedCurrentChannelId, storedCurrentPubkey, storedCurrentHashtag, storedCurrentEvent, storedNeedApplyRelays } from '$lib/store';
import { nip19 } from 'nostr-tools';
import Page from '$lib/components/Page.svelte';

const currentChannelId = null;
const currentHashtag = null;
const currentEvent = null;

export let data: any;
let currentPubkey: string;

const getPubkey = (urlId: string): string => {
	if (/^nprofile/.test(urlId)) {
		const d = nip19.decode(urlId);
		if (d.type === 'nprofile') {
			return d.data.pubkey;
		}
		else {
			throw new TypeError(`"${urlId}" must be npub`);
		}
	}
	else {
		throw new TypeError(`"${urlId}" has no pubkey`);
	}
};

onMount(() => {
	currentPubkey = getPubkey(data.params.id);
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedCurrentHashtag.set(currentHashtag);
	storedCurrentEvent.set(currentEvent);
});
afterNavigate(() => {
	currentPubkey = getPubkey(data.params.id);
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedCurrentHashtag.set(currentHashtag);
	storedCurrentEvent.set(currentEvent);
	storedNeedApplyRelays.set(true);
});
</script>

<Page />

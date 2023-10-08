<script lang='ts'>
import { onMount } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { storedCurrentChannelId, storedCurrentPubkey, storedNeedApplyRelays } from '$lib/store';
import { nip19 } from 'nostr-tools';
import Page from '../Page.svelte';

const currentChannelId = null;

export let data: any;
let currentPubkey: string;

const getPubkey = (urlId: string) => {
	if (/^npub/.test(urlId)) {
		const d = nip19.decode(urlId);
		if (d.type === 'npub') {
			return d.data;
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
});
afterNavigate(() => {
	currentPubkey = getPubkey(data.params.id);
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedNeedApplyRelays.set(true);
});
</script>

<Page />

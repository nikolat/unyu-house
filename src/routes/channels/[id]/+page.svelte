<script lang='ts'>
import { onMount } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { storedCurrentChannelId, storedCurrentPubkey, storedNeedApplyRelays } from '$lib/store';
import { nip19 } from 'nostr-tools';
import Page from '$lib/components/Page.svelte';

const currentPubkey = null;

export let data: any;
let currentChannelId: string;

const getChannelId = (urlId: string) => {
	if (/^(nevent|note)/.test(urlId)) {
		const d = nip19.decode(urlId);
		if (d.type === 'nevent') {
			return d.data.id
		}
		else if (d.type === 'note') {
			return d.data;
		}
		else {
			throw new TypeError(`"${urlId}" must be nevent or note`);
		}
	}
	else if (urlId.length === 64) {
		return urlId;
	}
	else {
		throw new TypeError(`"${urlId}" has no channel id`);
	}
};

onMount(() => {
	currentChannelId = getChannelId(data.params.id);
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	const input = document.getElementById('input');
	input?.classList.remove('show');
});
afterNavigate(() => {
	currentChannelId = getChannelId(data.params.id);
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedNeedApplyRelays.set(true);
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	input?.classList.remove('show');
	if (sidebar && main && input) {
		sidebar.style.width = '0%';
		main.style.width = 'calc(100vw - (100vw - 100%))';
		input.style.visibility = 'visible';
	}
});
</script>

<Page />

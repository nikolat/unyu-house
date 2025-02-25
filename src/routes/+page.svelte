<script lang="ts">
	import { onMount } from 'svelte';
	import {
		storedCurrentChannelId,
		storedCurrentPubkey,
		storedCurrentHashtag,
		storedCurrentEvent,
		storedNeedApplyRelays
	} from '$lib/store';
	import Page from '$lib/components/Page.svelte';

	const currentChannelId = null;
	const currentPubkey = null;
	const currentHashtag = null;
	const currentEvent = null;

	onMount(() => {
		storedCurrentChannelId.set(currentChannelId);
		storedCurrentPubkey.set(currentPubkey);
		storedCurrentHashtag.set(currentHashtag);
		storedCurrentEvent.set(currentEvent);
		storedNeedApplyRelays.set(true);
	});
</script>

<Page />

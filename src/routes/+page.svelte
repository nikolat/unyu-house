<script lang='ts'>
import { onMount } from 'svelte';
import { storedCurrentChannelId, storedCurrentPubkey, storedCurrentEvent, storedNeedApplyRelays } from '$lib/store';
import Page from '$lib/components/Page.svelte';

const currentChannelId = null;
const currentPubkey = null;
const currentEvent = null;

onMount(() => {
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedCurrentEvent.set(currentEvent);
	storedNeedApplyRelays.set(true);
});
</script>

<Page />

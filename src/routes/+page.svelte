<script lang='ts'>
import { onMount } from 'svelte';
import { storedCurrentChannelId, storedCurrentPubkey, storedNeedApplyRelays } from '$lib/store';
import Page from '$lib/components/Page.svelte';

const currentChannelId = null;
const currentPubkey = null;

onMount(() => {
	storedCurrentChannelId.set(currentChannelId);
	storedCurrentPubkey.set(currentPubkey);
	storedNeedApplyRelays.set(true);
});
</script>

<Page />

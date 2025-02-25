<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import {
		storedCurrentChannelId,
		storedCurrentPubkey,
		storedCurrentEvent,
		storedNeedApplyRelays,
		storedCurrentHashtag
	} from '$lib/store';
	import Page from '$lib/components/Page.svelte';

	const currentChannelId = null;
	const currentEvent = null;
	const currentPubkey = null;

	interface Props {
		data: any;
	}

	let { data }: Props = $props();
	let currentHashtag: string;

	onMount(() => {
		currentHashtag = data.params.id;
		storedCurrentChannelId.set(currentChannelId);
		storedCurrentPubkey.set(currentPubkey);
		storedCurrentHashtag.set(currentHashtag);
		storedCurrentEvent.set(currentEvent);
	});
	afterNavigate(() => {
		currentHashtag = data.params.id;
		storedCurrentChannelId.set(currentChannelId);
		storedCurrentPubkey.set(currentPubkey);
		storedCurrentHashtag.set(currentHashtag);
		storedCurrentEvent.set(currentEvent);
		storedNeedApplyRelays.set(true);
	});
</script>

<Page />

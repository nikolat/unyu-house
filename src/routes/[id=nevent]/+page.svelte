<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import {
		storedCurrentChannelId,
		storedCurrentPubkey,
		storedCurrentHashtag,
		storedCurrentEvent,
		storedNeedApplyRelays
	} from '$lib/store';
	import { nip19 } from 'nostr-tools';
	import Page from '$lib/components/Page.svelte';

	const currentChannelId = null;
	const currentHashtag = null;
	const currentPubkey = null;

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	let currentEvent: nip19.EventPointer;

	const getEvent = (urlId: string) => {
		if (/^nevent/.test(urlId)) {
			const d = nip19.decode(urlId);
			if (d.type === 'nevent') {
				return d.data;
			} else {
				throw new TypeError(`"${urlId}" must be nevent`);
			}
		} else {
			throw new TypeError(`"${urlId}" has no event`);
		}
	};

	onMount(() => {
		currentEvent = getEvent(data.params.id);
		storedCurrentChannelId.set(currentChannelId);
		storedCurrentPubkey.set(currentPubkey);
		storedCurrentHashtag.set(currentHashtag);
		storedCurrentEvent.set(currentEvent);
	});
	afterNavigate(() => {
		currentEvent = getEvent(data.params.id);
		storedCurrentChannelId.set(currentChannelId);
		storedCurrentPubkey.set(currentPubkey);
		storedCurrentHashtag.set(currentHashtag);
		storedCurrentEvent.set(currentEvent);
		storedNeedApplyRelays.set(true);
	});
</script>

<Page />

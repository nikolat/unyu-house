<script lang='ts'>
import { type Channel, type Profile, type GetRelays, getRelaysToUse, RelayConnector, urlDefaultTheme } from '$lib/util';
import type { NostrAPI } from '$lib/@types/nostr';
import { storedIsLoggedin, storedLoginpubkey, storedCurrentChannelId, storedCurrentPubkey, storedCurrentEvent, storedNeedApplyRelays, storedRelaysToUse, storedTheme } from '$lib/store';
import { defaultRelays, title } from '$lib/config';
import { browser } from '$app/environment';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import { afterUpdate, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { SimplePool, nip19, type Event as NostrEvent, type Sub, type Filter } from 'nostr-tools';
import Sidebar from './Sidebar.svelte';
import Header from './Header.svelte';
import ChannelMetadata from './ChannelMetadata.svelte';
import ProfileMetadata from './ProfileMetadata.svelte';
import Timeline from './Timeline.svelte';
import Post from './Post.svelte';

interface Window {
	nostr?: NostrAPI;
}

let pool: SimplePool = new SimplePool();
let subNotes: Sub<7|40|41|42|10000|10001>;
let relaysToUse: {[key: string]: GetRelays};
let theme: string;
let currentChannelId: string | null;
let currentPubkey: string | null;
let currentEvent: nip19.EventPointer | null;
let isLoggedin: boolean;
let loginPubkey: string;
let muteList: string[] = [];
let muteChannels: string[] = [];
let wordList: string[] = [];
let pinList: string[] = [];
let favList: NostrEvent[] = [];
let channels: Channel[] = [];
let notes: NostrEvent[] = [];
let notesQuoted: NostrEvent[] = [];
let profs: {[key: string]: Profile} = {};
let unsubscribeApplyRelays: Unsubscriber | null;
let scrolled: boolean = false;
storedRelaysToUse.subscribe((value) => {
	relaysToUse = value;
});
storedTheme.subscribe((value) => {
	theme = value;
});
storedCurrentChannelId.subscribe((value) => {
	currentChannelId = value;
});
storedCurrentPubkey.subscribe((value) => {
	currentPubkey = value;
});
storedCurrentEvent.subscribe((value) => {
	currentEvent = value;
});
storedIsLoggedin.subscribe((value) => {
	isLoggedin = value;
});
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});

const resetScroll = () => {
	scrolled = false;
};

const callbackPhase1 = async (loginPubkey: string, channelsNew: Channel[], notesNew: NostrEvent[], event10000: NostrEvent<10000> | null, pinListNew: string[]) => {
	channels = channelsNew;
	if (currentChannelId) {
		notes = notesNew.filter(ev => ev.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root'));
	}
	else {
		notes = notesNew;
	}
	muteList = event10000?.tags.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1]) ?? [];
	muteChannels = event10000?.tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]) ?? [];
	wordList = event10000?.tags.filter(tag => tag.length >= 2 && tag[0] === 'word').map(tag => tag[1]) ?? [];
	const nostr = (window as Window).nostr;
	if (isLoggedin && loginPubkey && event10000?.content && browser && nostr?.nip04?.decrypt) {
		try {
			const content = await nostr.nip04.decrypt(loginPubkey, event10000.content);
			const list: string[][] = JSON.parse(content);
			muteList = muteList.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1]));
			muteChannels = muteChannels.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]));
			wordList = wordList.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'word').map(tag => tag[1]));
		} catch (error) {
			console.warn(error);
		}
	}
	pinList = pinListNew;
};

const callbackPhase2 = (profsNew: {[key: string]: Profile}, favListNew: NostrEvent[], eventsQuotedNew: NostrEvent[]) => {
	let profAdded = false;
	for (const k of Object.keys(profsNew)) {
		if (!(k in profs)) {
			profs[k] = profsNew[k];
			profAdded = true;
		}
	}
	if (profAdded) {
		profs = profs;
	}
	let favAdded = false;
	for (const ev of favListNew) {
		if (!favList.map(v => v.id).includes(ev.id)) {
			favList.push(ev);
			favAdded = true;
		}
	}
	if (favAdded) {
		favList = favList;
	}
	let notesQuotedAdded = false;
	for (const ev of eventsQuotedNew) {
		if (!notesQuoted.map(ev => ev.id).includes(ev.id)) {
			notesQuoted.push(ev);
			notesQuotedAdded = true;
		}
	}
	if (notesQuotedAdded) {
		notesQuoted = notesQuoted;
	}
};

const callbackPhase3 = (subNotesPhase3: Sub<7|40|41|42|10000|10001>, ev: NostrEvent<7|40|41|42|10000|10001>) => {
	subNotes = subNotesPhase3;
	if (ev.kind === 42 && !notes.map(v => v.id).includes(ev.id)) {
		if (currentChannelId) {
			if (ev.tags.some(tag => tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root')) {
				notes.push(ev);
				notes = notes;
			}
		}
		else {
			notes.push(ev);
			notes = notes;
		}
	}
	else if (ev.kind === 7 && !favList.map(v => v.id).includes(ev.id)) {
		favList.push(ev);
		favList = favList;
	}
	else if (ev.kind === 10000) {
		if (ev.pubkey !== loginPubkey)
			return;
		muteChannels = ev.tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]);
	}
	else if (ev.kind === 10001) {
		if (ev.pubkey !== loginPubkey)
			return;
		pinList = ev.tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]);
	}
	else if (ev.kind === 40 && !channels.map(v => v.event.id).includes(ev.id)) {
		let channel: Channel;
		try {
			channel = JSON.parse(ev.content);
		} catch (error) {
			console.warn(error);
			return;
		}
		channel.updated_at = ev.created_at;
		channel.event = ev;
		channels = [channel, ...channels];
	}
	else if (ev.kind === 41) {
		const id = ev.tags.find(tag => tag.length >= 2 && tag[0] === 'e')?.at(1);
		const currentChannel = channels.find(channel => channel.event.id === id);
		if (currentChannel === undefined) {
			return
		}
		if (ev.pubkey !== currentChannel.event.pubkey || ev.created_at <= currentChannel.updated_at) {
			return;
		}
		let newChannel: Channel;
		try {
			newChannel = JSON.parse(ev.content);
		} catch (error) {
			console.warn(error);
			return;
		}
		newChannel.updated_at = ev.created_at;
		newChannel.event = currentChannel.event;
		channels = [newChannel, ...channels.filter(channel => channel.event.id !== id)];
	}
};

const importRelays = (relaysSelected: string) => {
	getRelaysToUse(relaysSelected, pool, loginPubkey)
		.then((relaysToUseBack: {[key: string]: GetRelays}) => {
			relaysToUse = relaysToUseBack;
			storedRelaysToUse.set(relaysToUse);
			applyRelays();
		})
		.catch((error) => {
			console.warn(error);
		});
};

const applyRelays = () => {
	storedNeedApplyRelays.set(false);
	resetScroll();
	channels = [];
	notes = [];
	notesQuoted = [];
	profs = {};
	muteList = [];
	muteChannels = [];
	pinList = [];
	favList = [];
	subNotes?.unsub();
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	let filter: Filter<42>;
	const limit = 100;
	if (currentChannelId) {
		filter = {kinds: [42], limit: limit, '#e': [currentChannelId]};
	}
	else if (currentPubkey) {
		filter = {kinds: [42], limit: limit, authors: [currentPubkey]};
	}
	else if (currentEvent) {
		filter = {ids: [currentEvent.id]};
	}
	else {
		filter = {kinds: [42], limit: limit};
	}
	const rc = new RelayConnector(pool, relaysToRead, loginPubkey, filter, callbackPhase1, callbackPhase2, callbackPhase3);
	rc.getEventsPhase1();
};

onMount(() => {
	if (!unsubscribeApplyRelays) {
		unsubscribeApplyRelays = storedNeedApplyRelays.subscribe((value) => {
			if (value === true) {
				applyRelays();
			}
		});
	}
	if (Object.keys(relaysToUse).length === 0) {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
});
onDestroy(() => {
	if (unsubscribeApplyRelays) {
		unsubscribeApplyRelays();
		unsubscribeApplyRelays = null;
	}
	subNotes?.unsub();
	pool?.close(Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]));
});
afterUpdate(() => {
	if (!scrolled) {
		if (document.querySelectorAll('main dl dt').length === 0) {
			return;
		}
		const main = document.getElementsByTagName('main')[0];
		main.scroll(0, main.scrollHeight);
		scrolled = true;
	}
});
beforeNavigate(() => {
	subNotes?.unsub();
	if (unsubscribeApplyRelays) {
		unsubscribeApplyRelays();
		unsubscribeApplyRelays = null;
	}
});
afterNavigate(() => {
	if (!unsubscribeApplyRelays) {
		unsubscribeApplyRelays = storedNeedApplyRelays.subscribe((value) => {
			if (value === true) {
				applyRelays();
			}
		});
	}
	if (Object.keys(relaysToUse).length === 0) {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
});

const hidePostBar = () => {
	document.getElementById('input')?.classList.remove('show');
}

$: titleString = currentChannelId ? `${channels.find(v => v.event.id === currentChannelId)?.name ?? '(unknown channel)'} | ${title}`
	: currentPubkey ? `${profs[currentPubkey]?.name ?? '(unknown profile)'} | ${title}`
	: title;

</script>

<svelte:head>
	<title>{titleString}</title>
	<link rel="stylesheet" href="{theme || urlDefaultTheme}">
</svelte:head>
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div id="container" on:click={hidePostBar}>
	<Header {title} {profs} {loginPubkey} />
	<Sidebar {pool} {theme} {relaysToUse} {isLoggedin} {loginPubkey} {channels} {profs} {importRelays} {pinList} {muteList} {muteChannels} {wordList} />
	<main>
	{#if currentChannelId}
		{@const channel = channels.find(v => v.event.id === currentChannelId)}
		{#if channel}
		<ChannelMetadata {channel} {pool} {profs} {isLoggedin} {loginPubkey} {relaysToUse} isQuote={false} {pinList} {muteChannels} />
		{:else}
		<h2>Channel View</h2>
		{/if}
	{:else if currentPubkey}
		{#if profs[currentPubkey]}
		<ProfileMetadata {pool} {profs} {currentPubkey} {isLoggedin} {loginPubkey} {relaysToUse} {muteList} />
		{:else}
		<h2>Profile View</h2>
		{/if}
	{:else if currentEvent}
		{@const rootId = notes.at(0)?.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1)}
		{@const channel = channels.find(v => v.event.id === rootId)}
		{#if channel}
		<ChannelMetadata {channel} {pool} {profs} {isLoggedin} {loginPubkey} {relaysToUse} isQuote={false} {pinList} {muteChannels} />
		{:else}
		<h2>Event View</h2>
		{/if}
	{:else if currentChannelId === null && currentPubkey === null && currentEvent === null}
		<h2>Global timeline</h2>
	{:else}
		<h2>Error</h2>
	{/if}
		<Timeline {pool} relaysToWrite={Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0])} {notes} {notesQuoted} {profs} {channels} {isLoggedin} {loginPubkey} {muteList} {muteChannels} {wordList} {favList} {resetScroll} {importRelays} />
	{#if currentChannelId && isLoggedin && channels.some(channel => channel.event.id === currentChannelId)}
		<Post {pool} {currentChannelId} {relaysToUse} {channels} {hidePostBar} {resetScroll} />
	{/if}
	</main>
</div>

<style>
:global(html) {
	width: 100%;
	height: 100%;
}
:global(html > body) {
	width: 100%;
	height: 100%;
	margin-top: 0;
	padding: 0;
	max-width: 100%;
}
#container {
	width: 100%;
	height: 100%;
	display: flex;
	overflow: hidden;
}
main {
	margin-top: 3em;
	padding: 0 5px;
	width: calc(100vw - (100vw - 100%));
	height: calc(100% - 3em);
	overflow-x: hidden;
	overflow-y: scroll;
	word-break: break-all;
}
:global(#container.dark #show-post-bar) {
	fill: white;
}
:global(#container.light #show-post-bar) {
	fill: black;
}
</style>

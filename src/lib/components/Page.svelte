<script lang='ts'>
import { type Channel, type Profile, type GetRelays, getRelaysToUse, RelayConnector, urlDefaultTheme } from '$lib/util';
import type { NostrAPI } from '$lib/@types/nostr';
import { storedIsLoggedin, storedLoginpubkey, storedCurrentChannelId, storedCurrentPubkey, storedCurrentHashtag, storedCurrentEvent, storedNeedApplyRelays, storedRelaysToUse, preferences, storedEvents } from '$lib/store';
import { defaultRelays, title } from '$lib/config';
import { browser } from '$app/environment';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import { afterUpdate, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { SimplePool, nip19, type Event as NostrEvent, type Sub, type Filter, utils, verifySignature } from 'nostr-tools';
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
let subNotes: Sub<0|7|16|40|41|42|10000|10001|10005>;
let relaysToUse: {[key: string]: GetRelays};
let theme: string;
let currentChannelId: string | null;
let currentPubkey: string | null;
let currentEvent: nip19.EventPointer | null;
let currentHashtag: string | null;
let isLoggedin: boolean;
let loginPubkey: string;
let muteList: string[] = [];
let muteChannels: string[] = [];
let wordList: string[] = [];
let pinList: string[] = [];
let repostList: NostrEvent[] = [];
let favList: NostrEvent[] = [];
let zapList: NostrEvent[] = [];
let channels: Channel[] = [];
let notes: NostrEvent[] = [];
let notesQuoted: NostrEvent[] = [];
let profs: {[key: string]: Profile} = {};
let unsubscribeApplyRelays: Unsubscriber | null;
let scrolled: boolean = false;
let eventsAll: NostrEvent[] = [];
storedRelaysToUse.subscribe((value) => {
	relaysToUse = value;
});
preferences.subscribe((value: { theme: string; }) => {
	theme = value.theme ?? theme;
	if (browser) {
		(document.querySelector('link[rel=stylesheet]') as HTMLLinkElement).href = theme ?? $preferences.theme;
	}
});
storedCurrentChannelId.subscribe((value) => {
	currentChannelId = value;
});
storedCurrentPubkey.subscribe((value) => {
	currentPubkey = value;
});
storedCurrentHashtag.subscribe((value) => {
	currentHashtag = value;
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
storedEvents.subscribe((value) => {
	eventsAll = value;
});

const resetScroll = () => {
	scrolled = false;
};
const execScroll = () => {
	if (document.querySelectorAll('main dl dt').length === 0) {
		return;
	}
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
	scrolled = true;
};

const callbackEvent = async (event: NostrEvent, redraw: boolean = true) => {
	if (eventsAll.some(ev => ev.id === event.id)) {
		return;
	}
	if (eventsAll.some(ev => [0, 41, 10000, 10005].includes(ev.kind) && ev.kind === event.kind && ev.pubkey === event.pubkey && ev.created_at >= event.created_at)) {
		return;
	}
	eventsAll = utils.insertEventIntoAscendingList(eventsAll, event);
	storedEvents.set(eventsAll);
	if (redraw)
		console.info(`kind:${event.kind}`);
	switch (event.kind) {
		case 0:
			try {
				profs[event.pubkey] = JSON.parse(event.content);
			} catch (error) {
				console.warn(error);
				return;
			}
			profs[event.pubkey].created_at = event.created_at;
			profs[event.pubkey].tags = event.tags;
			if (redraw)
				profs = profs;
			break;
		case 7:
			if (redraw)
				favList = utils.insertEventIntoAscendingList(favList, event);
			else
				favList.unshift(event);
			const targetChannel7 = channels.find(channel => channel.event.id === event.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1));
			if (targetChannel7 !== undefined) {
				targetChannel7.fav_count++;
				if (redraw)
					channels = channels;
			}
			break;
		case 16:
			let isRepostToShow = false;
			if (currentChannelId) {
				const baseevent = notes.find(note => note.id === event.tags.find(tag => tag.length >= 2 && tag[0] === 'e')?.at(1));
				isRepostToShow = baseevent?.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root') ?? false;
			}
			else if (currentPubkey) {
				isRepostToShow = event.pubkey === currentPubkey;
			}
			else if (currentHashtag) {
				isRepostToShow = false;
			}
			else if (currentEvent) {
				isRepostToShow = false;
			}
			else {
				isRepostToShow = true;
			}
			if (!isRepostToShow)
				return;
			if (redraw)
				repostList = utils.insertEventIntoAscendingList(repostList, event);
			else
				repostList.unshift(event);
			break;
		case 40:
			let channel: Channel;
			try {
				channel = JSON.parse(event.content);
			} catch (error) {
				console.warn(error);
				return;
			}
			channel.updated_at = event.created_at;
			channel.event = event;
			channel.post_count = notes.filter(ev => ev.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === event.id && tag[3] === 'root')).length;
			channel.fav_count = favList.filter(ev => ev.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === event.id && tag[3] === 'root')).length;
			if (redraw)
				channels = getSortedChannels([channel, ...channels]);
			else
				channels.unshift(channel);
			break;
		case 41:
			const id = event.tags.find(tag => tag.length >= 2 && tag[0] === 'e')?.at(1);
			const targetChannel41 = channels.find(channel => channel.event.id === id);
			if (targetChannel41 === undefined) {
				return;
			}
			if (event.pubkey !== targetChannel41.event.pubkey || event.created_at <= targetChannel41.updated_at) {
				return;
			}
			let newChannel: Channel;
			try {
				newChannel = JSON.parse(event.content);
			} catch (error) {
				console.warn(error);
				return;
			}
			newChannel.updated_at = event.created_at;
			newChannel.event = targetChannel41.event;
			newChannel.post_count = notes.filter(ev => ev.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === id && tag[3] === 'root')).length;
			newChannel.fav_count = favList.filter(ev => ev.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === id && tag[3] === 'root')).length;
			if (redraw)
				channels = getSortedChannels([newChannel, ...channels.filter(channel => channel.event.id !== id)]);
			else {
				channels.splice(channels.findIndex(channel => channel.event.id === id), 1, newChannel);
			}
			break;
		case 42:
			let isQuote = false;
			if (currentChannelId) {
				isQuote = !event.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root');
			}
			else if (currentPubkey) {
				isQuote = event.pubkey !== currentPubkey;
			}
			else if (currentHashtag) {
				isQuote = !event.tags.some(tag => tag.length >= 2 && tag[0] === 't' && tag[1] === currentHashtag);
			}
			else if (currentEvent) {
				isQuote = event.id !== currentEvent.id;
			}
			if (redraw) {
				if (isQuote) {
					notesQuoted = utils.insertEventIntoAscendingList(notesQuoted, event);
				}
				else {
					notes = utils.insertEventIntoAscendingList(notes, event);
				}
			}
			else {
				if (isQuote) {
					notesQuoted.unshift(event);
				}
				else {
					notes.unshift(event);
				}
			}
			const targetChannel42 = channels.find(channel => channel.event.id === event.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1));
			if (targetChannel42 !== undefined) {
				targetChannel42.post_count++;
			}
			if (redraw) {
				channels = channels;
				execScroll();
			}
			break;
		case 9735:
			let event9734;
			try {
				event9734 = JSON.parse(event.tags.find(tag => tag[0] === 'description')?.at(1) ?? '{}');
			} catch (error) {
				//console.warn(error);
				return;
			}
			if (!verifySignature(event9734)) {
				return;
			}
			if (redraw)
				zapList = utils.insertEventIntoAscendingList(zapList, event);
			else
				zapList.unshift(event);
			break;
		case 10000:
			muteList = event.tags.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1]) ?? [];
			muteChannels = event.tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]) ?? [];
			wordList = event.tags.filter(tag => tag.length >= 2 && tag[0] === 'word').map(tag => tag[1]) ?? [];
			const nostr = (window as Window).nostr;
			if (isLoggedin && loginPubkey && event.content && browser && nostr?.nip04?.decrypt) {
				try {
					const content = await nostr.nip04.decrypt(loginPubkey, event.content);
					const list: string[][] = JSON.parse(content);
					muteList = muteList.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1]));
					muteChannels = muteChannels.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]));
					wordList = wordList.concat(list.filter(tag => tag.length >= 2 && tag[0] === 'word').map(tag => tag[1]));
				} catch (error) {
					console.warn(error);
				}
			}
			break;
		case 10005:
			pinList = event.tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]);
			break;
		default:
			if (redraw)
				notesQuoted = utils.insertEventIntoAscendingList(notesQuoted, event);
			else
				notesQuoted.unshift(event);
			break;
	}
};

const getSortedChannels = (channelArray: Channel[]) => {
	channelArray.sort((a, b) => {
		if (a.updated_at < b.updated_at) {
			return 1;
		}
		if (a.updated_at > b.updated_at) {
			return -1;
		}
		return 0;
	});
	return channelArray;
};

const callbackPhase3 = (subNotesPhase3: Sub<0|7|16|40|41|42|10000|10001|10005>, ev: NostrEvent<0|7|16|40|41|42|10000|10001|10005>) => {
	subNotes = subNotesPhase3;
	callbackEvent(ev);
};

const importRelays = (relaysSelected: string) => {
	eventsAll = [];
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

const applyRelays = async () => {
	storedNeedApplyRelays.set(false);
	resetScroll();
	channels = [];
	notes = [];
	notesQuoted = [];
	profs = {};
	muteList = [];
	muteChannels = [];
	pinList = [];
	repostList = [];
	favList = [];
	zapList = [];
	let eventCopy: NostrEvent[] = [...eventsAll.filter(ev => [0, 1, 7, 16, 40, 41, 42, 9735].includes(ev.kind))];
	if (isLoggedin) {
		eventCopy = [...eventCopy, ...eventsAll.filter(ev => [10000, 10005].includes(ev.kind))]
	}
	subNotes?.unsub();
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	let filters: Filter<0|16|40|41|42>[];
	const limit = 50;
	const until = Math.floor(Date.now() / 1000);
	if (currentChannelId) {
		filters = [
			{kinds: [40], ids: [currentChannelId]},
			{kinds: [41], '#e': [currentChannelId]},
			{kinds: [42], '#e': [currentChannelId], until: until, limit: limit},
			{kinds: [16], '#k': ['42'], limit: limit, until: until}
		];
	}
	else if (currentPubkey) {
		filters = [
			{kinds: [0], authors: [currentPubkey]},
			{kinds: [42], authors: [currentPubkey], until: until, limit: limit},
			{kinds: [16], '#k': ['42'], authors: [currentPubkey], until: until, limit: limit}
		];
	}
	else if (currentHashtag) {
		filters = [
			{kinds: [42], '#t': [currentHashtag], until: until, limit: limit}
		];
	}
	else if (currentEvent) {
		filters = [
			{ids: [currentEvent.id]}
		];
		if (currentEvent.author !== undefined) {
			filters.push({kinds: [0], authors: [currentEvent.author]})
		}
	}
	else {
		filters = [
			{kinds: [42], until: until, limit: limit},
			{kinds: [16], '#k': ['42'], until: until, limit: limit}
		];
	}
	if (loginPubkey && currentPubkey !== loginPubkey || currentEvent && currentEvent.author === loginPubkey) {
		filters = [{kinds: [0], authors: [loginPubkey]}, ...filters];
	}
	eventsAll = [];
	storedEvents.set(eventsAll);
	for (const ev of eventCopy) {
		await callbackEvent(ev, false);
	}
	channels = getSortedChannels(channels);
	notes = notes;
	notesQuoted = notesQuoted;
	profs = profs;
	muteList = muteList;
	muteChannels = muteChannels;
	pinList = pinList;
	repostList = repostList;
	favList = favList;
	zapList = zapList;
	const rc = new RelayConnector(pool, relaysToRead, loginPubkey, filters, until, callbackPhase3, callbackEvent);
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
		execScroll();
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

$: repostListToShow = currentChannelId ? repostList.filter(ev16 => {
		const repostedEvent = [...notes, ...notesQuoted].find(ev => ev.id === ev16.tags.find(tag => tag.length >= 2 && tag[0] === 'e')?.at(1));
		return repostedEvent?.tags.some(tag => tag.length >= 4 && tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root');
	}) : repostList;

</script>

<svelte:head>
	<title>{titleString}</title>
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
	{:else if currentHashtag}
		<h2>Hashtag timeline</h2>
	{:else if currentEvent}
		{@const rootId = notes.at(0)?.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1)}
		{@const channel = channels.find(v => v.event.id === rootId)}
		{#if channel}
		<ChannelMetadata {channel} {pool} {profs} {isLoggedin} {loginPubkey} {relaysToUse} isQuote={false} {pinList} {muteChannels} />
		{:else}
		<h2>Event View</h2>
		{/if}
	{:else if currentChannelId === null && currentPubkey === null && currentHashtag === null && currentEvent === null}
		<h2>Global timeline</h2>
	{:else}
		<h2>Error</h2>
	{/if}
		<Timeline {pool} relaysToWrite={Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0])} {notes} {notesQuoted} {profs} {channels} {isLoggedin} {loginPubkey} {muteList} {muteChannels} {wordList} repostList={repostListToShow} {favList} {zapList} {resetScroll} {importRelays} />
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
:global(.nostr-zap-dialog input) {
	display: initial;
}
:global(dialog.nostr-zap-dialog) {
	background-color: white;
}
</style>

<script lang='ts'>

import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Sub,
	type Filter,
} from 'nostr-tools';
import { afterUpdate, onMount } from 'svelte';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import { storedLoginpubkey, storedUseRelaysNIP07, storedRelaysToUse, storedMuteList, storedFavList } from '$lib/store';
import Sidebar from '../../Sidebar.svelte';
import Timeline from '../../Timeline.svelte';
import Header from '../../Header.svelte';
import { getChannels, getNotes, getMuteList, getFavList, getFavedList, sendFav } from '$lib/util';

export let data: any;
let currentChannelId: string = data.params.id;
let currentChannelOwner: string | undefined;
if (/^nevent/.test(currentChannelId)) {
	const d = nip19.decode(currentChannelId);
	currentChannelId = (d.data as nip19.EventPointer).id
	currentChannelOwner = (d.data as nip19.EventPointer).author;
}

// とりあえずリレーは固定
const defaultRelays = {
	'wss://relay-jp.nostr.wirednet.jp': {'read': true, 'write': true},
	'wss://yabu.me': {'read': true, 'write': true},
}
let relaysToRead: string[] = [];
let relaysToWrite: string[] = [];

interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	id: string
	pubkey: string
	recommendedRelay: string
}

interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
	created_at: number
}

// kind:40を溜めておく keyはid
let channelEvents: NostrEvent[] = [];
let channels: Channel[] = [];
$: channels = channels;
// kind:41を溜めておく
let metadataEvents: NostrEvent[] = [];
// kind:42を溜めておく
let notes: NostrEvent[] = [];
$: notes = notes;
// 引用されたnoteを溜めておく
let notesQuoted: NostrEvent[] = [];
$: notesQuoted = notesQuoted;
// kind:0 プロフィール情報を溜めておく keyは公開鍵
let profs: {[key: string]: Profile} = {};
$: profs = profs;

let pool = new SimplePool();
let subNotes: Sub<42>;

let muteList: string[];
$: muteList = muteList;
storedMuteList.subscribe((value) => {
	muteList = value;
})
let favList: string[];
$: favList = favList;
storedFavList.subscribe((value) => {
	favList = value;
});
let favedList: NostrEvent[] = [];
$: favedList = favedList;

let loginPubkey: string;
$: loginPubkey = loginPubkey;
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});

let useRelaysNIP07: boolean;
$: useRelaysNIP07 = useRelaysNIP07;
storedUseRelaysNIP07.subscribe((value) => {
	useRelaysNIP07 = value;
});

let relaysToUse: object = {};
$: relaysToUse = relaysToUse;
storedRelaysToUse.subscribe((value) => {
	relaysToUse = value;
});

const importRelays = async() => {
	storedUseRelaysNIP07.set((<HTMLInputElement>document.getElementById('use-relay-nip07')).checked);
	if (useRelaysNIP07) {
		storedRelaysToUse.set(await (window as any).nostr.getRelays());
	}
	else {
		storedRelaysToUse.set(defaultRelays);
	}
	subNotes?.unsub();
	pool.close(relaysToRead);
	pool = new SimplePool();
	applyRelays();
};

const callbackMuteList = (muteListReturn: string[]) => {muteList = muteListReturn;};
const callbackFavList = (favListReturn: string[]) => {
	if (JSON.stringify(favList.toSorted()) !== JSON.stringify(favListReturn.toSorted())) {
		favList = favListReturn;
	}
};
const callbackFavedList = (favedListReturn: NostrEvent[]) => {
	favedList = favedListReturn;
};
const callbackProfile = (profileReturn: {[key: string]: Profile}) => {
	if (JSON.stringify(Object.keys(profs).toSorted()) !== JSON.stringify(Object.keys(profileReturn).toSorted())) {
		for (const k of Object.keys(profileReturn)) {
			if (!(k in profs)) {
				profs.k = profileReturn.k;
			}
		}
		profs = profs;
	}
};

const applyRelays = async() => {
	channelEvents = [];
	channels = [];
	metadataEvents = [];
	notes = [];
	profs = {};
	const relaysToReadSet = new Set<string>();
	const relaysToWriteSet = new Set<string>();
	for (const relay of Object.entries(relaysToUse)) {
		if (relay[1].read) {
			relaysToReadSet.add(relay[0]);
		}
		if (relay[1].write) {
			relaysToWriteSet.add(relay[0]);
		}
	}
	relaysToRead = Array.from(relaysToReadSet);
	relaysToWrite = Array.from(relaysToWriteSet);
	const filter: Filter<42>[] = [{kinds: [42], limit: 100, '#e': [currentChannelId]}];
	// チャンネルの取得
	getChannels(pool, channelEvents, relaysToRead, metadataEvents, channels, profs, (channelsRetuen: Channel[]) => {
		channels = channelsRetuen;
	}, callbackProfile).catch((e) => console.error(e));
	// 投稿の取得
	getNotes(pool, relaysToRead, subNotes, filter, notes, profs, (notesReturn: NostrEvent[]) => {
		notes = notesReturn;
		if (loginPubkey) {
			getFavList(pool, relaysToRead, loginPubkey, notes.map(v => v.id), callbackFavList);
			getFavedList(pool, relaysToRead, loginPubkey, notes.filter(v => v.pubkey === loginPubkey).map(v => v.id), callbackFavedList, callbackProfile);
		}
	}, callbackProfile, (notesReturn: NostrEvent[]) => {
		notesQuoted = notesReturn;
	}).catch((e) => console.error(e));
	if (loginPubkey) {
		getMuteList(pool, relaysToRead, loginPubkey, callbackMuteList);
	}
}

let inputText = '';
$: inputText = inputText;
const sendMessage = async() => {
	const content = inputText;
	inputText = '';
	const savedloginPubkey = loginPubkey;
	storedLoginpubkey.set('');
	const recommendedRelay: string = channels.filter(v => v.id === currentChannelId)[0].recommendedRelay;
	const tags = [['e', currentChannelId, recommendedRelay, 'root']];
	const matchesIteratorPubkey = content.matchAll(/(^|\W|\b)(nostr:(npub\w{59}))($|\W|\b)/g);
	const mentionPubkeys: Set<string> = new Set();
	for (const match of matchesIteratorPubkey) {
		const d = nip19.decode(match[3]);
		if (d.type === 'npub') {
			mentionPubkeys.add(d.data);
		}
	}
	for (const p of mentionPubkeys) {
		tags.push(['p', p, '']);
	}
	const matchesIteratorId = content.matchAll(/(^|\W|\b)(nostr:(note\w{59}|nevent\w+))($|\W|\b)/g);
	const mentionIds: Set<string> = new Set();
	for (const match of matchesIteratorId) {
		const d = nip19.decode(match[3]);
		if (d.type === 'note') {
			mentionIds.add(d.data);
		}
		else if (d.type === 'nevent') {
			mentionIds.add(d.data.id);
		}
	}
	for (const id of mentionIds) {
		tags.push(['e', id, '', 'mention']);
	}
	const baseEvent: UnsignedEvent = {
		kind: 42,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: content
	};
	const newEvent: NostrEvent = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
	storedLoginpubkey.set(savedloginPubkey);
}

let scrollPosition = 0;
onMount(() => {
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	main?.addEventListener('scroll', (e) => {
		const threshold = 200;
		if (main.scrollTop - scrollPosition > threshold) {
			input?.classList.remove('show');
			scrollPosition = main.scrollTop;
		}
		else if (scrollPosition - main.scrollTop > threshold) {
			input?.classList.add('show');
			scrollPosition = main.scrollTop;
		}
	});
});

beforeNavigate(() => {
	subNotes?.unsub();
});
afterNavigate(() => {
	currentChannelId = data.params.id;
	if (/^nevent/.test(currentChannelId)) {
		const d = nip19.decode(currentChannelId);
		currentChannelId = (d.data as nip19.EventPointer).id
		currentChannelOwner = (d.data as nip19.EventPointer).author;
	}
	channelEvents = [];
	channels = [];
	metadataEvents = [];
	notes = [];
	profs = {};
	if (!useRelaysNIP07)
		storedRelaysToUse.set(defaultRelays);
	applyRelays();
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	if (sidebar && main && input) {
		sidebar.style.width = '0%';
		main.style.width = 'calc(100vw - calc(100vw - 100%))';
		input.style.visibility = 'visible';
	}
});
afterUpdate(() => {
	if (document.activeElement?.tagName.toLowerCase() === 'textarea')
		return;
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});
</script>

<svelte:head>
	<title>{channels.filter(v => v.id === currentChannelId)[0]?.name ?? 'チャンネル情報不明'} | うにゅうハウス</title>
</svelte:head>
<div id="container">
	<Header />
	<Sidebar {pool} {relaysToUse} {loginPubkey} {callbackMuteList} {callbackFavList} {callbackFavedList} {callbackProfile} {importRelays} {useRelaysNIP07} {channels} {getMuteList} {getFavList} {getFavedList} ids={notes.map(v => v.id)} {profs} />
	<main>
	{#if true}
		{@const channel = channels.filter(v => v.id === currentChannelId)[0]}
		<h2>{channel?.name ?? 'Now Loading...'}</h2>
		{#if channel}
		<p id="channel-about">{#if channel.picture}<img src="{channel.picture}" width="100" height="100" alt="banner" />{/if}{channel.about ?? ''}</p>
		{/if}
		{#if profs[channel?.pubkey]}
		<p id="channel-owner">owner: <img src="{profs[channel.pubkey].picture}" width="32" height="32" alt="{profs[channel.pubkey].display_name}" />@{profs[channel.pubkey].name}</p>
		{/if}
	{/if}
		<Timeline {pool} {relaysToWrite} {notes} {notesQuoted} {profs} {channels} {sendFav} {loginPubkey} {muteList} {favList} {favedList} />
		<div id="input" class="show">
			{#if loginPubkey}
			<textarea id="input-text" bind:value={inputText}></textarea>
				{#if inputText !== ''}
				<button on:click={sendMessage}>投稿</button>
				{:else}
				<button disabled>投稿</button>
				{/if}
			{:else}
				<textarea id="input-text" disabled></textarea>
				<button disabled>投稿</button>
			{/if}
		</div>
	</main>
</div>

<style>
:global(html) {
	width: 100%;
	height: 100%;
}
:global(body) {
	width: 100%;
	height: 100%;
	margin: 0;
}
#container {
	width: 100%;
	height: 100%;
	display: flex;
	overflow: hidden;
}
main {
	margin-top: 3em;
	width: calc(100vw - calc(100vw - 100%));
	height: calc(100% - 3em);
	overflow-x: hidden;
	overflow-y: scroll;
	word-break: break-all;
}
#channel-about {
	white-space: pre-wrap;
}
#channel-about > img {
	float: left;
}
#channel-owner {
	clear: left;
}
#input {
	position: fixed;
	width: 100%;
	height: 8em;
	bottom: -8em;
	background-color: #ccc;
	transition: bottom 0.1s;
}
#input.show {
	bottom: 0;
}
#input > textarea {
	margin: 1em 1em 0 1em;
	width: calc(100% - 2em);
	height: 5em;
}
#input > button {
	margin-left: 1em;
}
</style>

<script lang='ts'>

import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type Sub,
	type Filter,
} from 'nostr-tools';
import { afterUpdate } from 'svelte';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import { storedLoginpubkey, storedUseRelaysNIP07, storedRelaysToUse, storedMuteList, storedFavList } from '$lib/store';
import Sidebar from '../Sidebar.svelte';
import Timeline from '../Timeline.svelte';
import Header from '../Header.svelte';
import { getChannels, getNotes, getMuteList, getFavList, sendFav } from '$lib/util';

export let data: any;
let npub: string = data.params.id;
let pubkey = (nip19.decode(npub).data as string);

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
let channelObjects: {[key: string]: Channel} = {};
let channels: Channel[] = [];
$: channels = channels;
// kind:41を溜めておく
let metadataEvents: NostrEvent[] = [];
// kind:42を溜めておく
let notes: NostrEvent[] = [];
$: notes = notes;
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
	channelObjects = {};
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
	const filter: Filter<42>[] = [{kinds: [42], limit: 100, authors: [pubkey]}];
	// チャンネルの取得
	getChannels(pool, channelEvents, relaysToRead, metadataEvents, channels, profs, (channelsRetuen: Channel[]) => {
		channels = channelsRetuen;
	}, callbackProfile).catch((e) => console.error(e));
	// 投稿の取得
	getNotes(pool, relaysToRead, subNotes, filter, notes, profs, (notesReturn: NostrEvent[]) => {
		notes = notesReturn;
		if (loginPubkey) {
			getFavList(pool, relaysToRead, loginPubkey, notes.map(v => v.id), callbackFavList);
		}
	}, callbackProfile).catch((e) => console.error(e));
	if (loginPubkey) {
		getMuteList(pool, relaysToRead, loginPubkey, callbackMuteList);
	}
}

beforeNavigate(() => {
	subNotes?.unsub();
});
afterNavigate(() => {
	npub = data.params.id;
	pubkey = (nip19.decode(npub).data as string);
	channelEvents = [];
	channelObjects = {};
	channels = [];
	metadataEvents = [];
	notes = [];
	profs = {};
	if (!useRelaysNIP07)
		storedRelaysToUse.set(defaultRelays);
	applyRelays();
});
afterUpdate(() => {
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});
</script>

<svelte:head>
	<title>{profs[pubkey]?.name ?? 'プロフィール情報不明'} | うにゅうハウス</title>
</svelte:head>
<div id="container">
	<Header />
	<Sidebar {pool} {relaysToUse} {loginPubkey} {callbackMuteList} {callbackFavList} {importRelays} {useRelaysNIP07} {channels} {getMuteList} {getFavList} ids={notes.map(v => v.id)} {profs} />
	<main>
	{#if profs[pubkey]}
		<h2>{profs[pubkey]?.display_name ?? ''} @{profs[pubkey]?.name ?? ''}</h2>
		<p class="about"><img src="{profs[pubkey]?.picture || './default.png'}" alt="avatar of {nip19.npubEncode(pubkey)}" width="32" height="32">{profs[pubkey]?.about ?? ''}</p>
	{:else}
		<h2>Now Loading...</h2>
	{/if}
	<Timeline {pool} {relaysToWrite} {notes} {profs} {channels} {sendFav} {loginPubkey} {muteList} {favList} />
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
.about {
	white-space: pre-wrap;
}
</style>

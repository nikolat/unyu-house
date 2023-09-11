<script lang='ts'>

import {
	SimplePool,
	type Event as NostrEvent,
	type Sub,
	type Filter,
} from 'nostr-tools';
import { afterUpdate, onDestroy, onMount } from 'svelte';
import { storedLoginpubkey, storedUseRelaysNIP07, storedRelaysToUse, storedMuteList, storedFavList, storedFavedList } from '$lib/store';
import Sidebar from './Sidebar.svelte';
import Timeline from './Timeline.svelte';
import Header from './Header.svelte';
import { getMuteList, getFavList, getFavedList, sendFav, getEventsPhase1 } from '$lib/util';

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
});
let favList: string[];
$: favList = favList;
storedFavList.subscribe((value) => {
	favList = value;
});
let favedList: NostrEvent[] = [];
$: favedList = favedList;
storedFavedList.subscribe((value) => {
	favedList = value;
})

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
				profs[k] = profileReturn[k];
			}
		}
		profs = profs;
	}
};

const callbackPhase1 = (channelsNew: Channel[], notesNew: NostrEvent[]) => {
	channels = channelsNew;
	notes = notesNew;
};

const callbackPhase2 = (profsNew: {[key: string]: Profile}, notesQuotedNew: NostrEvent[]) => {
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
	let notesQuotedAdded = false;
	for (const ev of notesQuotedNew) {
		if (!(ev.id in notesQuoted.map(ev => ev.id))) {
			notesQuoted.push(ev);
			notesQuotedAdded = true;
		}
	}
	if (notesQuotedAdded) {
		notesQuoted = notesQuoted;
	}
};

const callbackPhase3 = (subNotesPhase3: Sub<42>, ev: NostrEvent) => {
	subNotes = subNotesPhase3;
	notes.push(ev);
	notes = notes;
};

const applyRelays = async() => {
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
	const filter: Filter<42> = {kinds: [42], limit: 100};
	// チャンネルの取得
	getEventsPhase1(pool, relaysToRead, filter, callbackPhase1, callbackPhase2, callbackPhase3).catch((e) => console.error(e));
	if (loginPubkey) {
		getMuteList(pool, relaysToRead, loginPubkey, callbackMuteList);
	}
}

onDestroy(() => {
	subNotes?.unsub();
	pool.close(relaysToRead);
});
onMount(async () => {
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
	<title>うにゅうハウス</title>
</svelte:head>
<div id="container">
	<Header />
	<Sidebar {pool} {relaysToUse} {loginPubkey} {callbackMuteList} {callbackFavList} {callbackFavedList} {callbackProfile} {importRelays} {useRelaysNIP07} {channels} {getMuteList} {getFavList} {getFavedList} ids={notes.map(v => v.id)} {profs} />
	<main>
		<Timeline {pool} {relaysToWrite} {notes} {notesQuoted} {profs} {channels} {sendFav} {loginPubkey} {muteList} {favList} {favedList} />
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
</style>

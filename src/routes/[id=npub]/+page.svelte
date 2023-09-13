<script lang='ts'>
import { afterUpdate, onMount } from 'svelte';
import { SimplePool, nip19, type Sub, type Event as NostrEvent, type Filter, type UnsignedEvent } from 'nostr-tools';
import { title, defaultRelays, type Channel, type Profile, getEventsPhase1, getMuteList, urlDefaultTheme } from '$lib/util';
import { storedLoginpubkey, storedMuteList, storedRelaysToUse, storedTheme, storedUseRelaysNIP07 } from '$lib/store';
import Page from '../Page.svelte';
import { afterNavigate, beforeNavigate } from '$app/navigation';

const currentChannelId = null;
const inputText = null
const sendMessage = async() => {};

export let data: any;
const urlId: string = data.params.id;
let currentPubkey: string;
if (/^npub/.test(urlId)) {
	const d = nip19.decode(urlId);
	if (d.type === 'npub') {
		currentPubkey = d.data;
	}
}

let relaysToRead: string[] = [];
let relaysToWrite: string[] = [];

let pool = new SimplePool();
let subNotes: Sub<42>;

let useRelaysNIP07: boolean;
$: useRelaysNIP07 = useRelaysNIP07;
storedUseRelaysNIP07.subscribe((value) => {
	useRelaysNIP07 = value;
});
let relaysToUse: object;
$: relaysToUse = relaysToUse;
storedRelaysToUse.subscribe((value) => {
	relaysToUse = value;
});
let loginPubkey: string;
$: loginPubkey = loginPubkey;
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});
let muteList: string[];
$: muteList = muteList;
storedMuteList.subscribe((value) => {
	muteList = value;
});
let theme: string;
$: theme = theme;
storedTheme.subscribe((value) => {
	theme = value;
});

let channels: Channel[] = [];
$: channels = channels;
let notes: NostrEvent[] = [];
$: notes = notes;
let notesQuoted: NostrEvent[] = [];
$: notesQuoted = notesQuoted;
let profs: {[key: string]: Profile} = {};
$: profs = profs;

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

const callbackMuteList = (muteListReturn: string[]) => {muteList = muteListReturn;};

const applyRelays = async() => {
	channels = [];
	notes = [];
	notesQuoted = [];
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
	const filter: Filter<42> = {kinds: [42], limit: 100, authors: [currentPubkey]};
	getEventsPhase1(pool, relaysToRead, filter, callbackPhase1, callbackPhase2, callbackPhase3).catch((e) => console.error(e));
	if (loginPubkey) {
		getMuteList(pool, relaysToRead, loginPubkey, callbackMuteList);
	}
}

beforeNavigate(() => {
	subNotes?.unsub();
});
afterNavigate(() => {
	const urlId: string = data.params.id;
	let currentPubkey: string;
	if (/^npub/.test(urlId)) {
		const d = nip19.decode(urlId);
		if (d.type === 'npub') {
			currentPubkey = d.data;
		}
	}
	channels = [];
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
	<title>{profs[currentPubkey]?.name ?? '(unknown profile)'} | {title}</title>
	<link rel="stylesheet" href="{theme || urlDefaultTheme}">
</svelte:head>
<Page {title} {relaysToRead} {relaysToWrite} {channels} {notes} {notesQuoted} {profs} {pool} {subNotes} {loginPubkey}
	{applyRelays} {muteList} {callbackMuteList} {useRelaysNIP07} {relaysToUse} {theme}
	{currentChannelId} {inputText} {sendMessage} {currentPubkey} />

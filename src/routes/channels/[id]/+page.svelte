<script lang='ts'>
import { afterUpdate, onMount } from 'svelte';
import { SimplePool, nip19, type Sub, type Event as NostrEvent, type Filter } from 'nostr-tools';
import { title, defaultRelays } from '$lib/config';
import { type Channel, type Profile, getEventsPhase1, urlDefaultTheme } from '$lib/util';
import { storedFavList, storedLoginpubkey, storedMuteList, storedRelaysToUse, storedTheme } from '$lib/store';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import Page from '../../Page.svelte';

const currentPubkey = null;

export let data: any;
const urlId: string = data.params.id;
let currentChannelId: string;
let currentChannelOwner: string | undefined;
if (/^nevent/.test(urlId)) {
	const d = nip19.decode(urlId);
	if (d.type === 'nevent') {
		currentChannelId = d.data.id
		currentChannelOwner = d.data.author;
	}
}

let pool = new SimplePool();
let subNotes: Sub<7|40|41|42>;

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
storedMuteList.subscribe((value: string[]) => {
	muteList = value;
});
let favList: NostrEvent[];
$: favList = favList;
storedFavList.subscribe((value: NostrEvent[]) => {
	favList = value;
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

const callbackPhase1 = (channelsNew: Channel[], notesNew: NostrEvent[], muteListNew: string[]) => {
	channels = channelsNew;
	notes = notesNew.filter(ev => ev.tags.some(tag => tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root'));
	muteList = muteListNew;
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
		storedFavList.set(favList);
	}
	let notesQuotedAdded = false;
	for (const ev of eventsQuotedNew) {
		if (!(ev.id in notesQuoted.map(ev => ev.id))) {
			notesQuoted.push(ev);
			notesQuotedAdded = true;
		}
	}
	if (notesQuotedAdded) {
		notesQuoted = notesQuoted;
	}
};

const callbackPhase3 = (subNotesPhase3: Sub<7|40|41|42>, ev: NostrEvent<7|40|41|42>) => {
	subNotes = subNotesPhase3;
	if (ev.kind === 42 && ev.tags.some(tag => tag[0] === 'e' && tag[1] === currentChannelId && tag[3] === 'root') && !notes.map(v => v.id).includes(ev.id)) {
		notes.push(ev);
		notes = notes;
	}
	else if (ev.kind === 7 && !favList.map(v => v.id).includes(ev.id)) {
		favList.push(ev);
		favList = favList;
		storedFavList.set(favList);
	}
	else if (ev.kind === 40 && !channels.map(v => v.id).includes(ev.id)) {
		let channel: Channel;
		try {
			channel = JSON.parse(ev.content);
		} catch (error) {
			console.log(error);
			return;
		}
		channel.updated_at = ev.created_at;
		channel.id = ev.id;
		channel.pubkey = ev.pubkey;
		channel.recommendedRelay = pool.seenOn(ev.id)[0];
		channels = [channel, ...channels];
	}
	else if (ev.kind === 41) {
		const id = ev.tags.filter(tag => tag[0] === 'e')[0][1];
		const currentChannel: Channel = channels.filter(channel => channel.id === id)[0];
		if (ev.pubkey !== currentChannel.pubkey || ev.created_at <= currentChannel.updated_at) {
			return;
		}
		let newChannel: Channel;
		try {
			newChannel = JSON.parse(ev.content);
		} catch (error) {
			console.log(error);
			return;
		}
		newChannel.updated_at = ev.created_at;
		newChannel.id = id;
		newChannel.pubkey = ev.pubkey;
		newChannel.recommendedRelay = currentChannel.recommendedRelay;
		channels = [newChannel, ...channels.toSpliced(channels.findIndex(channel => channel.id === id), 1)];
	}
};

const importRelays = async (relaysSelected: string) => {
	switch (relaysSelected) {
		case 'nip07':
			relaysToUse = await (window as any).nostr.getRelays();
			storedRelaysToUse.set(relaysToUse);
			break;
		case 'default':
		default:
			relaysToUse = defaultRelays;
			storedRelaysToUse.set(relaysToUse);
			break;
	}
	applyRelays();
};
let scrolled = false;
const applyRelays = () => {
	scrolled = false;
	channels = [];
	notes = [];
	notesQuoted = [];
	profs = {};
	muteList = [];
	favList = [];
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const filter: Filter<42> = {kinds: [42], limit: 100, '#e': [currentChannelId]};
	getEventsPhase1(pool, relaysToRead, filter, callbackPhase1, callbackPhase2, callbackPhase3, loginPubkey).catch((e) => console.error(e));
}

onMount(() => {
	const input = document.getElementById('input');
	input?.classList.remove('show');
	if (Object.keys(relaysToUse).length == 0) {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
});
beforeNavigate(() => {
	subNotes?.unsub();
});
afterNavigate(() => {
	const urlId: string = data.params.id;
	if (/^nevent/.test(urlId)) {
		const d = nip19.decode(urlId);
		if (d.type === 'nevent') {
			currentChannelId = d.data.id
			currentChannelOwner = d.data.author;
		}
	}
	channels = [];
	notes = [];
	profs = {};
	applyRelays();
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	if (sidebar && main && input) {
		sidebar.style.width = '0%';
		main.style.width = 'calc(100vw - (100vw - 100%))';
		input.style.visibility = 'visible';
	}
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
</script>

<svelte:head>
	<title>{channels.filter(v => v.id === currentChannelId)[0]?.name ?? '(unknown channel)'} | {title}</title>
	<link rel="stylesheet" href="{theme || urlDefaultTheme}">
</svelte:head>
<Page {title} {channels} {notes} {notesQuoted} {profs} {pool} {loginPubkey}
	{importRelays} {muteList} {relaysToUse} {theme}
	{currentChannelId} {currentPubkey} {applyRelays} {favList} />

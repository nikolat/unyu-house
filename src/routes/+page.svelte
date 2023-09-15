<script lang='ts'>
import { afterUpdate, onDestroy, onMount } from 'svelte';
import { SimplePool, type Sub, type Event as NostrEvent, type Filter } from 'nostr-tools';
import { title, defaultRelays, type Channel, type Profile, getEventsPhase1, urlDefaultTheme } from '$lib/util';
import { storedFavList, storedLoginpubkey, storedMuteList, storedRelaysToUse, storedTheme, storedUseRelaysNIP07 } from '$lib/store';
import Page from './Page.svelte';

const currentChannelId = null;
const currentPubkey = null;

let pool = new SimplePool();
let subNotes: Sub<7|40|41|42>;

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
	notes = notesNew;
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
	if (ev.kind === 42 && !notes.map(v => v.id).includes(ev.id)) {
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
		const currentChannel: Channel = channels.filter(v => v.id === id)[0];
		if (ev.pubkey !== currentChannel.pubkey || ev.created_at < currentChannel.updated_at) {
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

const importRelays = async() => {
	useRelaysNIP07 = (<HTMLInputElement>document.getElementById('use-relay-nip07')).checked;
	storedUseRelaysNIP07.set(useRelaysNIP07);
	if (useRelaysNIP07) {
		relaysToUse = await (window as any).nostr.getRelays();
		storedRelaysToUse.set(relaysToUse);
	}
	else {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
	applyRelays();
};
const applyRelays = () => {
	channels = [];
	notes = [];
	notesQuoted = [];
	profs = {};
	muteList = [];
	favList = [];
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const filter: Filter<42> = {kinds: [42], limit: 100};
	getEventsPhase1(pool, relaysToRead, filter, callbackPhase1, callbackPhase2, callbackPhase3, loginPubkey).catch((e) => console.error(e));
}

onDestroy(() => {
	subNotes?.unsub();
	pool.close(Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]));
});
onMount(async () => {
	if (!useRelaysNIP07) {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
	applyRelays();
});
afterUpdate(() => {
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="stylesheet" href="{theme || urlDefaultTheme}">
</svelte:head>
<Page {title} {channels} {notes} {notesQuoted} {profs} {pool} {loginPubkey}
	{importRelays} {muteList} {useRelaysNIP07} {relaysToUse} {theme}
	{currentChannelId} {currentPubkey} {applyRelays} {favList} />

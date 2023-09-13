<script lang='ts'>
import { afterUpdate, onMount } from 'svelte';
import { SimplePool, nip19, type Sub, type Event as NostrEvent, type Filter, type UnsignedEvent } from 'nostr-tools';
import { title, defaultRelays, type Channel, type Profile, getEventsPhase1, urlDefaultTheme, getEventsForLoginPhase1 } from '$lib/util';
import { storedFavList, storedFavedList, storedLoginpubkey, storedMuteList, storedRelaysToUse, storedTheme, storedUseRelaysNIP07 } from '$lib/store';
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
storedMuteList.subscribe((value: string[]) => {
	muteList = value;
});
let favList: string[];
$: favList = favList;
storedFavList.subscribe((value: string[]) => {
	favList = value;
});
let favedList: NostrEvent[];
$: favedList = favedList;
storedFavedList.subscribe((value: NostrEvent[]) => {
	favedList = value;
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
	if (loginPubkey) {
		const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
		getEventsForLoginPhase1(pool, relaysToRead, loginPubkey, notes.map(v => v.id), callbackForLoginPhase1, callbackForLoginPhase2);
	}
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

const callbackPhase3 = (subNotesPhase3: Sub<7|42>, ev: NostrEvent) => {
	subNotes = subNotesPhase3;
	if (ev.kind === 42 && !notes.map(v => v.id).includes(ev.id)) {
		notes.push(ev);
		notes = notes;
	}
	else if (ev.kind === 7) {
		if (ev.pubkey === loginPubkey && !favList.includes(ev.id)) {
			favList.push(ev.id);
			favList = favList;
			storedFavList.set(favList);
		}
		if (ev.tags.filter(v => v[0] === 'p' && v[1] === loginPubkey) && !favedList.map(v => v.id).includes(ev.id)) {
			favedList.push(ev);
			favedList = favedList;
			storedFavedList.set(favedList);
		}
	}
};

const callbackForLoginPhase1 = (muteListNew: string[], favListNew: string[], favedListNew: NostrEvent[]) => {
	storedMuteList.set(muteListNew);
	muteList = muteListNew;
	const favSet = new Set(favList);
	for (const favId of favListNew) {
		favSet.add(favId);
	}
	favList = Array.from(favSet);
	storedFavList.set(favList);
	for (const favedEv of favedListNew) {
		if (!favedList.map(v => v.id).includes(favedEv.id)) {
			favedList.push(favedEv);
		}
	}
	favedList = favedList;
	storedFavedList.set(favedList);
};

const callbackForLoginPhase2 = (profsNew: {[key: string]: Profile}) => {
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
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const filter: Filter<42> = {kinds: [42], limit: 100, '#e': [currentChannelId]};
	getEventsPhase1(pool, relaysToRead, filter, callbackPhase1, callbackPhase2, callbackPhase3, loginPubkey).catch((e) => console.error(e));
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
	if (!useRelaysNIP07) {
		relaysToUse = defaultRelays;
		storedRelaysToUse.set(relaysToUse);
	}
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
	if (document.activeElement?.tagName.toLowerCase() === 'textarea')
		return;
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});
</script>

<svelte:head>
	<title>{channels.filter(v => v.id === currentChannelId)[0]?.name ?? '(unknown channel)'} | {title}</title>
	<link rel="stylesheet" href="{theme || urlDefaultTheme}">
</svelte:head>
<Page {title} relaysToWrite={Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0])} {channels} {notes} {notesQuoted} {profs} {pool} {loginPubkey}
	{importRelays} {muteList} {useRelaysNIP07} {relaysToUse} {theme}
	{currentChannelId} {currentPubkey} {applyRelays} {favList} {favedList} />

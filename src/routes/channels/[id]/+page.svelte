<script lang='ts'>

import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Sub,
} from 'nostr-tools';
import { afterUpdate } from 'svelte';
import { afterNavigate, beforeNavigate } from '$app/navigation';
import { browser } from '$app/environment';
import { storedLoginpubkey } from '../../store';

export let data: any;
let currentChannelId: string = data.params.id;
if (/^nevent/.test(currentChannelId)) {
	const d = nip19.decode(currentChannelId);
	currentChannelId = (d.data as any).id;
}

// とりあえずリレーは固定
const defaultRelays = [
	'wss://relay-jp.nostr.wirednet.jp',
	'wss://yabu.me'
];

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
}

// kind:40を溜めておく keyはid
let channelEvents: NostrEvent[] = [];
let channelObjects: {[key: string]: Channel} = {};
let channels: Channel[] = [];
$: channels = channels;
// kind:41を溜めておく
let metadataEvents: NostrEvent[] = [];
// kind:42, 43, 44を溜めておく(43,44は未対応だけど)
let notes: NostrEvent[] = [];
$: notes = notes;
// kind:0 プロフィール情報を溜めておく keyは公開鍵
let profs: {[key: string]: Profile} = {};
$: profs = profs;

const pool = new SimplePool();
let subNotes: Sub<42 | 43 | 44>;

// kind:40を取得する
const getChannels = async (relays: string[]) => {
	const sub = pool.sub(relays, [{kinds: [40]}]);
	sub.on('event', (ev: NostrEvent) => {
		channelEvents.push(ev);
		channelObjects[ev.id] = JSON.parse(ev.content);
		channelObjects[ev.id].updated_at = ev.created_at;
		channelObjects[ev.id].id = ev.id;
		channelObjects[ev.id].pubkey = ev.pubkey;
		channelObjects[ev.id].recommendedRelay = pool.seenOn(ev.id)[0];
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getChannels * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// kind:41を取得する
		getMetadata(relays);
	});
};

// kind:41を取得する
const getMetadata = async (relays: string[]) => {
	const sub = pool.sub(relays, [{kinds: [41]}]);
	sub.on('event', (ev: NostrEvent) => {
		metadataEvents.push(ev);
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getMetadata * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 更新すべきkind:41を適用する
		updateChannels();
		// 表示を反映させる
		channels = getSortedChannels();
	});
};

// 更新すべきkind:41を適用する
const updateChannels = () => {
	metadataEvents.forEach(m => {
		channelEvents.forEach(c => {
			if (m.pubkey === c.pubkey) {
				m.tags.forEach(tag => {
					if (tag[0] === 'e' && tag[1] === c.id) {
//						console.log('kind:41 replace', channelObjects[c.id], JSON.parse(m.content));
						const savedRecommendedRelay = channelObjects[c.id].recommendedRelay;
						channelObjects[c.id] = JSON.parse(m.content);
						channelObjects[c.id].updated_at = m.created_at;
						channelObjects[c.id].id = c.id;
						channelObjects[c.id].pubkey = c.pubkey;
						channelObjects[c.id].recommendedRelay = savedRecommendedRelay;
					}
				});
			}
		})
	});
};

// 降順にソートされたチャンネル情報の配列を返す
const getSortedChannels = () => {
	const channelArray: Channel[] = Object.values(channelObjects);
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

const getChannelName = (noteEvent: NostrEvent) => {
	for (const tag of noteEvent.tags) {
		if (tag[0] === 'e' && tag[3] === 'root') {
			if (channelObjects[tag[1]]) {
				return channelObjects[tag[1]].name;
			}
			return 'チャンネル情報不明';
		}
	}
	return 'チャンネル情報不明';
};

// kind:42, 43, 44を取得する
const getNotes = async (relays: string[]) => {
	subNotes = pool.sub(relays, [{kinds: [42, 43, 44], limit: 100, '#e': [currentChannelId]}]);
	const pubkeys: Set<string> = new Set();
	let getEOSE = false;
	const update = () => {
		// 時系列順にソートする
		notes.sort((a, b) => {
			if (a.created_at < b.created_at) {
				return -1;
			}
			if (a.created_at > b.created_at) {
				return 1;
			}
			return 0;
		});
		// 表示を反映させる
		notes = notes;
	};
	subNotes.on('event', (ev: NostrEvent) => {
		notes.push(ev);
		if (getEOSE) {
			update();
			if (!(ev.pubkey in profs)) {
				getProfile(relays, [ev.pubkey]);
			}
		}
		else {
			pubkeys.add(ev.pubkey);
		}
//		console.log(ev);
	});
	subNotes.on('eose', () => {
		console.log('getNotes * EOSE *');
		getEOSE = true;
		update();
		// 投稿の取得が終わったらプロフィールを取得しに行く
		getProfile(relays, Array.from(pubkeys));
	});
};

// プロフィールを取得する
const getProfile = async (relays: string[], pubkeys: string[]) => {
	const sub = pool.sub(relays, [{kinds: [0], authors: pubkeys}]);
	sub.on('event', (ev: NostrEvent) => {
		profs[ev.pubkey] = JSON.parse(ev.content);
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getProfile * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		profs = profs;
	});
};

let loginPubkey: string;
$: loginPubkey = loginPubkey;
const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		loginPubkey = await (window as any).nostr.getPublicKey();
		storedLoginpubkey.set(loginPubkey);
	}
};
const logout = () => {
	storedLoginpubkey.set('');
};
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});

beforeNavigate(() => {
	subNotes.unsub();
});
afterNavigate(() => {
	currentChannelId = data.params.id;
	if (/^nevent/.test(currentChannelId)) {
		const d = nip19.decode(currentChannelId);
		currentChannelId = (d.data as any).id;
	}
	channelEvents = [];
	channelObjects = {};
	channels = [];
	metadataEvents = [];
	notes = [];
	profs = {};
	// チャンネルの取得
	getChannels(defaultRelays).catch((e) => console.error(e));
	// 投稿の取得
	getNotes(defaultRelays).catch((e) => console.error(e));
});
afterUpdate(() => {
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});

let inputText = '';
$: inputText = inputText;
const sendMessage = async() => {
	const recommendedRelay: string = channelObjects[currentChannelId].recommendedRelay;
	const tags = [['e', currentChannelId, recommendedRelay, 'root']];
	const matchesIterator = inputText.matchAll(/(^|\W|\b)(nostr:(npub\w{59}))($|\W|\b)/g);
	const mentionPubkeys: Set<string> = new Set();
	for (const match of matchesIterator) {
		const pubkey = nip19.decode(match[3]).data;
		if (typeof pubkey !== 'string')
			continue;
		mentionPubkeys.add(pubkey);
	}
	for (const p of mentionPubkeys) {
		tags.push(['p', p, '']);
	}
	const baseEvent: UnsignedEvent = {
		kind: 42,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: inputText
	};
	const newEvent: NostrEvent = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(defaultRelays, newEvent);
	await Promise.all(pubs);
	inputText = '';
}

</script>

<svelte:head>
	<title>{channelObjects[currentChannelId]?.name} | うにゅうハウス</title>
</svelte:head>
<div id="container">
<header>
	<h1><a href="/">うにゅうハウス</a></h1>
	<p>以下のリレーに接続しています</p>
	<ul>
	{#each defaultRelays as relay}
		<li>{relay}</li>
	{/each}
	</ul>
	{#if loginPubkey}
	<button on:click={logout}>logout</button>
	{:else}
	<button on:click={login}>login with NIP-07</button>
	{/if}
	<h2>GitHub</h2>
	<p><a href="https://github.com/nikolat/unyu-house">nikolat/unyu-house</a></p>
	<nav>
		<h2>チャンネル</h2>
		<p>チャンネル取得数: {channels.length}</p>
		<ul>
			{#each channels as channel}
			<li><a href="/channels/{nip19.neventEncode({id:channel.id, relays:[channelObjects[channel.id].recommendedRelay], author:channelObjects[channel.id].pubkey})}">{channel.name}</a></li>
			{/each}
		</ul>
	</nav>
</header>
<main>
	<h2>{channelObjects[currentChannelId]?.name}</h2>
	{#if channelObjects[currentChannelId]}
	<p id="channel-about">{#if channelObjects[currentChannelId]?.picture}<img src="{channelObjects[currentChannelId]?.picture}" width="100" height="100" alt="banner" />{/if}{channelObjects[currentChannelId]?.about}</p>
	{/if}
	{#if profs[channelObjects[currentChannelId]?.pubkey]}
	<p id="channel-owner">owner: <img src="{profs[channelObjects[currentChannelId]?.pubkey]?.picture}" width="32" height="32" alt="{profs[channelObjects[currentChannelId]?.pubkey]?.display_name}" />@{profs[channelObjects[currentChannelId]?.pubkey]?.name}</p>
	{/if}
	<p>投稿取得数: {notes.length}</p>
	<dl>
	{#each notes as note}
		<dt>
		{#if profs[note.pubkey]}
			<img src="{profs[note.pubkey].picture}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | @{profs[note.pubkey].name}
		{:else}
			@{nip19.npubEncode(note.pubkey)}
		{/if}
		| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} | {getChannelName(note)}</dt>
		<dd>{note.content}</dd>
	{/each}
	</dl>
	<div id="input">
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
header {
	width: 20%;
	height: 100%;
	background-color: #ccc;
	overflow-y: scroll;
}
main {
	width: 80%;
	height: calc(100% - 7em);
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
dt {
	border-top: 1px solid #666;
}
dd {
	border-top: 1px dashed #999;
	white-space: pre-wrap;
}
#input {
	position: absolute;
	width: 80%;
	height: 7em;
	bottom: 0%;
}
#input > textarea {
	width: 100%;
	height: 5em;
}
</style>

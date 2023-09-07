<script lang='ts'>

import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Sub,
} from 'nostr-tools';
import { afterUpdate, onDestroy, onMount } from 'svelte';
import { storedLoginpubkey, storedUseRelaysNIP07, storedRelaysToUse } from './store';
import Sidebar from './Sidebar.svelte';

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

let pool = new SimplePool();
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
const getChannelId = (noteEvent: NostrEvent) => {
	for (const tag of noteEvent.tags) {
		if (tag[0] === 'e' && tag[3] === 'root') {
			if (channelObjects[tag[1]]) {
				const id = channelObjects[tag[1]].id;
				return nip19.neventEncode({id:id, relays:[channelObjects[id].recommendedRelay], author:channelObjects[id].pubkey});
			}
			return null;
		}
	}
	return null;
};
const getImagesUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/.+\.(jpe?g|png|gif)/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};

// kind:42, 43, 44を取得する
const getNotes = async (relays: string[]) => {
	subNotes = pool.sub(relays, [{kinds: [42, 43, 44], limit: 100}]);
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
			const pubkeysToGet: Set<string> = new Set();
			pubkeysToGet.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeysToGet.add(pubkey);
			}
			const matchesIterator = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIterator) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeysToGet.add(d.data);
			}
			const pubkeysToGetArray = Array.from(pubkeysToGet).filter(v => !(v in profs))
			if (pubkeysToGetArray.length > 0) {
				getProfile(relays, Array.from(pubkeysToGetArray));
			}
		}
		else {
			pubkeys.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeys.add(pubkey);
			}
			const matchesIterator = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIterator) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeys.add(d.data);
			}
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

let muteList: string[] = [];
$: muteList = muteList;
// ミュートリストを取得する
const getMutelist = async (relays: string[], pubkey: string) => {
	const sub = pool.sub(relays, [{kinds: [10000], authors: [pubkey]}]);
	sub.on('event', (ev: NostrEvent) => {
		muteList = ev.tags.filter(v => v[0] === 'p').map(v => v[1]);
	});
	sub.on('eose', () => {
		console.log('getMutelist * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
	});
};

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
	// チャンネルの取得
	getChannels(relaysToRead).catch((e) => console.error(e));
	// 投稿の取得
	getNotes(relaysToRead).catch((e) => console.error(e));
	if (loginPubkey)
		getMutelist(relaysToRead, loginPubkey);
}

const sendFav = async(noteid: string, targetPubkey: string) => {
	const savedloginPubkey = loginPubkey;
	storedLoginpubkey.set('');
	const tags = [['p', targetPubkey, ''], ['e', noteid, '', '']];
	const baseEvent: UnsignedEvent = {
		kind: 7,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: '+'
	};
	const newEvent: NostrEvent = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
	storedLoginpubkey.set(savedloginPubkey);
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
<Sidebar {relaysToUse} {loginPubkey} {importRelays} {useRelaysNIP07} {channels} {getMutelist} {muteList} />
<main>
	<p>投稿取得数: {notes.length}</p>
	<dl>
	{#each notes as note}
		{#if !muteList.includes(note.pubkey)}
			<dt id="{note.id}">
			{#if profs[note.pubkey]}
				<img src="{profs[note.pubkey].picture || './default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name}</a>
			{:else}
				<a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name}</a>
			{/if}
				| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} | {#if getChannelId(note)}<a href="/channels/{getChannelId(note)}">{getChannelName(note)}</a>{:else}{getChannelName(note)}{/if}
			</dt>
			<dd>
				<div class="info-header">
				{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'reply').length}
					<a href="#{note.tags.filter(v => v[0] === 'e' && v[3] === 'reply')[0][1]}">&gt;&gt;</a>
				{/if}
				{#each note.tags.filter(v => v[0] === 'p').map(v => v[1]) as pubkey}
					&nbsp;@{profs[pubkey]?.name}
				{/each}
				</div>
			{#if true}
				{@const regMatch = /(https?:\/\/\S+)|(nostr:(npub\w{59}))/g}
				{@const regSplit = /https?:\/\/\S+|nostr:npub\w{59}/}
				{@const plainTexts = note.content.split(regSplit)}
				{plainTexts.shift()}
				{#each note.content.matchAll(regMatch) as match}
					{#if /https?:\/\/\S+/.test(match[1]) }
						<a href="{match[1]}">{match[1]}</a>
					{:else if /npub\w{59}/.test(match[3])}
						{@const d = nip19.decode(match[3])}
						{#if d.type === 'npub'}
							<a href="/{match[3]}">@{profs[d.data]?.name}</a>
						{:else}
							{match[3]}
						{/if}
					{/if}
					{plainTexts.shift()}
				{/each}
			{/if}
			{#each getImagesUrls(note.content) as imageUrl}
				<a href="{imageUrl}"><img src="{imageUrl}" alt="" /></a>
			{/each}
				<div class="action-bar"><button on:click={() => sendFav(note.id, note.pubkey)} disabled={!loginPubkey}>☆ふぁぼる</button></div>
			</dd>
		{/if}
	{/each}
	</dl>
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
	width: 80%;
	height: calc(100% - 7em);
	overflow-y: scroll;
	word-break: break-all;
}
main dt {
	border-top: 1px solid #666;
}
main dd {
	border-top: 1px dashed #999;
	white-space: pre-wrap;
}
main dd .info-header {
	color: #999;
}
main dd img {
	max-height: 200px;
}
</style>

<script lang='ts'>

import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type Sub,
} from 'nostr-tools';
import { afterUpdate, onDestroy, onMount } from 'svelte';

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
}

interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
}

// kind:40を溜めておく keyはid
const channelEvents: NostrEvent[] = [];
const channelObjects: {[key: string]: Channel} = {};
let channels: Channel[] = [];
$: channels = channels;
// kind:41を溜めておく
const metadataEvents: NostrEvent[] = [];
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
		console.log(ev);
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
		console.log(ev);
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
						console.log('kind:41 replace', channelObjects[c.id], JSON.parse(m.content));
						channelObjects[c.id] = JSON.parse(m.content);
						channelObjects[c.id].updated_at = m.created_at;
						channelObjects[c.id].id = c.id;
						channelObjects[c.id].pubkey = c.pubkey;
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
				return channelObjects[tag[1]].id;
			}
			return null;
		}
	}
	return null;
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
			if (!(ev.pubkey in profs)) {
				getProfile(relays, [ev.pubkey]);
			}
		}
		else {
			pubkeys.add(ev.pubkey);
		}
		console.log(ev);
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
		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getProfile * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		profs = profs;
	});
};

onDestroy(() => {
	subNotes?.unsub();
});
onMount(async () => {
	// チャンネルの取得
	getChannels(defaultRelays).catch((e) => console.error(e));
	// 投稿の取得
	await getNotes(defaultRelays).catch((e) => console.error(e));
});
afterUpdate(() => {
	const main = document.getElementsByTagName('main')[0];
	main.scroll(0, main.scrollHeight);
});

</script>

<div id="container">
<header>
	<h1><a href="/">ぱぶ茶(仮)</a></h1>
	<p>以下のリレーに接続しています</p>
	<ul>
	{#each defaultRelays as relay}
		<li>{relay}</li>
	{/each}
	</ul>
	<h2>GitHub</h2>
	<p><a href="https://github.com/nikolat/svelte-practice">nikolat/svelte-practice</a></p>
	<nav>
		<h2>チャンネル</h2>
		<p>チャンネル取得数: {channels.length}</p>
		<ul>
			{#each channels as channel}
			<li><a href="/channels/{channel.id}">{channel.name}</a></li>
			{/each}
		</ul>
	</nav>
</header>
<main>
	<p>投稿取得数: {notes.length}</p>
	<dl>
	{#each notes as note}
		<dt>
		{#if profs[note.pubkey]}
			<img src="{profs[note.pubkey].picture}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | @{profs[note.pubkey].name}
		{:else}
			@{nip19.npubEncode(note.pubkey)}
		{/if}
		| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} | {#if getChannelId(note)}<a href="/channels/{getChannelId(note)}">{getChannelName(note)}</a>{:else}{getChannelName(note)}{/if}</dt>
		<dd>{note.content}</dd>
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
header {
	width: 20%;
	height: 100%;
	background-color: #ccc;
	overflow-y: scroll;
}
main {
	width: 80%;
	height: calc(100% - 5em);
	overflow-y: scroll;
	word-break: break-all;
}
dt {
	border-top: 1px solid #666;
}
dd {
	border-top: 1px dashed #999;
	white-space: pre-wrap;
}
</style>

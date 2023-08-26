<script lang='ts'>
import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
} from 'nostr-tools';

// とりあえずリレーは固定
const defaultRelays = [
	'wss://relay-jp.nostr.wirednet.jp',
	'wss://yabu.me'
];

interface Channel {
	name: string
	about: string
	picture: string
}

interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
}

// kind:40を溜めておく
let channels: Channel[] = [];
$: channels = channels;
// kind:42, 43, 44を溜めておく
let notes: NostrEvent[] = [];
$: notes = notes;
// kind:0 プロフィール情報を溜めておく keyは公開鍵
let profs: {[key: string]: Profile} = {};
$: profs = profs;

const pool = new SimplePool();

// kind:40を取得する
const getChannels = async (relays: string[]) => {
	const sub = pool.sub(relays, [{kinds: [40], limit: 100}]);
	const pubkeys: Set<string> = new Set();
	sub.on('event', (ev: NostrEvent) => {
		channels.push(JSON.parse(ev.content));
		console.log(ev);
	});
	sub.on('eose', () => {
		// 表示を反映させる
		channels = channels;
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 投稿の取得が終わったらプロフィールを取得しに行く
		getNotes(relays);
		console.log('getChannels * EOSE *');
	});
};

// kind:42, 43, 44を取得する
const getNotes = async (relays: string[]) => {
	const sub = pool.sub(relays, [{kinds: [42, 43, 44], limit: 50}]);
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
		// プロフィールを取得しに行く
		getProf(relays, Array.from(pubkeys));
	};
	sub.on('event', (ev: NostrEvent) => {
		notes.push(ev);
		pubkeys.add(ev.pubkey);
		if (getEOSE) {
			update();
		}
		console.log(ev);
	});
	sub.on('eose', () => {
		update();
		getEOSE = true;
		console.log('getNotes * EOSE *');
	});
};

// プロフィールを取得する
const getProf = async (relays: string[], pubkeys: string[]) => {
	const sub = pool.sub(relays, [{kinds: [0], authors: pubkeys}]);
	sub.on('event', (ev: NostrEvent) => {
		profs[ev.pubkey] = JSON.parse(ev.content);
		// Nostrイベントのオブジェクトがコールバックに渡る
		console.log(ev);
	});
	sub.on('eose', () => {
		// 表示を反映させる
		profs = profs;
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		console.log('kind:0 * EOSE *');
	});
};

getChannels(defaultRelays).catch((e) => console.error(e));

</script>

<div id="container">
<header>
	<h1>ぱぶ茶(仮)</h1>
	<p>以下のリレーに接続しています</p>
	<ul>
	{#each defaultRelays as relay}
		<li>{relay}</li>
	{/each}
	</ul>
	<nav>
		<h2>チャンネル</h2>
		<p>チャンネル取得数: {channels.length}</p>
		<ul>
			{#each channels as channel}
			<li>{channel.name}</li>
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
		| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind}</dt>
		<dd>{note.content}</dd>
	{/each}
	</dl>
</main>
</div>

<style>
#container {
	display: flex;
}
header {
	background-color: #ccc;
}
dt {
	border-top: 1px solid #666;
}
dd {
	border-top: 1px dashed #999;
	white-space: pre-wrap;
}
</style>

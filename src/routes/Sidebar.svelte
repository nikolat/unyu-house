<script lang='ts'>
import {
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey } from './store';

interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	id: string
	pubkey: string
	recommendedRelay: string
}

export let relaysToUse: object;
export let loginPubkey: string;
export let importRelays: () => Promise<void>;
export let useRelaysNIP07: boolean;
export let channels: Channel[];
export let getMutelist: (relays: string[], pubkey: string) => Promise<void>;
export let muteList: string[];

const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		loginPubkey = await (window as any).nostr.getPublicKey();
		storedLoginpubkey.set(loginPubkey);
		const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
		getMutelist(relaysToRead, loginPubkey);
	}
};
const logout = () => {
	storedLoginpubkey.set('');
	muteList = [];
};
</script>

<header>
	<h1><a href="/">うにゅうハウス</a></h1>
	<p>以下のリレーに接続しています</p>
	<table>
		<tr>
			<th>r</th>
			<th>w</th>
			<th>relay</th>
		</tr>
		{#each Object.entries(relaysToUse) as relay}
		<tr>
			<td><input type="checkbox" checked={relay[1].read} disabled /></td>
			<td><input type="checkbox" checked={relay[1].write} disabled /></td>
			<td>{relay[0]}</td>
		</tr>
		{/each}
	</table>
	{#if loginPubkey}
	<button on:click={logout}>logout</button>
	<dl>
		<dt><label for="useRelaysInNIP07">Use relays in NIP-07</label></dt>
		<dd><input id="use-relay-nip07" name="useRelaysInNIP07" type="checkbox" on:change={importRelays} bind:checked={useRelaysNIP07} /></dd>
	</dl>
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
			<li><a href="/channels/{nip19.neventEncode({id:channel.id, relays:[channel.recommendedRelay], author:channel.pubkey})}">{channel.name}</a></li>
			{/each}
		</ul>
	</nav>
</header>

<style>
header {
	width: 20%;
	height: 100%;
	background-color: #ccc;
	overflow-y: scroll;
}
</style>

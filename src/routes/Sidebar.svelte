<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey, storedMuteList } from '$lib/store';

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

export let pool: SimplePool;
export let relaysToUse: object;
export let loginPubkey: string;
export let callbackMuteList: Function;
export let importRelays: () => Promise<void>;
export let useRelaysNIP07: boolean;
export let channels: Channel[];
export let getMutelist: (pool: SimplePool, relays: string[], pubkey: string, callbackMuteList: Function) => Promise<void>;
export let profs: {[key: string]: Profile};

const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		loginPubkey = await (window as any).nostr.getPublicKey();
		storedLoginpubkey.set(loginPubkey);
		const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
		getMutelist(pool, relaysToRead, loginPubkey, callbackMuteList);
	}
};
const logout = () => {
	storedLoginpubkey.set('');
	storedMuteList.set([]);
};
</script>

<div id="sidebar">
	<section>
		<h2>接続リレー</h2>
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
	</section>
	<section>
		<h2>GitHub</h2>
		<p><a href="https://github.com/nikolat/unyu-house">nikolat/unyu-house</a></p>
	</section>
	<nav>
		<h2>チャンネル</h2>
		<p>チャンネル取得数: {channels.length}</p>
		<ul>
			{#each channels as channel}
			<li>
				<img src="{profs[channel.pubkey]?.picture || '/default.png'}" alt="" width="16" height="16">
				<a href="/channels/{nip19.neventEncode({id:channel.id, relays:[channel.recommendedRelay], author:channel.pubkey})}">{channel.name}</a>
			</li>
			{/each}
		</ul>
	</nav>
</div>

<style>
#sidebar {
	margin-top: 2em;
	width: 0%;
	height: calc(100% - 2em);
	overflow-y: scroll;
	transition: width 0.1s;
}
</style>

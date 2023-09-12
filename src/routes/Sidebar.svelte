<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey, storedMuteList, storedFavList, storedFavedList, storedTheme } from '$lib/store';
import { urlDarkTheme, urlLightTheme, urlDefaultTheme } from '$lib/util';
import { onMount } from 'svelte';

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
export let callbackFavList: Function;
export let callbackFavedList: Function;
export let callbackProfile: Function;
export let importRelays: () => Promise<void>;
export let useRelaysNIP07: boolean;
export let channels: Channel[];
export let ids: string[];
export let getMuteList: (pool: SimplePool, relays: string[], pubkey: string, callbackMuteList: Function) => Promise<void>;
export let getFavList: (pool: SimplePool, relays: string[], pubkey: string, ids: string[], callbackFavList: Function) => Promise<void>;
export let getFavedList: (pool: SimplePool, relays: string[], pubkey: string, ids: string[], callbackFavedList: Function, callbackProfile: Function) => Promise<void>;
export let profs: {[key: string]: Profile};

const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		loginPubkey = await (window as any).nostr.getPublicKey();
		storedLoginpubkey.set(loginPubkey);
		const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
		getMuteList(pool, relaysToRead, loginPubkey, callbackMuteList);
		getFavList(pool, relaysToRead, loginPubkey, ids, callbackFavList);
		getFavedList(pool, relaysToRead, loginPubkey, ids, callbackFavedList, callbackProfile);
	}
};
const logout = () => {
	storedLoginpubkey.set('');
	storedMuteList.set([]);
	storedFavList.set([]);
	storedFavedList.set([]);
};

const changeTheme = () => {
	const container = document.getElementById('container');
	if ((<HTMLInputElement>document.getElementById('theme-dark')).checked) {
		storedTheme.set(urlDarkTheme);
		container?.classList.remove('light');
		container?.classList.add('dark');
	}
	else if ((<HTMLInputElement>document.getElementById('theme-light')).checked) {
		storedTheme.set(urlLightTheme);
		container?.classList.remove('dark');
		container?.classList.add('light');
	}
};
export let theme: string;
storedTheme.subscribe((value) => {
	theme = value;
});
onMount(() => {
	if (!theme) {
		theme = urlDefaultTheme;
	}
	const container = document.getElementById('container');
	if (theme === urlDarkTheme) {
		container?.classList.remove('light');
		container?.classList.add('dark');
	}
	else if (theme === urlLightTheme) {
		container?.classList.remove('dark');
		container?.classList.add('light');
	}
});

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
		<h2>Theme</h2>
		<form>
			<label for="theme-dark">Dark theme</label>
			<input on:change={changeTheme} type="radio" value="dark" name="theme" id="theme-dark" checked={theme === urlDarkTheme}>
			<label for="theme-light">Light theme</label>
			<input on:change={changeTheme} type="radio" value="light" name="theme" id="theme-light" checked={theme === urlLightTheme}>
		</form>
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
	<section>
		<h2>GitHub</h2>
		<p><a href="https://github.com/nikolat/unyu-house">nikolat/unyu-house</a></p>
	</section>
</div>

<style>
#sidebar {
	margin-top: 3em;
	padding-left: 0.5em;
	width: 0%;
	height: calc(100% - 3em);
	overflow-y: scroll;
	transition: width 0.1s;
}
#sidebar table {
	table-layout: auto;
	width: auto;
}
#sidebar th {
	text-align: center;
}
</style>

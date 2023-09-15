<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey, storedMuteList, storedFavList, storedTheme } from '$lib/store';
import { urlDarkTheme, urlLightTheme, urlDefaultTheme, sendCreateChannel } from '$lib/util';
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
export let useRelaysNIP07: boolean;
export let channels: Channel[];
export let applyRelays: Function
export let profs: {[key: string]: Profile};
export let importRelays: Function;
export let theme: string;
storedTheme.subscribe((value) => {
	theme = value;
});

let newChannelName: string;
let newChannelAbout: string;
let newChannelPicture: string;

const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		loginPubkey = await (window as any).nostr.getPublicKey();
		storedLoginpubkey.set(loginPubkey);
		applyRelays();
	}
};
const logout = () => {
	storedLoginpubkey.set('');
	storedMuteList.set([]);
	storedFavList.set([]);
	applyRelays();
};
const callSendCreateChannel = () => {
	const [channelName, channelAbout, channelPicture] = [newChannelName, newChannelAbout, newChannelPicture];
	[newChannelName, newChannelAbout, newChannelPicture] = ['', '', ''];
	const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
	sendCreateChannel(pool, relaysToWrite, channelName, channelAbout, channelPicture);
}

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
		<h2>Login</h2>
		{#if loginPubkey}
		<button on:click={logout}>Logout</button>
		{:else}
		<button on:click={login}>Login with Browser Extension (NIP-07)</button>
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
	<section>
		<h2>Relays</h2>
		{#if loginPubkey}
		<form>
			<label for="use-relay-nip07">Use relays in NIP-07</label>
			<input id="use-relay-nip07" type="checkbox" on:change={() => importRelays()} bind:checked={useRelaysNIP07} />
		</form>
		{/if}
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
	</section>
	<nav>
		<h2>Channels</h2>
		<p>Total: {channels.length} channels</p>
		{#if loginPubkey}
		<details>
			<summary>Create New Channel</summary>
			<form>
				<dl>
					<dt><label for="new-channel-name">Name</label></dt>
					<dd><input id="new-channel-name" type="text" placeholder="channel name" bind:value={newChannelName} /></dd>
					<dt><label for="new-channel-about">About</label></dt>
					<dd><textarea id="new-channel-about" placeholder="channel description" bind:value={newChannelAbout}></textarea></dd>
					<dt><label for="new-channel-picture">Picture</label></dt>
					<dd><input id="new-channel-picture" type="url" placeholder="https://..." bind:value={newChannelPicture} /></dd>
				</dl>
				<button on:click={callSendCreateChannel} disabled={!newChannelName}>Create</button>
			</form>
		</details>
		{/if}
		<ul class="channels" role="list">
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
details {
	display: inline-block;
}
details input {
	min-width: 15em;
}
ul.channels {
	list-style: none;
}

</style>

<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey, storedMuteList, storedFavList, storedTheme, storedRelaysSelected, storedPinList } from '$lib/store';
import { urlDarkTheme, urlLightTheme, urlDefaultTheme, sendCreateChannel, type Channel, type Profile } from '$lib/util';
import { onMount } from 'svelte';

export let pool: SimplePool;
export let relaysToUse: object;
export let loginPubkey: string;
export let channels: Channel[];
export let applyRelays: Function
export let profs: {[key: string]: Profile};
export let importRelays: Function;
export let theme: string;

let relaysSelected: string;
storedRelaysSelected.subscribe((value) => {
	relaysSelected = value;
});

storedTheme.subscribe((value) => {
	theme = value;
});

let pinList: string[];
$: pinList = pinList;
storedPinList.subscribe((value: string[]) => {
	pinList = value;
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

const changeRelays = (relay: string) => {
	relaysSelected = relay;
	storedRelaysSelected.set(relaysSelected);
	importRelays(relaysSelected);
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
	<section id="login">
		<h2>Login</h2>
		{#if loginPubkey}
		<button on:click={logout}>Logout</button>
		{:else}
		<button on:click={login}>Login with Browser Extension (NIP-07)</button>
		{/if}
	</section>
	<section id="theme">
		<h2>Theme</h2>
		<form>
			<ul>
				<li>
					<input on:change={changeTheme} type="radio" value="dark" name="theme" id="theme-dark" checked={theme === urlDarkTheme}>
					<label for="theme-dark">Dark theme</label>
				</li>
				<li>
					<input on:change={changeTheme} type="radio" value="light" name="theme" id="theme-light" checked={theme === urlLightTheme}>
					<label for="theme-light">Light theme</label>
				</li>
			</ul>
		</form>
	</section>
	<section id="relays">
		<h2>Relays</h2>
		{#if loginPubkey}
		<form>
			<ul>
				<li>
					<input on:change={() => changeRelays('kind3')} type="radio" value="kind3" name="relay" id="relay-kind3" checked={relaysSelected === 'kind3'}>
					<label for="relay-kind3">kind3</label>
				</li>
				<li>
					<input on:change={() => changeRelays('kind10002')} type="radio" value="kind10002" name="relay" id="relay-kind10002" checked={relaysSelected === 'kind10002'}>
					<label for="relay-kind10002">kind10002</label>
				</li>
				<li>
					<input on:change={() => changeRelays('nip07')} type="radio" value="nip07" name="relay" id="relay-nip07" checked={relaysSelected === 'nip07'}>
					<label for="relay-nip07">NIP-07</label>
				</li>
				<li>
					<input on:change={() => changeRelays('default')} type="radio" value="default" name="relay" id="relay-default" checked={relaysSelected === 'default'}>
					<label for="relay-default">Default</label>
				</li>
			</ul>
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
	<nav id="channels">
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
			{#if pinList.length > 0}
		<h3>Pinned Channels</h3>
		<ul role="list">
				{#each channels.filter(ch => pinList.includes(ch.id)) as channel}
			<li>
				<img src="{profs[channel.pubkey]?.picture || '/default.png'}" alt="" width="16" height="16">
				<a href="/channels/{nip19.neventEncode({id:channel.id, relays:channel.recommendedRelay ? [channel.recommendedRelay] : [], author:channel.pubkey ?? ''})}">{channel.name}</a>
			</li>
				{/each}
		</ul>
			{/if}
		{/if}
		<h3>All Channels</h3>
		<ul role="list">
			{#each channels as channel}
			<li>
				<img src="{profs[channel.pubkey]?.picture || '/default.png'}" alt="" width="16" height="16">
				<a href="/channels/{nip19.neventEncode({id:channel.id, relays:channel.recommendedRelay ? [channel.recommendedRelay] : [], author:channel.pubkey ?? ''})}">{channel.name}</a>
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
@media screen and (min-width: 1280px) {
	#sidebar {
		min-width: 20%;
	}
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
details input,
details textarea {
	min-width: 15em;
}
ul {
	list-style: none;
}

</style>

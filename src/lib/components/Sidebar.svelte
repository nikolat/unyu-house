<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { storedIsLoggedin, storedLoginpubkey, storedRelaysSelected, storedFilterSelected, preferences } from '$lib/store';
import { urlDarkTheme, urlLightTheme, urlDefaultTheme, sendCreateChannel, type Channel, type Profile, type GetRelays } from '$lib/util';
import { urlNIP07guide } from '$lib/config';
import type { NostrAPI } from '$lib/@types/nostr';
import { onMount } from 'svelte';
import SidebarChannel from '$lib/components/SidebarChannel.svelte';

interface Window {
	nostr?: NostrAPI;
}

export let pool: SimplePool;
export let relaysToUse: {[key: string]: GetRelays};
export let isLoggedin: boolean;
export let loginPubkey: string;
export let channels: Channel[];
export let profs: {[key: string]: Profile};
export let importRelays: Function;
export let theme: string;
export let pinList: string[];
export let muteList: string[];
export let muteChannels: string[];
export let wordList: string[];
let relaysSelected: string;
storedRelaysSelected.subscribe((value) => {
	relaysSelected = value;
});
let filterSelected: string;
storedFilterSelected.subscribe((value) => {
	filterSelected = value;
});

preferences.subscribe((value) => {
	theme = value.theme ?? theme;
});

let newChannelName: string;
let newChannelAbout: string;
let newChannelPicture: string;

const login = async() => {
	const nostr = (window as Window).nostr;
	if (browser && nostr?.getPublicKey) {
		try {
			loginPubkey = await nostr.getPublicKey();
		} catch (error) {
			console.error(error);
			return;
		}
		storedIsLoggedin.set(true);
		storedLoginpubkey.set(loginPubkey);
		relaysSelected = 'default';
		importRelays(relaysSelected);
	}
	else if (browser && nostr === undefined) {
		goto(urlNIP07guide);
	}
};
const logout = () => {
	storedIsLoggedin.set(false);
	storedLoginpubkey.set('');
	relaysSelected = 'default';
	importRelays(relaysSelected);
};
const callSendCreateChannel = () => {
	const [channelName, channelAbout, channelPicture] = [newChannelName, newChannelAbout, newChannelPicture];
	[newChannelName, newChannelAbout, newChannelPicture] = ['', '', ''];
	const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
	sendCreateChannel(pool, relaysToWrite, channelName, channelAbout, channelPicture);
}

const changeTheme = () => {
	const container = document.getElementById('container');
	if(theme === urlDarkTheme) {
		preferences.set({theme: urlDarkTheme});
		container?.classList.remove('light');
		container?.classList.add('dark');
	} else {
		preferences.set({theme: urlLightTheme});
		container?.classList.remove('dark');
		container?.classList.add('light');
	}
};

const changeRelays = () => {
	storedRelaysSelected.set(relaysSelected);
	importRelays(relaysSelected);
};

const changeFilter = () => {
	storedFilterSelected.set(filterSelected);
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
	<h3>Config</h3>
	<section class="config">
		<div>Login</div>
		<div>
			{#if isLoggedin}
			<button on:click={logout}>Logout</button>
			{:else}
			<button on:click={login}>Login with Browser Extension (NIP-07)</button>
			{/if}
		</div>
	</section>
	<section class="config">
		<div>Theme</div>
		<select bind:value={theme} on:change={changeTheme}>
			<option value={urlDarkTheme}>Dark Theme</option>
			<option value={urlLightTheme}>Light Theme</option>
		</select>
	</section>
	<h3>Relays</h3>
	{#if loginPubkey}
	<section class="config">
		<div>Get Relay List</div>
		<select bind:value={relaysSelected} on:change={changeRelays}>
			<option value="kind3">Kind 3</option>
			<option value="kind10002">Kind 10002</option>
			<option value="nip05">NIP-05</option>
			{#if isLoggedin}<option value="nip07">NIP-07</option>{/if}
			<option value="default">Default</option>
		</select>
	</section>
	{/if}
	<table>
		<tr>
			<th>relay</th>
			<th>r</th>
			<th>w</th>
		</tr>
		{#each Object.entries(relaysToUse) as relay}
		<tr>
			<td>{relay[0]}</td>
			<td><input type="checkbox" checked={relay[1].read} disabled /></td>
			<td><input type="checkbox" checked={relay[1].write} disabled /></td>
		</tr>
		{/each}
	</table>
	<section id="channels">
		{#if loginPubkey}
			{#if isLoggedin}
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
			{#if pinList.length > 0}
		<h3>Pinned Channels</h3>
		<div>
				{#each channels.filter(ch => pinList.includes(ch.event.id)) as channel}
			<SidebarChannel picture={profs[channel.event.pubkey]?.picture} url={nip19.neventEncode(channel.event)} channelName={channel.name} post_count={channel.post_count} fav_count={channel.fav_count}></SidebarChannel>
				{/each}
		</div>
			{/if}
		{/if}
		<h3>All Channels</h3>
		<section class="config">
			<div>Filter</div>
			<select bind:value={filterSelected} on:change={changeFilter}>
				<option value="fav">❤ &gt; 0</option>
				<option value="default">Default</option>
			</select>
		</section>
		<div>
			{#each channels.filter(ch => (filterSelected === 'default' || filterSelected === 'fav' && ch.fav_count > 0) && ch.name) as channel}
				{#if !muteList.includes(channel.event.pubkey) && !muteChannels.includes(channel.event.id) && !wordList.some(word => channel.name.includes(word))}
			<SidebarChannel picture={profs[channel.event.pubkey]?.picture} url={nip19.neventEncode(channel.event)} channelName={channel.name} post_count={channel.post_count} fav_count={channel.fav_count}></SidebarChannel>
				{/if}
			{/each}
		</div>
		<p>Total: {channels.filter(ch => ch.name).length} channels</p>
	</section>
	<section class="config">
		<button
			id="nostr-zap-target"
			aria-label="Zap Button"
			data-npub="npub1dv9xpnlnajj69vjstn9n7ufnmppzq3wtaaq085kxrz0mpw2jul2qjy6uhz"
			data-note-id="note1fejz3tnexnfc5s8vf3f3fmmskyzadc78dgprqsn8z9mjajl7vjsqsrd2xh"
			data-relays={Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]).join(',')}
		>Zap Me ⚡️</button>
		<script src="https://cdn.jsdelivr.net/npm/nostr-zap@0.21.0"></script>
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
	max-width: 100%;
}
@media screen and (min-width: 1078px) {
	#sidebar {
		min-width: 380px;
	}
	#sidebar .config {
		max-width: 380px;
	}
	#sidebar table td {
		max-width: 280px;
	}
}

@media screen and (min-width: 1400px) {
	#sidebar {
		min-width: 500px;
	}
	#sidebar .config {
		max-width: 500px;
	}
	#sidebar table td {
		max-width: 400px;
	}
}

#sidebar table {
	table-layout: auto;
	width: auto;
}
#sidebar th {
	text-align: center;
}
#sidebar td {
	white-space: pre-wrap;
}
.config {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 20px;
}

</style>

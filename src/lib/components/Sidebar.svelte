<script lang='ts'>
import {
	SimplePool,
	nip19,
} from 'nostr-tools';
import { browser } from '$app/environment';
import { storedLoginpubkey, storedTheme, storedRelaysSelected, storedNeedApplyRelays } from '$lib/store';
import { urlDarkTheme, urlLightTheme, urlDefaultTheme, sendCreateChannel, type Channel, type Profile, type GetRelays } from '$lib/util';
import { onMount } from 'svelte';
import SidebarChannel from '$lib/components/SidebarChannel.svelte';

export let pool: SimplePool;
export let relaysToUse: {[key: string]: GetRelays};
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

storedTheme.subscribe((value) => {
	theme = value;
});

let newChannelName: string;
let newChannelAbout: string;
let newChannelPicture: string;

const login = async() => {
	if (browser && (window as any).nostr?.getPublicKey) {
		try {
			loginPubkey = await (window as any).nostr.getPublicKey();
			storedLoginpubkey.set(loginPubkey);
			storedNeedApplyRelays.set(true);
		} catch (error) {
			console.error(error);
		}
	}
};
const logout = () => {
	storedLoginpubkey.set('');
	storedNeedApplyRelays.set(true);
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
		storedTheme.set(urlDarkTheme);
		container?.classList.remove('light');
		container?.classList.add('dark');
	} else {
		storedTheme.set(urlLightTheme);
		container?.classList.remove('dark');
		container?.classList.add('light');
	}
};

const changeRelays = () => {
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
	<h3>Config</h3>
	<section class="config">
		<div>Login</div>
		<div>
			{#if loginPubkey}
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
		<div>リレーリスト取得</div>
		<select bind:value={relaysSelected} on:change={changeRelays}>
			<option value="kind3">Kind 3</option>
			<option value="kind10002">Kind 10002</option>
			<option value="nip07">NIP-07</option>
			<option value="default">Default</option>
		</select>
	</section>
	{/if}
	{#each Object.entries(relaysToUse) as relay}
	<section class="config">
		<div>{relay[0]}</div>
		<div>
			<label for="relay_read">
				<input type="checkbox" name="relay_read" checked={relay[1].read} disabled />
			</label>
			<label for="relay_write">
				<input type="checkbox" name="relay_write" checked={relay[1].write} disabled />
			</label>
		</div>
	</section>
	{/each}
	<section id="channels">
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
		<div>
				{#each channels.filter(ch => pinList.includes(ch.event.id)) as channel}
			<SidebarChannel picture={profs[channel.event.pubkey]?.picture} url={nip19.neventEncode(channel.event)} channelName={channel.name}></SidebarChannel>
				{/each}
		</div>
			{/if}
		{/if}
		<h3>All Channels</h3>
		<div>
			{#each channels as channel}
				{#if !muteList.includes(channel.event.pubkey) && !muteChannels.includes(channel.event.id) && !wordList.some(word => channel.name.includes(word))}
			<SidebarChannel picture={profs[channel.event.pubkey]?.picture} url={nip19.neventEncode(channel.event)} channelName={channel.name}></SidebarChannel>
				{/if}
			{/each}
		</div>
		<p>Total: {channels.length} channels</p>
	</section>
	<section class="config">
		<div>GitHub</div>
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
@media screen and (min-width: 1080px) {
	#sidebar {
		min-width: 500px;
	}
}

.config {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 20px;
}

/* details {
	display: inline-block;
}
details input,
details textarea {
	min-width: 15em;
}
ul {
	list-style: none;
} */

</style>
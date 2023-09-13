<script lang='ts'>

import {
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';
import Sidebar from './Sidebar.svelte';
import Timeline from './Timeline.svelte';
import Header from './Header.svelte';
import { sendFav, type Channel, type Profile } from '$lib/util';

export let title: string;
export let pool: SimplePool;
export let relaysToWrite: string[];
export let channels: Channel[];
export let notes: NostrEvent[];
export let notesQuoted: NostrEvent[];
export let profs: {[key: string]: Profile};
export let loginPubkey: string;
export let importRelays: Function;
export let muteList: string[];
export let useRelaysNIP07: boolean;
export let relaysToUse: object;
export let theme: string;
export let currentChannelId: string | null
export let sendMessage: (content: string) => Promise<void>
export let currentPubkey: string | null
export let applyRelays: Function
export let favList: string[];
export let favedList: NostrEvent[];

let inputText: string;

const callSendMessage = () => {
	const content = inputText;
	const savedPubkey = loginPubkey;
	inputText = '';
	loginPubkey = '';
	sendMessage(content).then(() => {loginPubkey = savedPubkey;});
}
</script>

<div id="container">
	<Header {title} />
	<Sidebar {theme} {relaysToUse} {loginPubkey} {useRelaysNIP07} {channels} {profs} {importRelays} {applyRelays} />
	<main>
	{#if currentChannelId}
		{@const channel = channels.filter(v => v.id === currentChannelId)[0]}
		<h2>{channel?.name ?? 'Now Loading...'}</h2>
		{#if channel}
		<p id="channel-about">{#if channel.picture}<img src="{channel.picture}" width="100" height="100" alt="banner" />{/if}{channel.about ?? ''}</p>
		{/if}
		{#if profs[channel?.pubkey]}
		<p id="channel-owner"><img src="{profs[channel.pubkey].picture}" width="32" height="32" alt="{profs[channel.pubkey].display_name}" />@{profs[channel.pubkey].name}</p>
		{/if}
	{:else if currentPubkey}
		{#if profs[currentPubkey]}
		<h2>{profs[currentPubkey].display_name ?? ''} @{profs[currentPubkey].name ?? ''}</h2>
		<p class="about"><img src="{profs[currentPubkey].picture || './default.png'}" alt="@{profs[currentPubkey].name ?? ''}" width="32" height="32">{profs[currentPubkey].about ?? ''}</p>
		{:else}
		<h2>Now Loading...</h2>
		{/if}
	{:else}
		<h2>Global timeline</h2>
	{/if}
		<Timeline {pool} {relaysToWrite} {notes} {notesQuoted} {profs} {channels} {sendFav} {loginPubkey} {muteList} {favList} {favedList} />
	{#if currentChannelId}
		<div id="input" class="show">
			{#if loginPubkey}
			<textarea id="input-text" bind:value={inputText}></textarea>
				{#if inputText !== ''}
				<button on:click={callSendMessage}>Post</button>
				{:else}
				<button disabled>Post</button>
				{/if}
			{:else}
				<textarea id="input-text" disabled></textarea>
				<button disabled>Post</button>
			{/if}
		</div>
	{/if}
	</main>
</div>

<style>
:global(html) {
	width: 100%;
	height: 100%;
}
:global(html > body) {
	width: 100%;
	height: 100%;
	margin-top: 0;
	padding: 0;
	max-width: 100%;
}
#container {
	width: 100%;
	height: 100%;
	display: flex;
	overflow: hidden;
}
main {
	margin-top: 3em;
	padding: 0 5px;
	width: calc(100vw - (100vw - 100%));
	height: calc(100% - 3em);
	overflow-x: hidden;
	overflow-y: scroll;
	word-break: break-all;
}
#channel-about {
	white-space: pre-wrap;
}
#channel-about > img {
	float: left;
}
#channel-owner {
	clear: left;
}
#input {
	position: fixed;
	width: 100%;
	height: 8em;
	bottom: -8em;
	left: -0.5em;
	background-color: rgba(64, 32, 128, 0.7);
	transition: bottom 0.1s;
}
#input.show {
	bottom: 0;
}
#input > textarea {
	margin: 1em 1em 0.5em 1em;
	width: calc(100% - 2em);
	height: 3.5em;
}
#input > button {
	margin-left: 1em;
}
.about {
	white-space: pre-wrap;
}
</style>

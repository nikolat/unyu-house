<script lang='ts'>

import type {
	SimplePool,
	Event as NostrEvent,
} from 'nostr-tools';
import { sendMessage, type Channel, type Profile } from '$lib/util';
import Sidebar from './Sidebar.svelte';
import Timeline from './Timeline.svelte';
import Header from './Header.svelte';
import ChannelMetadata from './ChannelMetadata.svelte';

export let title: string;
export let pool: SimplePool;
export let channels: Channel[];
export let notes: NostrEvent[];
export let notesQuoted: NostrEvent[];
export let profs: {[key: string]: Profile};
export let loginPubkey: string;
export let importRelays: Function;
export let muteList: string[];
export let relaysToUse: object;
export let theme: string;
export let currentChannelId: string | null
export let currentPubkey: string | null
export let applyRelays: Function
export let favList: NostrEvent[];

let inputText: string;

const callSendMessage = () => {
	if (!currentChannelId)
		return;
	const content = inputText;
	inputText = '';
	const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
	const recommendedRelay = channels.filter(v => v.id === currentChannelId)[0]?.recommendedRelay ?? '';
	sendMessage(pool, relaysToWrite, content, currentChannelId, recommendedRelay, '', []);
};

const showPostBar = () => {
	const input = document.getElementById('input');
	input?.classList.add('show');
};

const hidePostBar = () => {
	const input = document.getElementById('input');
	input?.classList.remove('show');
}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div id="container" on:click={hidePostBar}>
	<Header {title} />
	<Sidebar {pool} {theme} {relaysToUse} {loginPubkey} {channels} {profs} {importRelays} {applyRelays} />
	<main>
	{#if currentChannelId}
		{@const channel = channels.filter(v => v.id === currentChannelId)[0]}
		<ChannelMetadata {channel} {pool} {profs} {loginPubkey} {relaysToUse} isQuote={false} />
	{:else if currentPubkey}
		{#if profs[currentPubkey]}
		<h2><img src="{profs[currentPubkey].picture || './default.png'}" alt="@{profs[currentPubkey].name ?? ''}" width="32" height="32"> {profs[currentPubkey].display_name ?? ''} @{profs[currentPubkey].name ?? ''}</h2>
		<p id="profile-about">{profs[currentPubkey].about ?? ''}</p>
		{:else}
		<h2>Now Loading...</h2>
		{/if}
	{:else}
		<h2>Global timeline</h2>
	{/if}
		<Timeline {pool} relaysToWrite={Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0])} {notes} {notesQuoted} {profs} {channels} {loginPubkey} {muteList} {favList} />
	{#if currentChannelId && loginPubkey}
		<div id="input" class="show" on:click|stopPropagation={()=>{}}>
			{#if loginPubkey}
			<textarea id="input-text" bind:value={inputText}></textarea>
				{#if inputText}
				<button on:click={callSendMessage}>Post</button>
				{:else}
				<button disabled>Post</button>
				{/if}
			{:else}
				<textarea id="input-text" disabled></textarea>
				<button disabled>Post</button>
			{/if}
		</div>
		<button id="show-post-bar" on:click|stopPropagation={showPostBar}><svg><use xlink:href="/pencil-create.svg#pencil"></use></svg></button>
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
#profile-about {
	white-space: pre-wrap;
}
#show-post-bar {
	position: fixed;
	right: 1em;
	bottom: 1em;
	background-color: transparent;
}
#show-post-bar svg {
	width: 24px;
	height: 24px;
}
#input.show+#show-post-bar {
	display: none;
}
:global(#container.dark #show-post-bar) {
	fill: white;
}
:global(#container.light #show-post-bar) {
	fill: black;
}
</style>

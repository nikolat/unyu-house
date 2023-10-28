<script lang='ts'>
import { type Channel, type Profile, sendPin, type GetRelays, sendMute, sendEditChannel } from '$lib/util';
import { SimplePool, nip19 } from 'nostr-tools';

export let channel: Channel;
export let pool: SimplePool;
export let profs: {[key: string]: Profile};
export let loginPubkey: string;
export let relaysToUse: {[key: string]: GetRelays};
export let isQuote: boolean;
export let pinList: string[];
export let muteChannels: string[];

let editChannelName: string;
let editChannelAbout: string;
let editChannelPicture: string;

const setChannelMetadata = (currentChannelName: string, currentChannelAbout: string, currentChannelPicture: string) => {
	editChannelName = currentChannelName;
	editChannelAbout = currentChannelAbout;
	editChannelPicture = currentChannelPicture;
	return '';
};

const callSendEditChannel = () => {
	if (channel?.event.id) {
		sendEditChannel(pool, relaysToUse, loginPubkey, channel.event.id, editChannelName, editChannelAbout, editChannelPicture);
	}
};

const callSendPin = (toSet: boolean) => {
	sendPin(pool, relaysToUse, loginPubkey, channel.event.id, toSet);
}

const callSendMute = (toSet: boolean) => {
	sendMute(pool, relaysToUse, loginPubkey, channel.event.id, toSet);
}

</script>

{#if channel}
<h2>{#if isQuote}<a href="/channels/{nip19.neventEncode(channel.event)}">{channel.name}</a>{:else}{channel.name}{/if}</h2>
{:else}
<h2>Now Loading...</h2>
{/if}
{#if channel}
<figure>
	{#if channel.picture}<img src="{channel.picture}" width="100" height="100" alt="banner" />{/if}
	{#if channel.about || profs[channel.event.pubkey]}
	<figcaption id="channel-about">
		{#if channel.about}
		<div>{channel.about}</div>
		{/if}
		{#if profs[channel.event.pubkey] && !isQuote}
		<div id="channel-owner">
			<img src="{profs[channel.event.pubkey].picture}" width="32" height="32" alt="@{profs[channel.event.pubkey].name}" />
			<a href="/{nip19.npubEncode(channel.event.pubkey)}">@{profs[channel.event.pubkey].name ?? ''}</a>
		</div>
		{/if}
	</figcaption>
	{/if}
</figure>
	{#if loginPubkey === channel.event.pubkey && !isQuote}
<details>
	<summary>Edit Channel</summary>
	{setChannelMetadata(channel.name, channel.about, channel.picture)}
	<form>
		<dl>
			<dt><label for="edit-channel-name">Name</label></dt>
			<dd><input id="edit-channel-name" type="text" placeholder="channel name" bind:value={editChannelName} /></dd>
			<dt><label for="edit-channel-about">About</label></dt>
			<dd><textarea id="edit-channel-about" placeholder="channel description" bind:value={editChannelAbout}></textarea></dd>
			<dt><label for="edit-channel-picture">Picture</label></dt>
			<dd><input id="edit-channel-picture" type="url" placeholder="https://..." bind:value={editChannelPicture} /></dd>
		</dl>
		<button on:click={callSendEditChannel} disabled={!editChannelName}>Edit</button>
	</form>
</details>
	{/if}
	{#if loginPubkey && !isQuote}
		{#if pinList.includes(channel.event.id)}
<button class="channel-metadata on" on:click={() => callSendPin(false)}><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button>
		{:else}
<button class="channel-metadata off" on:click={() => callSendPin(true)}><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button>
		{/if}
		{#if muteChannels.includes(channel.event.id)}
<button class="channel-metadata on" on:click={() => callSendMute(false)}><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button>
		{:else}
<button class="channel-metadata off" on:click={() => callSendMute(true)}><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button>
		{/if}
	{/if}
{/if}

<style>
#channel-about {
	white-space: pre-wrap;
}
details {
	display: inline-block;
	margin: 0;
}
details input,
details textarea {
	min-width: 15em;
}
button.channel-metadata, details {
	vertical-align: middle;
}
button.channel-metadata {
	background-color: transparent;
	border: none;
	outline: none;
	padding: 0;
	width: 24px;
	height: 24px;
}
button.channel-metadata > svg {
	width: 24px;
	height: 24px;
}
:global(#container.dark button.channel-metadata) {
	fill: white;
}
:global(#container.light button.channel-metadata) {
	fill: black;
}
:global(#container button.channel-metadata.on) {
	fill: pink;
}
</style>

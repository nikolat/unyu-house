<script lang='ts'>
import { sendEditChannel, type Channel, type Profile, sendPin } from "$lib/util";
import { SimplePool, nip19 } from "nostr-tools";

export let channel: Channel;
export let pool: SimplePool;
export let profs: {[key: string]: Profile};
export let loginPubkey: string;
export let relaysToUse: object;
export let isQuote: boolean;
export let pinList: string[];

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
	if (channel?.id) {
		sendEditChannel(pool, relaysToUse, loginPubkey, channel.id, editChannelName, editChannelAbout, editChannelPicture);
	}
};

const callSendPin = (toSet: boolean) => {
	sendPin(pool, relaysToUse, loginPubkey, channel.id, toSet);
}

</script>

{#if channel}
{@const channelId = nip19.neventEncode({id:channel.id, relays:[channel.recommendedRelay], author:channel.pubkey})}
<h2>{#if isQuote}<a href="/channels/{channelId}">{channel.name}</a>{:else}{channel.name}{/if}</h2>
{:else}
<h2>Now Loading...</h2>
{/if}
{#if channel}
<figure>
	{#if channel.picture}<img src="{channel.picture}" width="100" height="100" alt="banner" />{/if}
	{#if channel.about || profs[channel.pubkey]}
	<figcaption id="channel-about">
		{#if channel.about}
		<div>{channel.about}</div>
		{/if}
		{#if profs[channel.pubkey] && !isQuote}
		<div id="channel-owner">
			<img src="{profs[channel.pubkey].picture}" width="32" height="32" alt="@{profs[channel.pubkey].name}" />
			<a href="/{nip19.npubEncode(channel.pubkey)}">@{profs[channel.pubkey].name ?? ''}</a>
		</div>
		{/if}
	</figcaption>
	{/if}
</figure>
	{#if loginPubkey === channel.pubkey && !isQuote}
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
		{#if pinList.includes(channel.id)}
<button class="channel-metadata on" on:click={() => callSendPin(false)}><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button>
		{:else}
<button class="channel-metadata off" on:click={() => callSendPin(true)}><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button>
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

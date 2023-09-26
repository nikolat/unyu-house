<script lang='ts'>

import {
	nip19,
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';
import { sendFav, sendDeletion, sendMessage, getExpandTagsList , type Profile, type Channel } from '$lib/util';
import Quote from './Quote.svelte';

export let pool: SimplePool;
export let relaysToWrite: string[];
export let notes: NostrEvent[];
export let notesQuoted: NostrEvent[];
export let profs: {[key: string]: Profile};
export let channels: Channel[];
export let loginPubkey: string;
export let muteList: string[];
export let wordList: string[];
export let favList: NostrEvent[];

let inputText: {[key: string]: string} = {};

const getImageUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/\S+\.(jpe?g|png|gif|webp)/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};
const getVideoUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/\S+\.mp4/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};

const callSendMessage = (noteId: string, currentChannelId: string, replyId: string, pubkeysToReply:string[]) => {
	const content = inputText[noteId];
	if (!content)
		return;
	inputText[noteId] = '';
	const recommendedRelay = channels.filter(v => v.id === currentChannelId)[0]?.recommendedRelay ?? '';
	sendMessage(pool, relaysToWrite, content, currentChannelId, recommendedRelay, replyId, pubkeysToReply);
};

const callSendDeletion = async (pool: SimplePool, relaysToWrite: string[], noteId: string) => {
	if (!confirm('Delete this post?')) {
		return;
	}
	notes = notes.filter(ev => ev.id !== noteId);
	await sendDeletion(pool, relaysToWrite, noteId);
};

</script>

<p>Total: {notes.length} posts</p>
<dl>
{#each notes as note}
	{#if !muteList?.includes(note.pubkey) && !wordList?.reduce((accumulator, currentValue) => accumulator || note.content.includes(currentValue), false)}
		<dt id="{note.id}">
		{#if profs[note.pubkey]}
			<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
		{:else}
			<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
		{/if}
		<br />
		<time>{(new Date(1000 * note.created_at)).toLocaleString()}</time>
		{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
			{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
			{@const channel = channels.filter(v => v.id === rootId)[0]}
			{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
			{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? '(unknown channel)'}
			{#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
		{/if}
		</dt>
		<dd>
		{#if true}
			{@const replyTags = note.tags.filter(v => v[0] === 'e' && v[3] === 'reply')}
			{@const replyPubkeys = note.tags.filter(v => v[0] === 'p').map(v => v[1])}
			{#if replyTags.length > 0 || replyPubkeys.length > 0}
				<div class="info-header">
				{#if replyTags.length > 0}
					<a href="#{replyTags[0][1]}">&gt;&gt;</a>
				{/if}
				{#each replyPubkeys as pubkey}
					&nbsp;@{profs[pubkey]?.name ?? (nip19.npubEncode(pubkey).slice(0, 10) + '...')}
				{/each}
				</div>
			{/if}
			{@const r = getExpandTagsList(note.content, note.tags.filter(v => v[0] === 'emoji'))}
			{@const matchesIterator = r[0]}
			{@const plainTexts = r[1]}
			{@const emojiUrls = r[2]}
			<div class="content">
			{plainTexts.shift()}
			{#each matchesIterator as match}
				{#if /https?:\/\/\S+/.test(match[1]) }
					<a href="{match[1]}" target="_blank" rel="noopener noreferrer">{match[1]}</a>
				{:else if /nostr:npub\w{59}/.test(match[2])}
					{@const matchedText = match[2]}
					{@const npubText = matchedText.replace(/nostr:/, '')}
					{@const d = nip19.decode(npubText)}
					{#if d.type === 'npub'}
						<a href="/{npubText}">@{profs[d.data]?.name ?? (npubText.slice(0, 10) + '...')}</a>
					{:else}
						{matchedText}
					{/if}
				{:else if /nostr:note\w{59}/.test(match[3])}
					{@const matchedText = match[3]}
					<Quote {pool} {matchedText} {notes} {notesQuoted} {channels} {profs} {loginPubkey} />
				{:else if /nostr:nevent\w+/.test(match[4])}
					{@const matchedText = match[4]}
					<Quote {pool} {matchedText} {notes} {notesQuoted} {channels} {profs} {loginPubkey} />
				{:else if match[5]}
					{@const matchedText = match[5]}
					<img src="{emojiUrls[matchedText]}" alt="{matchedText}" title="{matchedText}" class="emoji" />
				{/if}
				{plainTexts.shift()}
			{/each}
			</div>
			{@const imageUrls = getImageUrls(note.content)}
			{#if imageUrls.length > 0}
				<div class="image-holder">
				{#each imageUrls as imageUrl}
					<figure><a href="{imageUrl}" target="_blank" rel="noopener noreferrer"><img src="{imageUrl}" alt="auto load" /></a></figure>
				{/each}
				</div>
			{/if}
			{@const videoUrls = getVideoUrls(note.content)}
			{#if videoUrls.length > 0}
				<div class="video-holder">
				{#each videoUrls as videoUrl}
					<video controls preload="metadata">
						<track kind="captions">
						<source src="{videoUrl}">
					</video>
				{/each}
				</div>
			{/if}
			{#if favList.some(ev => ev.tags.filter(tag => tag[0] === 'e' && tag[1] === note.id).length > 0 && profs[ev.pubkey])}
				<ul class="fav-holder" role="list">
				{#each favList as ev}
					{#if ev.tags.filter(tag => tag[0] === 'e' && tag[1] === note.id).length > 0 && profs[ev.pubkey]}
						{@const emojiTag = ev.tags.filter(tag => tag[0] === 'emoji')[0]}
						{@const prof = profs[ev.pubkey]}
						<li>
						{#if emojiTag && ev.content === `:${emojiTag[1]}:` && emojiTag[2]}
							<img src="{emojiTag[2]}" width="20" height="20" alt=":{emojiTag[1]}:" title=":{emojiTag[1]}:" />
						{:else}
							{ev.content.replace(/^\+$/, '❤')}
						{/if}
						<img src="{prof.picture || '/default.png'}" alt="avatar of {nip19.npubEncode(ev.pubkey)}"
							width="16" height="16" /> {prof.display_name} <a href="/{nip19.npubEncode(ev.pubkey)}">@{prof.name}</a> reacted</li>
					{/if}
				{/each}
				</ul>
			{/if}
		{/if}
			<div class="action-bar">
				{#if loginPubkey}
				<details>
					<summary>
						<svg><use xlink:href="/arrow-bold-reply.svg#reply"></use></svg><span>reply to @{#if profs[note.pubkey]}{profs[note.pubkey]?.name ?? ''}{:else}{nip19.npubEncode(note.pubkey).slice(0, 10)}...{/if}</span>
					</summary>
					<textarea id="input-text" bind:value={inputText[note.id]} disabled={!loginPubkey}></textarea>
					{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
						{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
						{@const replyId = note.id}
						{@const pubkeysToReply = [note.pubkey, ...note.tags.filter(tag => tag[0] === 'p').map(tag => tag[1])]}
						<button on:click={() => {callSendMessage(note.id, rootId, replyId, pubkeysToReply)}} disabled={!loginPubkey || !inputText[note.id]}>Reply</button>
					{/if}
				</details>
				<button class="fav" on:click={() => sendFav(pool, relaysToWrite, note.id, note.pubkey)} disabled={!loginPubkey}><svg><use xlink:href="/heart.svg#fav"></use></svg></button>
					{#if note.pubkey === loginPubkey}
				<button class="delete" on:click={() => callSendDeletion(pool, relaysToWrite, note.id)} disabled={!loginPubkey || note.pubkey !== loginPubkey}><svg><use xlink:href="/trash.svg#delete"></use></svg></button>
					{/if}
				{/if}
				<details>
					<summary><svg><use xlink:href="/more-horizontal.svg#more"></use></svg></summary>
					<dl class="details">
						<dt>User ID</dt>
						<dd><code>{nip19.npubEncode(note.pubkey)}</code></dd>
						<dt>Event ID</dt>
						<dd><code>{nip19.neventEncode({id:note.id, relays:pool.seenOn(note.id), author:note.pubkey})}</code></dd>
						<dt>Event JSON</dt>
						<dd><pre class="json-view"><code>{JSON.stringify(note, undefined, 2)}</code></pre></dd>
						<dt>Relays seen on</dt>
						<dd>
							<ul>
							{#each pool.seenOn(note.id) as relay}
								<li>{relay}</li>
							{/each}
							</ul>
						</dd>
					</dl>
				</details>
			</div>
		</dd>
	{/if}
{/each}
</dl>

<style>
dt time {
	margin-left: 32px;
}
dd {
	white-space: pre-wrap;
}
dd .info-header {
	color: #999;
}
dd .image-holder {
	display: flex;
}
dd .image-holder img,
dd .video-holder video {
	max-height: 200px;
	max-width: 100%;
}
dd .emoji {
	height: 32px;
}
dd ul.fav-holder {
	list-style: none;
}
dd .action-bar > * {
	vertical-align: top;
}

dl > dd > div.action-bar > button,
dl > dd > div.action-bar > details {
	margin-right: 20px;
}
dd dl * {
	font-size: small;
}
dd dl .json-view > code {
	font-size: x-small;
}
dd button.fav,
dd button.delete {
	background-color: transparent;
	border: none;
	outline: none;
	padding: 0;
	width: 24px;
	height: 24px;
}
dd button.fav > svg,
dd button.delete > svg {
	width: 24px;
	height: 24px;
}
dd details {
	display: inline-block;
	margin: 0;
}
dd details[open] {
	max-width: calc(100% - 170px);
}
dd details:only-child[open] {
	max-width: calc(100% - 30px);
}
dd .action-bar details,
dd .action-bar details summary {
	margin: 0;
	padding: 0;
}
dd .action-bar details summary {
	list-style: none;
}
dd .action-bar details summary::-webkit-details-marker {
	display:none;
}
dd .action-bar details:not([open]),
dd .action-bar details:not([open]) summary {
	background-color: transparent;
}
dd .action-bar details[open] summary {
	min-width: 30em;
}
dd .action-bar details[open] summary span {
	margin-left: 1em;
}
dd .action-bar details:not([open]) summary span {
	display: none;
}
dd .action-bar details dl {
	padding: 0 1em;
}
dd .action-bar details svg {
	width: 24px;
	height: 24px;
}
:global(#container.dark button.fav,
	#container.dark button.delete,
	#container.dark details) {
	fill: white;
}
:global(#container.light button.fav,
	#container.light button.delete,
	#container.light details) {
	fill: black;
}
:global(#container button.fav:active) {
	fill: pink;
}
</style>

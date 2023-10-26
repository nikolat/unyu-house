<script lang='ts'>

import {
	nip19,
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';
import { sendFav, sendDeletion, sendMessage, getExpandTagsList , type Profile, type Channel } from '$lib/util';
import Quote from './Quote.svelte';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
// @ts-ignore
import type { BaseEmoji } from '@types/emoji-mart';

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
export let resetScroll: Function;

let emojiPicker: {[key: string]: HTMLElement} = {};
let visible: {[key: string]: boolean} = {};

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
const getAudioUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/\S+\.(mp3|m4a|wav|ogg|aac)/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};

const showContentWarning = (noteId: string) => {
	const dd = document.querySelector(`#note-${noteId} + dd`);
	dd?.querySelector('button.content-warning-show')?.classList.add('hide');
	dd?.querySelector('div.content-warning-reason')?.classList.add('hide');
	dd?.querySelector('div.content-warning-target')?.classList.remove('hide');
};

const callSendMessage = (noteToReplay: NostrEvent) => {
	const noteId = noteToReplay.id;
	const content = inputText[noteId];
	if (!content)
		return;
	inputText[noteId] = '';
	const details = <HTMLDetailsElement>document.querySelector(`#note-${noteId} + dd div.action-bar details`);
	details.open = false;
	resetScroll();
	sendMessage(pool, relaysToWrite, content, noteToReplay);
};

const callSendEmoji = (pool: SimplePool, relaysToWrite: string[], targetEvent: NostrEvent) => {
	const noteId = targetEvent.id;
	visible[noteId] = !visible[noteId];
	if (emojiPicker[noteId].children.length > 0) {
		return;
	}
	const picker = new Picker({
		data,
		onEmojiSelect
	});
	function onEmojiSelect(emoji: BaseEmoji) {
		visible[noteId] = false;
		sendFav(pool, relaysToWrite, targetEvent, emoji.native);
	}
	emojiPicker[noteId].appendChild(picker as any);
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
	{@const rootId = note.tags.find(v => v[0] === 'e' && v[3] === 'root')?.at(1)}
	{@const channel = channels.find(v => v.event.id === rootId)}
	{#if rootId !== undefined && channel !== undefined}
		{@const isMutedNotePubkey = muteList.includes(note.pubkey)}
		{@const isMutedNoteWord = wordList.reduce((accumulator, currentValue) => accumulator || note.content.includes(currentValue), false)}
		{@const isMutedChannelPubkey = muteList.includes(channel.event.pubkey)}
		{@const isMutedChannelWord = wordList.reduce((accumulator, currentValue) => accumulator || channel.name.includes(currentValue), false)}
		{@const isMuted = isMutedNotePubkey || isMutedNoteWord || isMutedChannelPubkey || isMutedChannelWord}
		{#if !isMuted}
			{@const npub = nip19.npubEncode(note.pubkey)}
			{@const nevent = nip19.neventEncode(note)}
			<dt id="note-{note.id}">
			{#if profs[note.pubkey]}
				<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {npub}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} <a href="/{npub}">@{profs[note.pubkey]?.name ?? ''}</a>
			{:else}
				<img src="/default.png" alt="" width="32" height="32"><a href="/{npub}">@{npub.slice(0, 10)}...</a>
			{/if}
				<br />
				<a href="/{nevent}"><time>{(new Date(1000 * note.created_at)).toLocaleString()}</time></a>
				<a href="/channels/{nip19.neventEncode(channel.event)}">{channel.name}</a>
			</dt>
			{@const replyTags = note.tags.filter(v => v[0] === 'e' && v[3] === 'reply')}
			{@const replyPubkeys = note.tags.filter(v => v[0] === 'p').map(v => v[1])}
			{@const r = getExpandTagsList(note.content, note.tags.filter(v => v[0] === 'emoji'))}
			{@const matchesIterator = r[0]}
			{@const plainTexts = r[1]}
			{@const emojiUrls = r[2]}
			{@const imageUrls = getImageUrls(note.content)}
			{@const videoUrls = getVideoUrls(note.content)}
			{@const audioUrls = getAudioUrls(note.content)}
			{@const contentWarningTag = note.tags.filter(tag => tag[0] === 'content-warning')}
			<dd>
			{#if replyTags.length > 0 || replyPubkeys.length > 0}
				<div class="info-header">
				{#if replyTags.length > 0}
					<a href="#note-{replyTags[0][1]}">&gt;&gt;</a>
				{/if}
				{#each replyPubkeys as pubkey}
					&nbsp;@{profs[pubkey]?.name ?? (npub.slice(0, 10) + '...')}
				{/each}
				</div>
			{/if}
				<div class="content-warning-reason {contentWarningTag.length > 0 ? '' : 'hide'}">Content Warning{#if contentWarningTag.length > 0 && contentWarningTag[0][1]}<br />Reason: {contentWarningTag[0][1]}{/if}</div>
				<button class="content-warning-show {contentWarningTag.length > 0 ? '' : 'hide'}" on:click={() => showContentWarning(note.id)}>Show Content</button>
				<div class="content-warning-target {contentWarningTag.length > 0 ? 'hide' : ''}">
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
			{#if imageUrls.length > 0}
					<div class="image-holder">
				{#each imageUrls as imageUrl}
						<figure><a href="{imageUrl}" target="_blank" rel="noopener noreferrer"><img src="{imageUrl}" alt="auto load" /></a></figure>
				{/each}
					</div>
			{/if}
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
			{#if audioUrls.length > 0}
					<div class="audio-holder">
				{#each audioUrls as audioUrl}
						<audio controls preload="metadata" src="{audioUrl}"></audio>
				{/each}
					</div>
			{/if}
				</div>
			{#if favList.some(ev => ev.tags.findLast(tag => tag[0] === 'e')?.at(1) === note.id && profs[ev.pubkey])}
				<ul class="fav-holder" role="list">
				{#each favList as ev}
					{#if ev.tags.findLast(tag => tag[0] === 'e')?.at(1) === note.id && profs[ev.pubkey]}
						{@const emojiTag = ev.tags.find(tag => tag.length >= 3 && tag[0] === 'emoji')}
						{@const prof = profs[ev.pubkey]}
						{@const npubFaved = nip19.npubEncode(ev.pubkey)}
						<li>
						{#if emojiTag && ev.content === `:${emojiTag[1]}:` && emojiTag[2]}
							<img src="{emojiTag[2]}" width="20" height="20" alt=":{emojiTag[1]}:" title=":{emojiTag[1]}:" />
						{:else}
							{ev.content.replace(/^\+$/, '❤').replace(/^-$/, '👎') || '❤'}
						{/if}
						<img src="{prof.picture || '/default.png'}" alt="avatar of {npubFaved}"
							width="16" height="16" /> {prof.display_name ?? ''} <a href="/{npubFaved}">@{prof.name ?? ''}</a> reacted</li>
					{/if}
				{/each}
				</ul>
			{/if}
				<div class="action-bar">
					{#if loginPubkey}
					<details>
						<summary>
							<svg><use xlink:href="/arrow-bold-reply.svg#reply"></use></svg><span>reply to @{#if profs[note.pubkey]}{profs[note.pubkey]?.name ?? ''}{:else}{npub.slice(0, 10)}...{/if}</span>
						</summary>
						<textarea id="input-text" bind:value={inputText[note.id]} disabled={!loginPubkey}></textarea>
						<button on:click={() => {callSendMessage(note)}} disabled={!loginPubkey || !inputText[note.id]}>Reply</button>
					</details>
					<button class="fav" on:click={() => sendFav(pool, relaysToWrite, note, '+')} disabled={!loginPubkey}><svg><use xlink:href="/heart.svg#fav"></use></svg></button>
					<button class="emoji" on:click={() => callSendEmoji(pool, relaysToWrite, note)} disabled={!loginPubkey}><svg><use xlink:href="/smiled.svg#emoji"></use></svg></button>
					<div bind:this={emojiPicker[note.id]} class={visible[note.id] ? '' : 'hidden'}></div>
						{#if note.pubkey === loginPubkey}
					<button class="delete" on:click={() => callSendDeletion(pool, relaysToWrite, note.id)} disabled={!loginPubkey || note.pubkey !== loginPubkey}><svg><use xlink:href="/trash.svg#delete"></use></svg></button>
						{/if}
					{/if}
					<details>
						<summary><svg><use xlink:href="/more-horizontal.svg#more"></use></svg></summary>
						<dl class="details">
							<dt>User ID</dt>
							<dd><code>{npub}</code></dd>
							<dt>Event ID</dt>
							<dd><code>{nevent}</code></dd>
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
dd button.content-warning-show,
dd div.content-warning-reason {
	display: none;
}
dd button.content-warning-show:not(.hide),
dd div.content-warning-reason:not(.hide) {
	display: inherit;
}
dd div.content-warning-target.hide {
	visibility: hidden;
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
dd button.emoji,
dd button.delete {
	background-color: transparent;
	border: none;
	outline: none;
	padding: 0;
	width: 24px;
	height: 24px;
}
dd button.fav > svg,
dd button.emoji > svg,
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
div.hidden {
	display: none;
}
:global(#container.dark button.fav,
	#container.dark button.emoji,
	#container.dark button.delete,
	#container.dark details) {
	fill: white;
}
:global(#container.light button.fav,
	#container.light button.emoji,
	#container.light button.delete,
	#container.light details) {
	fill: black;
}
:global(#container button.fav:active) {
	fill: pink;
}
</style>

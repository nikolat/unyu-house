<script lang='ts'>

import {
	nip19,
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';
import { sendFav } from '$lib/util';

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
export let relaysToWrite: string[];
export let notes: NostrEvent[];
export let notesQuoted: NostrEvent[];
export let profs: {[key: string]: Profile};
export let channels: Channel[];
export let loginPubkey: string;
export let muteList: string[];
export let favList: NostrEvent[];

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

const getExpandTagsList = (content: string, tags: string[][]): [IterableIterator<RegExpMatchArray>, string[], {[key: string]: string}] => {
	const regMatchArray = ['https?://[\\w!?/=+\\-_~;.,*&@#$%()[\\]]+', 'nostr:(npub\\w{59})', 'nostr:(note\\w{59})', 'nostr:(nevent\\w+)'];
	const emojiUrls: {[key: string]: string} = {};
	const emojiRegs = [];
	for (const tag of tags) {
		emojiRegs.push(':' + tag[1] + ':');
		emojiUrls[':' + tag[1] + ':'] = tag[2];
	}
	if (emojiRegs.length > 0) {
		regMatchArray.push(emojiRegs.join('|'));
	}
	const regMatch = new RegExp(regMatchArray.map(v => '(' + v + ')').join('|'), 'g');
	const regSplit = new RegExp(regMatchArray.map(v => v.replace('(', '').replace(')', '')).join('|'));
	const plainTexts = content.split(regSplit);
	const matchesIterator = content.matchAll(regMatch);
	return [matchesIterator, plainTexts, emojiUrls];
};

</script>

<p>Total: {notes.length} posts</p>
<dl>
{#each notes as note}
	{#if !muteList?.includes(note.pubkey)}
		<dt id="{note.id}">
		{#if profs[note.pubkey]}
			<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
		{:else}
			<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
		{/if}
		{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
			{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
			{@const channel = channels.filter(v => v.id === rootId)[0]}
			{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
			{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? '(unknown channel)'}
			{#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
			<br /><time>{(new Date(1000 * note.created_at)).toLocaleString()}</time>
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
				{:else if /npub\w{59}/.test(match[3])}
					{@const d = nip19.decode(match[3])}
					{#if d.type === 'npub'}
						<a href="/{match[3]}">@{profs[d.data]?.name ?? (match[3].slice(0, 10) + '...')}</a>
					{:else}
						{match[2]}
					{/if}
				{:else if /note\w{59}/.test(match[5])}
					{@const d = nip19.decode(match[5])}
					{#if d.type === 'note' && (notes.filter(v => v.id === d.data).length > 0 || notesQuoted.filter(v => v.id === d.data).length > 0)}
						{@const note = notes.filter(v => v.id === d.data)[0] ?? notesQuoted.filter(v => v.id === d.data)[0]}
						<blockquote>
							<dl>
								<dt>
								{#if profs[note.pubkey]}
									<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
								{:else}
									<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
								{/if} 
								{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
									{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
									{@const channel = channels.filter(v => v.id === rootId)[0]}
									{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
									{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? '(unknown channel)'}
									{#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
								{/if}
								<br /><time>{(new Date(1000 * note.created_at)).toLocaleString()}</time> kind:{note.kind}
								</dt>
								<dd>{note.content}</dd>
							</dl>
						</blockquote>
					{:else}
						{match[4]}
					{/if}
				{:else if /nevent\w+/.test(match[7])}
					{@const d = nip19.decode(match[7])}
					{#if d.type === 'nevent' && (notes.filter(v => v.id === d.data.id).length > 0 || notesQuoted.filter(v => v.id === d.data.id).length > 0)}
						{@const note = notes.filter(v => v.id === d.data.id)[0] ?? notesQuoted.filter(v => v.id === d.data.id)[0]}
						<blockquote>
							<dl>
								<dt>
								{#if profs[note.pubkey]}
									<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32" /> {profs[note.pubkey].display_name ?? ''} | <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
								{:else}
									<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
								{/if}| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} 
								{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
									{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
									{@const channel = channels.filter(v => v.id === rootId)[0]}
									{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
									{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? '(unknown channel)'}
									| {#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
								{/if}
								</dt>
								<dd>{note.content}</dd>
							</dl>
						</blockquote>
					{:else}
						{match[6]}
					{/if}
				{:else if match[8]}
					<img src="{emojiUrls[match[8]]}" alt="{match[8]}" class="emoji" />
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
						{@const reaction = ev.content.replace(/^\+$/, '❤')}
						{@const prof = profs[ev.pubkey]}
						<li>{reaction} <img src="{prof.picture || '/default.png'}" alt="avatar of {nip19.npubEncode(ev.pubkey)}"
							width="16" height="16" /> {prof.display_name} @{prof.name} reacted</li>
					{/if}
				{/each}
				</ul>
			{/if}
		{/if}
			<div class="action-bar">
				<button on:click={() => sendFav(pool, relaysToWrite, note.id, note.pubkey)} disabled={!loginPubkey}>☆fav</button>
				<details>
					<summary>JSON</summary>
					<pre class="json-view"><code>{JSON.stringify(note, undefined, 2)}</code></pre>
				</details>
			</div>
		</dd>
	{/if}
{/each}
</dl>

<style>
dt {
	border-top: 1px dashed #666;
}
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
dd details {
	display: inline-block;
	margin: 0;
}
dd details[open] {
	max-width: 100%;
}
dd .json-view {
	font-size: x-small;
}
</style>

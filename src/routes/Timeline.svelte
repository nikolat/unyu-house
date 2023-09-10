<script lang='ts'>
import {
	nip19,
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';

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
export let sendFav: (pool: SimplePool, relaysToWrite: string[], noteid: string, targetPubkey: string) => Promise<void>
export let loginPubkey: string;
export let muteList: string[];
export let favList: string[];

const getImagesUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/.+\.(jpe?g|png|gif)/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};
</script>

<p>投稿取得数: {notes.length}</p>
<dl>
{#each notes as note}
	{#if !muteList.includes(note.pubkey)}
		<dt id="{note.id}">
		{#if profs[note.pubkey]}
			<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
		{:else}
			<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
		{/if}
		{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
			{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
			{@const channel = channels.filter(v => v.id === rootId)[0]}
			{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
			{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? 'チャンネル情報不明'}
			| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} | {#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
		{/if}
		</dt>
		<dd>
			<div class="info-header">
			{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'reply').length > 0}
				<a href="#{note.tags.filter(v => v[0] === 'e' && v[3] === 'reply')[0][1]}">&gt;&gt;</a>
			{/if}
			{#each note.tags.filter(v => v[0] === 'p').map(v => v[1]) as pubkey}
				&nbsp;@{profs[pubkey]?.name ?? (nip19.npubEncode(pubkey).slice(0, 10) + '...')}
			{/each}
			</div>
		{#if true}
			{@const regMatch = /(https?:\/\/\S+)|(nostr:(npub\w{59}))|(nostr:(note\w{59}))|(nostr:(nevent\w+))/g }
			{@const regSplit = /https?:\/\/\S+|nostr:npub\w{59}|nostr:note\w{59}|nostr:nevent\w+/}
			{@const plainTexts = note.content.split(regSplit)}
			{plainTexts.shift()}
			{#each note.content.matchAll(regMatch) as match}
				{#if /https?:\/\/\S+/.test(match[1]) }
					<a href="{match[1]}">{match[1]}</a>
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
									<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
								{:else}
									<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
								{/if}| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} 
								{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
									{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
									{@const channel = channels.filter(v => v.id === rootId)[0]}
									{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
									{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? 'チャンネル情報不明'}
									| {#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
								{/if}
								</dt>
								<dd>{note.content}</dd>
							</dl>
						</blockquote>
					{:else}
						{match[4]}
					{/if}
				{:else if /nevent\w+/.test(match[7])}
					{@const d = nip19.decode(match[7])}
					{#if d.type === 'nevent' && notes.filter(v => v.id === d.data.id).length > 0}
						{@const note = notes.filter(v => v.id === d.data.id)[0]}
						<blockquote>
							<dl>
								<dt>
								{#if profs[note.pubkey]}
									<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} | <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
								{:else}
									<img src="/default.png" alt="" width="32" height="32"><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
								{/if}| {(new Date(1000 * note.created_at)).toLocaleString()} | kind:{note.kind} 
								{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
									{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
									{@const channel = channels.filter(v => v.id === rootId)[0]}
									{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
									{@const channelName = (channels.filter(v => v.id === rootId)[0])?.name ?? 'チャンネル情報不明'}
									| {#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
								{/if}
								</dt>
								<dd>{note.content}</dd>
							</dl>
						</blockquote>
					{:else}
						{match[6]}
					{/if}
				{/if}
				{plainTexts.shift()}
			{/each}
		{/if}
		{#each getImagesUrls(note.content) as imageUrl}
			<div class="image-holder"><a href="{imageUrl}"><img src="{imageUrl}" alt="" /></a></div>
		{/each}
			<div class="action-bar">
				{#if !favList.includes(note.id)}
					<button on:click={() => sendFav(pool, relaysToWrite, note.id, note.pubkey)} disabled={!loginPubkey}>☆ふぁぼる</button>
				{:else}
					<button disabled>★ふぁぼ済</button>
				{/if}
				<span class="json-view-button">[...]</span>
				<div class="json-view">{JSON.stringify(note, undefined, 2)}</div>
			</div>
		</dd>
	{/if}
{/each}
</dl>

<style>
dt {
	border-top: 1px solid #666;
}
dd {
	border-top: 1px dashed #999;
	white-space: pre-wrap;
}
dd .info-header {
	color: #999;
}
dd img {
	max-height: 200px;
	max-width: 100%;
}
blockquote {
	border: 1px dashed #666;
	background-color: #eee;
}
.action-bar > * {
	vertical-align: top;
}
.json-view-button:hover + .json-view,
.json-view:hover {
	display: inline-block;
}
.json-view {
	font-size: x-small;
	border: 1px solid #333;
	background-color: #eee;
	display: none;
	margin: -0.5em 0 0 -0.5em;
}
</style>

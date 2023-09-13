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
export let favedList: NostrEvent[];

const getImagesUrls = (content: string) => {
	const matchesIterator = content.matchAll(/https?:\/\/.+\.(jpe?g|png|gif)/g);
	const urls = [];
	for (const match of matchesIterator) {
		urls.push(match[0]);
	}
	return urls;
};

const getExpandTagsList = (content: string, tags: string[][]): [IterableIterator<RegExpMatchArray>, string[], {[key: string]: string}] => {
	const regMatchArray = ['https?://\\S+', 'nostr:(npub\\w{59})', 'nostr:(note\\w{59})', 'nostr:(nevent\\w+)'];
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
			<div class="info-header">
			{#if note.tags.filter(v => v[0] === 'e' && v[3] === 'reply').length > 0}
				<a href="#{note.tags.filter(v => v[0] === 'e' && v[3] === 'reply')[0][1]}">&gt;&gt;</a>
			{/if}
			{#each note.tags.filter(v => v[0] === 'p').map(v => v[1]) as pubkey}
				&nbsp;@{profs[pubkey]?.name ?? (nip19.npubEncode(pubkey).slice(0, 10) + '...')}
			{/each}
			</div>
		{#if true}
			{@const r = getExpandTagsList(note.content, note.tags.filter(v => v[0] === 'emoji'))}
			{@const matchesIterator = r[0]}
			{@const plainTexts = r[1]}
			{@const emojiUrls = r[2]}
			{plainTexts.shift()}
			{#each matchesIterator as match}
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
		{/if}
		{#each getImagesUrls(note.content) as imageUrl}
			<div class="image-holder"><a href="{imageUrl}"><img src="{imageUrl}" alt="" /></a></div>
		{/each}
			<ul class="fav-holder">
			{#each favedList as favedEvent}
				{#if favedEvent.tags.filter(v => v[0] === 'e' && v[1] === note.id).length > 0 && profs[favedEvent.pubkey]}
					{@const reaction = favedEvent.content.replace(/^\+$/, '❤')}
					<li>{reaction} <img src="{profs[favedEvent.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(favedEvent.pubkey)}" width="16" height="16" /> {profs[favedEvent.pubkey].display_name} @{profs[favedEvent.pubkey].name} reacted</li>
				{/if}
			{/each}
			</ul>
			<div class="action-bar">
				{#if !favList.includes(note.id)}
					<button on:click={() => sendFav(pool, relaysToWrite, note.id, note.pubkey)} disabled={!loginPubkey}>☆fav</button>
				{:else}
					<button disabled>★</button>
				{/if}
				<details>
					<summary>JSON</summary>
					<div class="json-view">{JSON.stringify(note, undefined, 2)}</div>
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
dd {
	white-space: pre-wrap;
}
dd .info-header {
	color: #999;
}
dd img {
	max-height: 200px;
	max-width: 100%;
}
.emoji {
	height: 32px;
}
.action-bar > * {
	vertical-align: top;
}
details {
	display: inline-block;
	margin: 0;
}
.json-view {
	font-size: x-small;
}
time {
	margin-left: 32px;
}
</style>

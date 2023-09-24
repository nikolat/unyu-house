<script lang='ts'>
import {
	nip19,
	SimplePool,
	type Event as NostrEvent,
} from 'nostr-tools';
import type { Channel, Profile } from '$lib/util';
import { urlToLinkNote } from '$lib/config';
import ChannelMetadata from './ChannelMetadata.svelte';

export let pool: SimplePool;
export let matchedText: string;
export let notes: NostrEvent[];
export let notesQuoted: NostrEvent[];
export let channels: Channel[];
export let profs: {[key: string]: Profile};
export let loginPubkey: string;

const getNote = (eventText: string) => {
	const d = nip19.decode(eventText);
	if ((d.type === 'note') && ((notes.filter(v => v.id === d.data).length > 0) || (notesQuoted.filter(v => v.id === d.data).length > 0))) {
		return notes.filter(v => v.id === d.data)[0] ?? notesQuoted.filter(v => v.id === d.data)[0];
	}
	else if ((d.type === 'nevent') && ((notes.filter(v => v.id === d.data.id).length > 0) || (notesQuoted.filter(v => v.id === d.data.id).length > 0))) {
		return notes.filter(v => v.id === d.data.id)[0] ?? notesQuoted.filter(v => v.id === d.data.id)[0];
	}
	return null;
};

</script>

{#if true}
	{@const eventText = matchedText.replace(/nostr:/, '')}
	{@const note = getNote(eventText)}
	{#if note}
	<blockquote>
		{#if note.kind === 40}
		{@const channel = channels.filter(v => v.id === note.id)[0]}
		<ChannelMetadata {channel} {pool} {profs} {loginPubkey} relaysToUse={{}} isQuote={true} pinList={[]} />
		{:else}
		<dl>
			<dt>
			{#if profs[note.pubkey]}
				<img src="{profs[note.pubkey].picture || '/default.png'}" alt="avatar of {nip19.npubEncode(note.pubkey)}" width="32" height="32"> {profs[note.pubkey].display_name ?? ''} <a href="/{nip19.npubEncode(note.pubkey)}">@{profs[note.pubkey]?.name ?? ''}</a>
			{:else}
				<img src="/default.png" alt="" width="32" height="32" /><a href="/{nip19.npubEncode(note.pubkey)}">@{nip19.npubEncode(note.pubkey).slice(0, 10)}...</a>
			{/if}
			<br /><time>{(new Date(1000 * note.created_at)).toLocaleString()}</time> {#if note.kind === 1}<a href="{urlToLinkNote}/{eventText}" target="_blank" rel="noopener noreferrer">kind:1</a>{:else}kind:{note.kind}{/if}
			{#if note.kind === 42 && note.tags.filter(v => v[0] === 'e' && v[3] === 'root').length > 0}
				{@const rootId = note.tags.filter(v => v[0] === 'e' && v[3] === 'root')[0][1]}
				{@const channel = channels.filter(v => v.id === rootId)[0]}
				{@const channelId = nip19.neventEncode({id:rootId, relays:[channel?.recommendedRelay], author:channel?.pubkey})}
				{@const channelName = channel?.name ?? '(unknown channel)'}
				{#if channel}<a href="/channels/{channelId}">{channelName}</a>{:else}{channelName}{/if}
			{/if}
			</dt>
			<dd>{note.content}</dd>
		</dl>
		{/if}
	</blockquote>
	{:else}
		{matchedText}
	{/if}
{/if}

<script lang="ts">
  import type { NostrEvent } from 'nostr-tools/pure';
  import * as nip19 from 'nostr-tools/nip19';
  import type { Channel, Profile } from '$lib/util';
  import { urlToLinkNote } from '$lib/config';
  import ChannelMetadata from './ChannelMetadata.svelte';
  import type { RxNostr } from 'rx-nostr';

  export let rxNostr: RxNostr;
  export let seenOn: Map<string, Set<string>>;
  export let matchedText: string;
  export let notes: NostrEvent[];
  export let notesQuoted: NostrEvent[];
  export let channels: Channel[];
  export let profs: { [key: string]: Profile };
  export let loginPubkey: string;
  export let muteList: string[];
  export let muteChannels: string[];
  export let wordList: string[];

  const getNote = (eventText: string) => {
    let d;
    try {
      d = nip19.decode(eventText);
    } catch (error) {
      return null;
    }
    if (d.type === 'note' && (notes.some((v) => v.id === d.data) || notesQuoted.some((v) => v.id === d.data))) {
      return notes.find((v) => v.id === d.data) ?? notesQuoted.find((v) => v.id === d.data);
    } else if (
      d.type === 'nevent' &&
      (notes.some((v) => v.id === d.data.id) ||
        notesQuoted.some((v) => v.id === d.data.id) ||
        channels.some((v) => v.event.id === d.data.id))
    ) {
      return (
        notes.find((v) => v.id === d.data.id) ??
        notesQuoted.find((v) => v.id === d.data.id) ??
        channels.find((v) => v.event.id === d.data.id)?.event
      );
    }
    return null;
  };
</script>

{#if true}
  {@const eventText = matchedText.replace(/nostr:/, '')}
  {@const note = getNote(eventText)}
  {#if note}
    {@const isMutedNotePubkey = muteList.includes(note.pubkey)}
    {@const isMutedNoteChannel = muteChannels.includes(note.id)}
    {@const isMutedNoteWord = wordList.some((word) => note.content.includes(word))}
    {@const isMuted = isMutedNotePubkey || isMutedNoteChannel || isMutedNoteWord}
    {#if !isMuted}
      <blockquote>
        {#if note.kind === 40}
          {@const channel = channels.find((v) => v.event.id === note.id)}
          {#if channel !== undefined}
            <ChannelMetadata
              {channel}
              {rxNostr}
              {seenOn}
              {profs}
              isLoggedin={false}
              {loginPubkey}
              relaysToUse={{}}
              isQuote={true}
              pinList={[]}
              muteChannels={[]}
            />
          {:else}
            {matchedText}
          {/if}
        {:else}
          {@const npub = nip19.npubEncode(note.pubkey)}
          {@const rootId = note.tags.find((tag) => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1)}
          {@const linkid = note.kind === 1 ? nip19.noteEncode(note.id) : nip19.neventEncode(note)}
          <dl>
            <dt>
              {#if profs[note.pubkey]}
                <img src={profs[note.pubkey].picture || '/default.png'} alt="avatar of {npub}" width="32" height="32" />
                {profs[note.pubkey].display_name ?? ''}
                <a href="/{npub}">@{profs[note.pubkey]?.name ?? ''}</a>
              {:else}
                <img src="/default.png" alt="" width="32" height="32" /><a href="/{npub}">@{npub.slice(0, 10)}...</a>
              {/if}
              <br />
              {#if note.kind === 42}
                <a href="/{linkid}"><time>{new Date(1000 * note.created_at).toLocaleString()}</time></a>
              {:else}
                <a href="{urlToLinkNote}/{linkid}" target="_blank" rel="noopener noreferrer"
                  ><time>{new Date(1000 * note.created_at).toLocaleString()}</time></a
                >
              {/if}kind:{note.kind}
              {#if note.kind === 42 && rootId !== undefined}
                {@const channel = channels.find((v) => v.event.id === rootId)}
                {#if rootId && channel}
                  <a href="/channels/{nip19.neventEncode(channel.event)}">{channel.name}</a>
                {:else}
                  (unknown channel)
                {/if}
              {/if}
            </dt>
            <dd>{note.content}</dd>
          </dl>
        {/if}
      </blockquote>
    {:else}
      (Muted)
    {/if}
  {:else}
    {matchedText}
  {/if}
{/if}

<script lang="ts">
  import {
    type Channel,
    type Profile,
    sendPin,
    sendMute,
    sendEditChannel,
    broadcast,
  } from '$lib/util';
  import type { RelayRecord } from 'nostr-tools/relay';
  import * as nip19 from 'nostr-tools/nip19';
  import type { EventPacket, RxNostr } from 'rx-nostr';
  import type { OperatorFunction } from 'rxjs';

  export let channel: Channel;
  export let rxNostr: RxNostr;
  export let tie: OperatorFunction<
    EventPacket,
    EventPacket & { seenOn: Set<string>; isNew: boolean }
  >;
  export let seenOn: Map<string, Set<string>>;
  export let profs: { [key: string]: Profile };
  export let isLoggedin: boolean;
  export let loginPubkey: string;
  export let relaysToUse: RelayRecord;
  export let isQuote: boolean;
  export let pinList: string[];
  export let muteChannels: string[];

  let editChannelName: string;
  let editChannelAbout: string;
  let editChannelPicture: string;

  const setChannelMetadata = (
    currentChannelName: string,
    currentChannelAbout: string,
    currentChannelPicture: string,
  ) => {
    editChannelName = currentChannelName;
    editChannelAbout = currentChannelAbout;
    editChannelPicture = currentChannelPicture;
    return '';
  };

  const callSendEditChannel = () => {
    if (channel?.event.id) {
      sendEditChannel(
        rxNostr,
        tie,
        seenOn,
        relaysToUse,
        loginPubkey,
        channel.event.id,
        editChannelName,
        editChannelAbout,
        editChannelPicture,
      );
    }
  };

  const callBroadcast = async () => {
    const relaysToWrite = Object.entries(relaysToUse)
      .filter((v) => v[1].write)
      .map((v) => v[0]);
    if (
      !confirm(
        `Are you sure you want to broadcast this channel event? (kind 40 and 41)\n${relaysToWrite.join('\n')}`,
      )
    ) {
      return;
    }
    await broadcast(rxNostr, relaysToWrite, channel.event, channel.event41);
    alert('Completed.');
  };

  const callSendPin = (toSet: boolean) => {
    sendPin(rxNostr, tie, relaysToUse, loginPubkey, channel.event.id, toSet);
  };

  const callSendMute = (toSet: boolean) => {
    sendMute(rxNostr, tie, relaysToUse, loginPubkey, channel.event.id, toSet);
  };
</script>

{#if channel}
  <h2>
    {#if isQuote}<a href="/channels/{nip19.neventEncode(channel.event)}"
        >{channel.name}</a
      >{:else}{channel.name}{/if}
  </h2>
{:else}
  <h2>Now Loading...</h2>
{/if}
{#if channel}
  <figure>
    {#if channel.picture}<img
        src={channel.picture}
        width="100"
        height="100"
        alt="banner"
      />{/if}
    {#if channel.about || profs[channel.event.pubkey]}
      <figcaption id="channel-about">
        {#if channel.about}
          <div>{channel.about}</div>
        {/if}
        {#if profs[channel.event.pubkey] && !isQuote}
          <div id="channel-owner">
            <img
              src={profs[channel.event.pubkey].picture}
              width="32"
              height="32"
              alt="@{profs[channel.event.pubkey].name}"
            />
            <a href="/{nip19.npubEncode(channel.event.pubkey)}"
              >@{profs[channel.event.pubkey].name ?? ''}</a
            >
          </div>
        {/if}
      </figcaption>
    {/if}
  </figure>
  {#if isLoggedin && loginPubkey === channel.event.pubkey && !isQuote}
    <details>
      <summary>Edit Channel</summary>
      {setChannelMetadata(channel.name, channel.about, channel.picture)}
      <form>
        <dl>
          <dt><label for="edit-channel-name">Name</label></dt>
          <dd>
            <input
              id="edit-channel-name"
              type="text"
              placeholder="channel name"
              bind:value={editChannelName}
            />
          </dd>
          <dt><label for="edit-channel-about">About</label></dt>
          <dd>
            <textarea
              id="edit-channel-about"
              placeholder="channel description"
              bind:value={editChannelAbout}
            ></textarea>
          </dd>
          <dt><label for="edit-channel-picture">Picture</label></dt>
          <dd>
            <input
              id="edit-channel-picture"
              type="url"
              placeholder="https://..."
              bind:value={editChannelPicture}
            />
          </dd>
        </dl>
        <button on:click={callSendEditChannel} disabled={!editChannelName}
          >Edit</button
        >
      </form>
    </details>
  {/if}
  {#if !isQuote}
    <button
      class="channel-metadata"
      on:click={() => callBroadcast()}
      title="Broadcast"
      ><svg><use xlink:href="/copy.svg#broadcast"></use></svg></button
    >
  {/if}
  {#if isLoggedin && loginPubkey && !isQuote}
    {#if pinList.includes(channel.event.id)}
      <button
        class="channel-metadata on"
        on:click={() => callSendPin(false)}
        title="Remove Pin"
        ><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button
      >
    {:else}
      <button
        class="channel-metadata off"
        on:click={() => callSendPin(true)}
        title="Add Pin"
        ><svg><use xlink:href="/bookmark.svg#pin"></use></svg></button
      >
    {/if}
    {#if muteChannels.includes(channel.event.id)}
      <button
        class="channel-metadata on"
        on:click={() => callSendMute(false)}
        title="Unmute"
        ><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button
      >
    {:else}
      <button
        class="channel-metadata off"
        on:click={() => callSendMute(true)}
        title="Mute"
        ><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button
      >
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
  button.channel-metadata,
  details {
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

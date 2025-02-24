<script lang="ts">
  import type { NostrEvent } from 'nostr-tools/pure';
  import * as nip19 from 'nostr-tools/nip19';
  import { sendRepost, sendFav, sendDeletion, sendMessage, getExpandTagsList, type Profile, type Channel, zap } from '$lib/util';
  import { preferences, storedRelaysToUse } from '$lib/store';
  import { defaultRelays, urlToLinkNaddr } from '$lib/config';
  import Quote from './Quote.svelte';
  import data from '@emoji-mart/data';
  import { Picker } from 'emoji-mart';
  // @ts-ignore
  import type { BaseEmoji } from '@types/emoji-mart';
  import type { RxNostr } from 'rx-nostr';

  export let rxNostr: RxNostr;
  export let seenOn: Map<string, Set<string>>;
  export let relaysToWrite: string[];
  export let notes: NostrEvent[];
  export let notesQuoted: NostrEvent[];
  export let profs: { [key: string]: Profile };
  export let channels: Channel[];
  export let isLoggedin: boolean;
  export let loginPubkey: string;
  export let muteList: string[];
  export let muteListFav: string[];
  export let muteListRepost: string[];
  export let muteListZap: string[];
  export let muteChannels: string[];
  export let wordList: string[];
  export let repostList: NostrEvent[];
  export let favList: NostrEvent[];
  export let zapList: NostrEvent[];
  export let resetScroll: Function;
  export let importRelays: Function;
  export let emojiMap: Map<string, string>;
  export let theme: string;
  export let relaysSelected: string;

  preferences.subscribe((value: any) => {
    theme = value.theme ?? theme;
    loginPubkey = value.loginPubkey;
    isLoggedin = value.isLoggedin;
    relaysSelected = value.loginPubkey;
  });

  let emojiPicker: { [key: string]: HTMLElement } = {};
  let visible: { [key: string]: boolean } = {};

  let inputText: { [key: string]: string } = {};

  const getImageUrls = (content: string) => {
    const matchesIterator = content.matchAll(/https?:\/\/\S+\.(jpe?g|png|gif|webp)/gi);
    const urls = [];
    for (const match of matchesIterator) {
      urls.push(match[0]);
    }
    return urls;
  };
  const getVideoUrls = (content: string) => {
    const matchesIterator = content.matchAll(/https?:\/\/\S+\.(mp4|mov)/gi);
    const urls = [];
    for (const match of matchesIterator) {
      urls.push(match[0]);
    }
    return urls;
  };
  const getAudioUrls = (content: string) => {
    const matchesIterator = content.matchAll(/https?:\/\/\S+\.(mp3|m4a|wav|ogg|aac)/gi);
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
    if (!content) return;
    inputText[noteId] = '';
    const details: HTMLDetailsElement = document.querySelector(`#note-${noteId} + dd div.action-bar details`)!;
    details.open = false;
    resetScroll();
    sendMessage(rxNostr, seenOn, relaysToWrite, content, noteToReplay, emojiMap);
  };

  const submitFromKeyboard = (event: KeyboardEvent, noteToReplay: NostrEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      callSendMessage(noteToReplay);
    }
  };

  const callSendEmoji = (rxNostr: RxNostr, relaysToWrite: string[], targetEvent: NostrEvent) => {
    const noteId = targetEvent.id;
    visible[noteId] = !visible[noteId];
    if (emojiPicker[noteId].children.length > 0) {
      return;
    }
    const picker = new Picker({
      data,
      custom: [
        {
          id: 'custom-emoji',
          name: 'Custom Emojis',
          emojis: Array.from(emojiMap.entries()).map(([shortcode, url]) => {
            return {
              id: shortcode,
              name: shortcode,
              keywords: [shortcode],
              skins: [{ shortcodes: `:${shortcode}:`, src: url }],
            };
          }),
        },
      ],
      onEmojiSelect,
    });
    function onEmojiSelect(emoji: BaseEmoji) {
      visible[noteId] = false;
      sendFav(rxNostr, relaysToWrite, targetEvent, emoji.native ?? ((emoji as any).shortcodes as string), (emoji as any).src as string);
    }
    emojiPicker[noteId].appendChild(picker as any);
  };

  const callSendDeletion = async (rxNostr: RxNostr, relaysToWrite: string[], event: NostrEvent) => {
    if (!confirm('Delete this post?')) {
      return;
    }
    await sendDeletion(rxNostr, relaysToWrite, event);
    notes = notes.filter((ev) => ev.id !== event.id);
  };

  const loginAsThisAccount = (pubkey: string) => {
    loginPubkey = pubkey;
    const relaysSelected = 'default';
    preferences.set({ theme, loginPubkey, isLoggedin, relaysSelected });
    storedRelaysToUse.set(defaultRelays);
    importRelays(relaysSelected);
  };

  const getevent9734 = (event9735: NostrEvent): NostrEvent => {
    const event9734 = JSON.parse(event9735.tags.find((tag) => tag[0] === 'description')?.at(1) ?? '{}');
    return event9734;
  };

  const getDefaultAvatar = (pubkey: string, size: number = 32): string => {
    const url = `https://api.dicebear.com/9.x/thumbs/svg?seed=${nip19.npubEncode(pubkey)}&size=${size}`;
    return url;
  };

  $: notesToShow = [...notes, ...repostList].sort((a, b) => {
    if (a.created_at < b.created_at) {
      return -1;
    }
    if (a.created_at > b.created_at) {
      return 1;
    }
    return 0;
  });
</script>

<p>Total: {notesToShow.slice(-50).length} posts</p>
<dl>
  {#each notesToShow.slice(-50) as note}
    {@const noteOrg =
      note.kind === 42
        ? note
        : [...notes, ...notesQuoted].find((ev) => ev.id === note.tags.find((tag) => tag.length >= 2 && tag[0] === 'e')?.at(1))}
    {@const rootId = noteOrg?.tags.find((v) => v[0] === 'e' && v[3] === 'root')?.at(1)}
    {@const channel = channels.find((v) => v.event.id === rootId)}
    {#if noteOrg !== undefined && rootId !== undefined && channel !== undefined && channel.name}
      {@const isMutedNotePubkey = muteList.includes(noteOrg.pubkey) || muteList.includes(note.pubkey)}
      {@const isMutedRepostPubkey = note.kind === 16 && muteListRepost.includes(note.pubkey)}
      {@const isMutedNoteChannel = muteChannels.includes(rootId)}
      {@const isMutedNoteWord = wordList.some((word) => noteOrg.content.includes(word))}
      {@const isMutedChannelPubkey = muteList.includes(channel.event.pubkey)}
      {@const isMutedChannelWord = wordList.some((word) => channel.name.includes(word))}
      {@const isMuted =
        isMutedNotePubkey || isMutedRepostPubkey || isMutedNoteChannel || isMutedNoteWord || isMutedChannelPubkey || isMutedChannelWord}
      {#if !isMuted}
        {@const npub = nip19.npubEncode(note.pubkey)}
        {@const npubOrg = nip19.npubEncode(noteOrg.pubkey)}
        {@const nevent = nip19.neventEncode({ ...note, author: note.pubkey })}
        {@const neventOrg = nip19.neventEncode({
          ...noteOrg,
          author: noteOrg.pubkey,
        })}
        <dt id="note-{note.id}">
          {#if note.kind === 16}
            reposted by
            {#if profs[note.pubkey]}
              <img src={profs[note.pubkey].picture || getDefaultAvatar(note.pubkey, 16)} alt="avatar of {npub}" width="16" height="16" />
              {profs[note.pubkey].display_name ?? ''}
              <a href="/{npub}">@{profs[note.pubkey]?.name ?? ''}</a>
            {:else}
              <img src={getDefaultAvatar(note.pubkey, 16)} alt="" width="16" height="16" /><a href="/{npub}">@{npub.slice(0, 10)}...</a>
            {/if}
            <br />
            <time>{new Date(1000 * note.created_at).toLocaleString()}</time>
            <br />
          {/if}
          {#if profs[noteOrg.pubkey]}
            <img
              src={profs[noteOrg.pubkey].picture || getDefaultAvatar(noteOrg.pubkey, 32)}
              alt="avatar of {npubOrg}"
              width="32"
              height="32"
            />
            {profs[noteOrg.pubkey].display_name ?? ''}
            <a href="/{npubOrg}">@{profs[noteOrg.pubkey]?.name ?? ''}</a>
          {:else}
            <img src={getDefaultAvatar(noteOrg.pubkey, 32)} alt="" width="32" height="32" /><a href="/{npubOrg}"
              >@{npubOrg.slice(0, 10)}...</a
            >
          {/if}
          <br />
          <a href="/{neventOrg}"><time>{new Date(1000 * noteOrg.created_at).toLocaleString()}</time></a>
          <a href="/channels/{nip19.neventEncode(channel.event)}">{channel.name}</a>
        </dt>
        {@const replyTags = noteOrg.tags.filter((v) => v[0] === 'e' && v[3] === 'reply')}
        {@const replyPubkeys = noteOrg.tags.filter((v) => v[0] === 'p').map((v) => v[1])}
        {@const r = getExpandTagsList(
          noteOrg.content,
          noteOrg.tags.filter((v) => v[0] === 'emoji'),
        )}
        {@const matchesIterator = r[0]}
        {@const plainTexts = r[1]}
        {@const emojiUrls = r[2]}
        {@const imageUrls = getImageUrls(noteOrg.content)}
        {@const videoUrls = getVideoUrls(noteOrg.content)}
        {@const audioUrls = getAudioUrls(noteOrg.content)}
        {@const contentWarningTag = noteOrg.tags.filter((tag) => tag[0] === 'content-warning')}
        <dd>
          {#if replyTags.length > 0 || replyPubkeys.length > 0}<div class="info-header">
              {#if replyTags.length > 0}<a href="#note-{replyTags[0][1]}">&gt;&gt;</a>{/if}{#each replyPubkeys as pubkey}&nbsp;@{profs[
                  pubkey
                ]?.name ?? npubOrg.slice(0, 10) + '...'}{/each}
            </div>{/if}
          <div class="content-warning-reason {contentWarningTag.length > 0 ? '' : 'hide'}">
            Content Warning{#if contentWarningTag.length > 0 && contentWarningTag[0][1]}<br />Reason: {contentWarningTag[0][1]}{/if}
          </div>
          <button class="content-warning-show {contentWarningTag.length > 0 ? '' : 'hide'}" on:click={() => showContentWarning(noteOrg.id)}
            >Show Content</button
          >
          <div class="content-warning-target {contentWarningTag.length > 0 ? 'hide' : ''}">
            <div class="content">
              {plainTexts.shift()}{#each Array.from(matchesIterator) as match}{#if /https?:\/\/\S+/.test(match[1])}<a
                    href={match[1]}
                    target="_blank"
                    rel="noopener noreferrer">{match[1]}</a
                  >{:else if /nostr:npub\w{59}/.test(match[2])}{@const matchedText = match[2]}{@const npubText = matchedText.replace(
                    /nostr:/,
                    '',
                  )}{@const d = nip19.decode(npubText)}{#if d.type === 'npub'}<a href="/{npubText}"
                      >@{profs[d.data]?.name ?? npubText.slice(0, 10) + '...'}</a
                    >{:else}{matchedText}{/if}{:else if /nostr:nprofile\w+/.test(match[3])}{@const matchedText =
                    match[3]}{@const nprofileText = matchedText.replace(/nostr:/, '')}{@const d =
                    nip19.decode(nprofileText)}{#if d.type === 'nprofile'}<a href="/{nprofileText}"
                      >@{profs[d.data.pubkey]?.name ?? nprofileText.slice(0, 10) + '...'}</a
                    >{:else}{matchedText}{/if}{:else if /nostr:note\w{59}/.test(match[4])}{@const matchedText = match[4]}<Quote
                    {rxNostr}
                    {seenOn}
                    {matchedText}
                    {notes}
                    {notesQuoted}
                    {channels}
                    {profs}
                    {loginPubkey}
                    {muteList}
                    {muteChannels}
                    {wordList}
                  />{:else if /nostr:nevent\w+/.test(match[5])}{@const matchedText = match[5]}<Quote
                    {rxNostr}
                    {seenOn}
                    {matchedText}
                    {notes}
                    {notesQuoted}
                    {channels}
                    {profs}
                    {loginPubkey}
                    {muteList}
                    {muteChannels}
                    {wordList}
                  />{:else if /nostr:naddr\w+/.test(match[6])}{@const matchedText = match[6]}{@const naddrText = matchedText.replace(
                    /nostr:/,
                    '',
                  )}<a href="{urlToLinkNaddr}/{naddrText}" target="_blank" rel="noopener noreferrer">{matchedText}</a
                  >{:else if /#\S+/.test(match[7])}{@const matchedText = match[7]}<a
                    href="/hashtag/{encodeURI(matchedText.toLowerCase().replace('#', ''))}">{matchedText}</a
                  >{:else if match[8]}{@const matchedText = match[8]}<img
                    src={emojiUrls[matchedText]}
                    alt={matchedText}
                    title={matchedText}
                    class="emoji"
                  />{/if}{plainTexts.shift()}{/each}
            </div>
            {#if imageUrls.length > 0}<div class="image-holder">
                {#each imageUrls as imageUrl}<figure>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer"><img src={imageUrl} alt="auto load" /></a>
                  </figure>{/each}
              </div>{/if}{#if videoUrls.length > 0}<div class="video-holder">
                {#each videoUrls as videoUrl}<video controls preload="metadata">
                    <track kind="captions" />
                    <source src={videoUrl} />
                  </video>{/each}
              </div>{/if}{#if audioUrls.length > 0}<div class="audio-holder">
                {#each audioUrls as audioUrl}<audio controls preload="metadata" src={audioUrl}></audio>{/each}
              </div>{/if}
          </div>
          {#if favList.some((ev) => ev.tags
                .findLast((tag) => tag.length >= 2 && tag[0] === 'e')
                ?.at(1) === noteOrg.id && profs[ev.pubkey])}<ul class="fav-holder" role="list">
              {#each favList as ev}{#if ev.tags
                  .findLast((tag) => tag[0] === 'e')
                  ?.at(1) === noteOrg.id && profs[ev.pubkey] && !muteList.includes(ev.pubkey) && !muteListFav.includes(ev.pubkey)}{@const emojiTag =
                    ev.tags.find((tag) => tag.length >= 3 && tag[0] === 'emoji')}{@const prof = profs[ev.pubkey]}{@const npubFaved =
                    nip19.npubEncode(ev.pubkey)}
                  <li>
                    {#if emojiTag && ev.content === `:${emojiTag[1]}:` && emojiTag[2]}<img
                        src={emojiTag[2]}
                        width="20"
                        height="20"
                        alt=":{emojiTag[1]}:"
                        title=":{emojiTag[1]}:"
                      />{:else}{ev.content.replace(/^\+$/, '❤').replace(/^-$/, '👎') || '❤'}{/if}<img
                      src={prof.picture || getDefaultAvatar(ev.pubkey, 16)}
                      alt="avatar of {npubFaved}"
                      width="16"
                      height="16"
                    />
                    {prof.display_name ?? ''}
                    <a href="/{npubFaved}">@{prof.name ?? ''}</a> reacted
                  </li>{/if}{/each}
            </ul>{/if}{#if zapList.some((ev) => ev.tags.find((tag) => tag.length >= 2 && tag[0] === 'e')?.at(1) === noteOrg.id)}<ul
              class="zap-holder"
              role="list"
            >
              {#each zapList as ev}{@const event9734 = getevent9734(ev)}{#if event9734.tags
                  .find((tag) => tag[0] === 'e')
                  ?.at(1) === noteOrg.id && profs[event9734.pubkey] && !muteList.includes(event9734.pubkey) && !muteListZap.includes(event9734.pubkey)}{@const prof =
                    profs[event9734.pubkey]}{@const npubZapped = nip19.npubEncode(event9734.pubkey)}
                  <li>
                    <svg><use xlink:href="/lightning.svg#zap"></use></svg>
                    <img src={prof.picture || getDefaultAvatar(ev.pubkey, 16)} alt="avatar of {npubZapped}" width="16" height="16" />
                    {prof.display_name ?? ''}
                    <a href="/{npubZapped}">@{prof.name ?? ''}</a>
                    zapped{#if event9734.content}<blockquote>
                        {event9734.content}
                      </blockquote>{/if}
                  </li>{/if}{/each}
            </ul>{/if}
          <div class="action-bar">
            {#if isLoggedin}<details>
                <summary>
                  <svg><use xlink:href="/arrow-bold-reply.svg#reply"></use></svg><span
                    >reply to @{#if profs[noteOrg.pubkey]}{profs[noteOrg.pubkey]?.name ?? ''}{:else}{npubOrg.slice(0, 10)}...{/if}</span
                  >
                </summary>
                <textarea
                  name="input-text"
                  bind:value={inputText[noteOrg.id]}
                  on:keydown={(e) => {
                    submitFromKeyboard(e, noteOrg);
                  }}
                ></textarea><button
                  on:click={() => {
                    callSendMessage(noteOrg);
                  }}
                  disabled={!inputText[noteOrg.id]}>Reply</button
                >
              </details>
              <button class="repost" on:click={() => sendRepost(rxNostr, seenOn, relaysToWrite, noteOrg)} title="Repost" aria-label="Repost"
                ><svg><use xlink:href="/refresh-cw.svg#repost"></use></svg></button
              ><button class="fav" on:click={() => sendFav(rxNostr, relaysToWrite, noteOrg, '+')} title="Fav" aria-label="Fav"
                ><svg><use xlink:href="/heart.svg#fav"></use></svg></button
              ><button
                class="emoji"
                on:click={() => callSendEmoji(rxNostr, relaysToWrite, noteOrg)}
                title="Emoji fav"
                aria-label="Emoji fav"><svg><use xlink:href="/smiled.svg#emoji"></use></svg></button
              >
              <div bind:this={emojiPicker[noteOrg.id]} class={visible[noteOrg.id] ? '' : 'hidden'}></div>
              <button
                id="zap-{note.id}"
                aria-label="Zap Button"
                class="zap"
                title="Zap!"
                on:click={() => zap(npubOrg, nip19.noteEncode(noteOrg.id), relaysToWrite)}
                ><svg><use xlink:href="/lightning.svg#zap"></use></svg></button
              >{#if noteOrg.pubkey === loginPubkey}<button
                  class="delete"
                  on:click={() => callSendDeletion(rxNostr, relaysToWrite, noteOrg)}
                  title="Delete"
                  aria-label="Delete"><svg><use xlink:href="/trash.svg#delete"></use></svg></button
                >{/if}{:else}<button
                class="login-as-this-account"
                on:click={() => loginAsThisAccount(noteOrg.pubkey)}
                title="Login with this pubkey"
                aria-label="Login with this pubkey"><svg><use xlink:href="/eye.svg#login-as-this-account"></use></svg></button
              >{/if}
            <details>
              <summary><svg><use xlink:href="/more-horizontal.svg#more"></use></svg></summary>
              <dl class="details">
                <dt>User ID</dt>
                <dd><code>{npubOrg}</code></dd>
                <dt>Event ID</dt>
                <dd><code>{neventOrg}</code></dd>
                <dt>Event JSON</dt>
                <dd>
                  <pre class="json-view"><code>{JSON.stringify(noteOrg, undefined, 2)}</code></pre>
                </dd>
                <dt>Relays seen on</dt>
                <dd>
                  <ul>
                    {#each Array.from(seenOn.get(noteOrg.id) ?? []) as relay}
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
  img {
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    font-size: 100%;
    vertical-align: baseline;
    background: transparent;
    vertical-align: top;
    font-size: 0;
    line-height: 0;
  }
  dt {
    border-top: #999 solid 1px;
  }
  dt time {
    margin-left: 32px;
  }
  dd {
    white-space: pre-wrap;
    max-height: 50em;
    overflow-y: auto;
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
  dd ul.fav-holder,
  dd ul.zap-holder {
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
  dd button.repost,
  dd button.fav,
  dd button.emoji,
  dd button.zap,
  dd button.delete,
  dd button.login-as-this-account {
    background-color: transparent;
    border: none;
    outline: none;
    padding: 0;
    width: 24px;
    height: 24px;
  }
  .zap-holder svg {
    width: 24px;
    height: 24px;
    fill: yellow;
  }
  dd button.repost > svg,
  dd button.fav > svg,
  dd button.emoji > svg,
  dd button.zap > svg,
  dd button.delete > svg,
  dd button.login-as-this-account > svg {
    width: 24px;
    height: 24px;
  }
  dd details {
    display: inline-block;
    margin: 0;
  }
  dd details[open] {
    max-width: 100%;
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
    display: none;
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
  :global(
    #container.dark button.repost,
    #container.dark button.fav,
    #container.dark button.emoji,
    #container.dark button.zap,
    #container.dark button.delete,
    #container.dark button.login-as-this-account,
    #container.dark details
  ) {
    fill: white;
  }
  :global(
    #container.light button.repost,
    #container.light button.fav,
    #container.light button.emoji,
    #container.light button.zap,
    #container.light button.delete,
    #container.light button.login-as-this-account,
    #container.light details
  ) {
    fill: black;
  }
  :global(#container button.fav:active) {
    fill: pink;
  }
</style>

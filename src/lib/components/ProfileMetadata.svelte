
<script lang='ts'>
import { getExpandTagsList, type Profile } from "$lib/util";
import { nip19 } from "nostr-tools";

export let profs: {[key: string]: Profile};
export let currentPubkey: string;
</script>

<h2><img src="{profs[currentPubkey].picture || './default.png'}" alt="@{profs[currentPubkey].name ?? ''}" width="32" height="32"> {profs[currentPubkey].display_name ?? ''} @{profs[currentPubkey].name ?? ''}</h2>
{#if profs[currentPubkey].about}
{@const r = getExpandTagsList(profs[currentPubkey].about, [])}
{@const matchesIterator = r[0]}
{@const plainTexts = r[1]}
{@const emojiUrls = r[2]}
<p id="profile-about">
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
		{:else if match[5]}
			{@const matchedText = match[5]}
			<img src="{emojiUrls[matchedText]}" alt="{matchedText}" title="{matchedText}" class="emoji" />
		{/if}
		{plainTexts.shift()}
	{/each}
</p>
{/if}
{#if profs[currentPubkey].website}<p id="profile-website"><a href="{profs[currentPubkey].website}" target="_blank" rel="noopener noreferrer">{profs[currentPubkey].website}</a></p>{/if}

<style>
#profile-about {
	white-space: pre-wrap;
}
</style>


<script lang='ts'>
import { getExpandTagsList, sendMuteUser, type GetRelays, type Profile, sendEditProfile } from "$lib/util";
import { nip19, SimplePool } from "nostr-tools";

export let pool: SimplePool;
export let profs: {[key: string]: Profile};
export let currentPubkey: string;
export let isLoggedin: boolean;
export let loginPubkey: string;
export let relaysToUse: {[key: string]: GetRelays};
export let muteList: string[];

let editProfileName: string;
let editProfileDisplayName: string | undefined;
let editProfileAbout: string;
let editProfilePicture: string;
let editProfileWebsite: string | undefined;

const setProfileMetadata = (currentProfile: Profile) => {
	editProfileName = currentProfile.name;
	editProfileDisplayName = currentProfile.display_name;
	editProfileAbout = currentProfile.about;
	editProfilePicture = currentProfile.picture;
	editProfileWebsite = currentProfile.website;
	return '';
};

const callSendEditProfile = () => {
	const prof: Profile = {
		name: editProfileName,
		display_name: editProfileDisplayName !== '' ? editProfileDisplayName : undefined,
		about: editProfileAbout,
		picture: editProfilePicture,
		website: editProfileWebsite !== '' ? editProfileWebsite : undefined,
		created_at: 0,
	};
	sendEditProfile(pool, relaysToUse, loginPubkey, prof);
};

const callSendMuteUser = (toSet: boolean) => {
	sendMuteUser(pool, relaysToUse, loginPubkey, currentPubkey, toSet);
}

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
{#if isLoggedin && loginPubkey === currentPubkey}
<details>
	<summary>Edit Profile</summary>
	{setProfileMetadata(profs[currentPubkey])}
	<form>
		<dl>
			<dt><label for="edit-channel-name">name</label></dt>
			<dd><input id="edit-channel-name" type="text" placeholder="name" bind:value={editProfileName} /></dd>
			<dt><label for="edit-channel-display_name">display_name</label></dt>
			<dd><input id="edit-channel-name" type="text" placeholder="display_name" bind:value={editProfileDisplayName} /></dd>
			<dt><label for="edit-channel-about">about</label></dt>
			<dd><textarea id="edit-channel-about" placeholder="about" bind:value={editProfileAbout}></textarea></dd>
			<dt><label for="edit-channel-picture">picture</label></dt>
			<dd><input id="edit-channel-picture" type="url" placeholder="https://..." bind:value={editProfilePicture} /></dd>
			<dt><label for="edit-channel-website">website</label></dt>
			<dd><input id="edit-channel-website" type="url" placeholder="https://..." bind:value={editProfileWebsite} /></dd>
		</dl>
		<button on:click={callSendEditProfile} disabled={!editProfileName}>Edit</button>
	</form>
</details>
{/if}

{#if profs[currentPubkey] && isLoggedin && loginPubkey}
	{#if muteList.includes(currentPubkey)}
	<button class="profile-metadata on" on:click={() => callSendMuteUser(false)}><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button>
	{:else}
	<button class="profile-metadata off" on:click={() => callSendMuteUser(true)}><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button>
	{/if}
{/if}

<style>
#profile-about {
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
button.profile-metadata, details {
	vertical-align: middle;
}
button.profile-metadata {
	background-color: transparent;
	border: none;
	outline: none;
	padding: 0;
	width: 24px;
	height: 24px;
}
button.profile-metadata > svg {
	width: 24px;
	height: 24px;
}
:global(#container.dark button.profile-metadata) {
	fill: white;
}
:global(#container.light button.profile-metadata) {
	fill: black;
}
:global(#container button.profile-metadata.on) {
	fill: pink;
}
</style>

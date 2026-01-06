<script lang="ts">
	import { getExpandTagsList, sendMuteUser, type Profile, sendEditProfile } from '$lib/util';
	import type { RelayRecord } from 'nostr-tools/relay';
	import * as nip19 from 'nostr-tools/nip19';
	import type { RxNostr } from 'rx-nostr';
	import { resolve } from '$app/paths';

	interface Props {
		rxNostr: RxNostr;
		profs: { [key: string]: Profile };
		currentPubkey: string;
		isLoggedin: boolean;
		loginPubkey: string;
		relaysToUse: RelayRecord;
		muteList: string[];
	}

	let { rxNostr, profs, currentPubkey, isLoggedin, loginPubkey, relaysToUse, muteList }: Props =
		$props();

	let editProfileName: string = $state('');
	let editProfileDisplayName: string | undefined = $state();
	let editProfileAbout: string = $state('');
	let editProfilePicture: string = $state('');
	let editProfileWebsite: string | undefined = $state();
	let isCallingSendEditProfile: boolean = $state(false);
	let isCallingSendMuteUser: boolean = $state(false);

	const setProfileMetadata = (currentProfile: Profile) => {
		editProfileName = currentProfile.name;
		editProfileDisplayName = currentProfile.display_name;
		editProfileAbout = currentProfile.about;
		editProfilePicture = currentProfile.picture;
		editProfileWebsite = currentProfile.website;
		return '';
	};

	const callSendEditProfile = async () => {
		const prof: Profile = {
			name: editProfileName,
			display_name: editProfileDisplayName !== '' ? editProfileDisplayName : undefined,
			about: editProfileAbout,
			picture: editProfilePicture,
			website: editProfileWebsite !== '' ? editProfileWebsite : undefined,
			created_at: 0,
			tags: []
		};
		isCallingSendEditProfile = true;
		try {
			await sendEditProfile(rxNostr, relaysToUse, loginPubkey, prof);
		} catch (error) {
			console.error(error);
		}
		isCallingSendEditProfile = false;
	};

	const callSendMuteUser = async (toSet: boolean) => {
		isCallingSendMuteUser = true;
		try {
			await sendMuteUser(rxNostr, relaysToUse, loginPubkey, currentPubkey, toSet);
		} catch (error) {
			console.error(error);
		}
		isCallingSendMuteUser = false;
	};
</script>

<h2>
	<img
		src={profs[currentPubkey].picture || './default.png'}
		alt="@{profs[currentPubkey].name ?? ''}"
		width="32"
		height="32"
	/>
	{profs[currentPubkey].display_name ?? ''} @{profs[currentPubkey].name ?? ''}
</h2>
{#if profs[currentPubkey].about}
	{@const r = getExpandTagsList(profs[currentPubkey].about, profs[currentPubkey].tags)}
	{@const matchesIterator = r[0]}
	{@const plainTexts = r[1]}
	{@const emojiUrls = r[2]}
	<p id="profile-about">
		{plainTexts.shift()}
		{#each Array.from(matchesIterator) as match, i (i)}
			{#if /https?:\/\/\S+/.test(match[1])}
				{@const url = match[1]}
				<a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
			{:else if /nostr:npub\w{59}/.test(match[2])}
				{@const matchedText = match[2]}
				{@const npubText = matchedText.replace(/nostr:/, '')}
				{@const d = nip19.decode(npubText)}
				{#if d.type === 'npub'}
					<a href={resolve(`/${npubText}`)}
						>@{profs[d.data]?.name ?? npubText.slice(0, 10) + '...'}</a
					>
				{:else}
					{matchedText}
				{/if}
			{:else if /nostr:nprofile\w+/.test(match[3])}
				{@const matchedText = match[3]}
				{@const nprofileText = matchedText.replace(/nostr:/, '')}
				{@const d = nip19.decode(nprofileText)}
				{#if d.type === 'nprofile'}
					<a href={resolve(`/${nprofileText}`)}
						>@{profs[d.data.pubkey]?.name ?? nprofileText.slice(0, 10) + '...'}</a
					>
				{:else}
					{matchedText}
				{/if}
			{:else if /nostr:note\w{59}/.test(match[4])}
				{match[4]}
			{:else if /nostr:nevent\w+/.test(match[5])}
				{match[5]}
			{:else if /nostr:naddr\w+/.test(match[6])}
				{match[6]}
			{:else if /#\S+/.test(match[7])}
				{@const matchedText = match[7]}
				<a href={resolve(`/hashtag/${encodeURI(matchedText.replace('#', ''))}`)}>{matchedText}</a>
			{:else if match[8]}
				{@const matchedText = match[8]}
				<img src={emojiUrls[matchedText]} alt={matchedText} title={matchedText} class="emoji" />
			{/if}
			{plainTexts.shift()}
		{/each}
	</p>
{/if}
{#if profs[currentPubkey].website}
	{@const url = profs[currentPubkey].website}
	<p id="profile-website">
		<a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
	</p>{/if}
{#if isLoggedin && loginPubkey === currentPubkey}
	<details>
		<summary>Edit Profile</summary>
		{setProfileMetadata(profs[currentPubkey])}
		<dl>
			<dt><label for="edit-channel-name">name</label></dt>
			<dd>
				<input id="edit-channel-name" type="text" placeholder="name" bind:value={editProfileName} />
			</dd>
			<dt><label for="edit-channel-display_name">display_name</label></dt>
			<dd>
				<input
					id="edit-channel-name"
					type="text"
					placeholder="display_name"
					bind:value={editProfileDisplayName}
				/>
			</dd>
			<dt><label for="edit-channel-about">about</label></dt>
			<dd>
				<textarea id="edit-channel-about" placeholder="about" bind:value={editProfileAbout}
				></textarea>
			</dd>
			<dt><label for="edit-channel-picture">picture</label></dt>
			<dd>
				<input
					id="edit-channel-picture"
					type="url"
					placeholder="https://..."
					bind:value={editProfilePicture}
				/>
			</dd>
			<dt><label for="edit-channel-website">website</label></dt>
			<dd>
				<input
					id="edit-channel-website"
					type="url"
					placeholder="https://..."
					bind:value={editProfileWebsite}
				/>
			</dd>
		</dl>
		<button onclick={callSendEditProfile} disabled={!editProfileName || isCallingSendEditProfile}
			>Edit</button
		>
	</details>
{/if}

{#if profs[currentPubkey] && isLoggedin && loginPubkey}
	{#if muteList.includes(currentPubkey)}
		<button
			class="profile-metadata on"
			onclick={() => callSendMuteUser(false)}
			disabled={isCallingSendMuteUser}
			title="Unmute"
			aria-label="Unmute"><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button
		>
	{:else}
		<button
			class="profile-metadata off"
			onclick={() => callSendMuteUser(true)}
			disabled={isCallingSendMuteUser}
			title="Mute"
			aria-label="Mute"><svg><use xlink:href="/eye-no.svg#mute"></use></svg></button
		>
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
	button.profile-metadata,
	details {
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
	.emoji {
		height: 32px;
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

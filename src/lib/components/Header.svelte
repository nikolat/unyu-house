<script lang='ts'>
import { nip19 } from "nostr-tools";
import type { Profile } from "$lib/util";
export let title: string;
export let profs: {[key: string]: Profile};
export let loginPubkey: string;
const expandSidebar = () => {
	const container = document.getElementById('container');
	if (container) {
		if (container.classList.contains('expand-sidebar')) {
			container.classList.remove('expand-sidebar');
		}
		else {
			container.classList.add('expand-sidebar');
		}
	}
}
</script>

<header>
	<h1><a href="/">{title}</a></h1>
	<button id="toggle" on:click={expandSidebar}><svg><use xlink:href="/menu.svg#hamburger"></use></svg></button>
	{#if loginPubkey && profs[loginPubkey]}
		{@const npub = nip19.npubEncode(loginPubkey)}
		<a href="/{npub}"><img id="account-avatar" src="{profs[loginPubkey].picture || '/default.png'}" alt="avatar of {npub}" title="logged in as @{profs[loginPubkey].name ?? ''}" width="32" height="32"></a>
	{/if}
</header>

<style>
header {
	position: fixed;
	width: 100%;
	height: 3em;
	background-color: rgba(64, 32, 128, 0.3);
	display: inline-flex;
	flex-direction: row-reverse;
	justify-content: space-between;
}
h1 {
	font-size: medium;
	display: inline-block;
	width: calc(100% - 3em);
	margin-right: 48px;
	text-align: center;
	margin-top: 0.8em;
}
#toggle {
	background-color: transparent;
	border: none;
	cursor: pointer;
	outline: none;
	padding: 0;
	width: 48px;
	height: 48px;
}
#account-avatar {
	position: absolute;
	top: 10px;
	right: 10px;
}
svg {
	width: 20px;
	height: 20px;
}
:global(#container.expand-sidebar main) {
	width: 0%;
}
:global(#container.expand-sidebar #sidebar) {
	width: 100%;
}
:global(#container.expand-sidebar #input) {
	visibility: hidden;
}
:global(#container:not(.expand-sidebar) main) {
	width: 100%;
}
:global(#container:not(.expand-sidebar) #sidebar) {
	width: 0%;
}
:global(#container:not(.expand-sidebar) #input) {
	visibility: visible;
}
:global(#container.dark #toggle) {
	fill: white;
}
:global(#container.light #toggle) {
	fill: black;
}
</style>

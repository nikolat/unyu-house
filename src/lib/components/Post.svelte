<script lang='ts'>
import { sendMessage, type Channel } from '$lib/util';
import type { NostrEvent } from 'nostr-tools/core';
import type { RelayRecord } from 'nostr-tools/relay';
import type { SimplePool } from 'nostr-tools/pool';

export let pool: SimplePool;
export let currentChannelId: string | null;
export let relaysToUse: RelayRecord;
export let channels: Channel[] = [];
export let hidePostBar: Function;
export let resetScroll: Function;
export let emojiMap: Map<string, string>;
let inputText: string;

const callSendMessage = (noteToReplay: NostrEvent) => {
	const content = inputText;
	if (!content)
		return;
	inputText = '';
	hidePostBar();
	resetScroll();
	const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
	sendMessage(pool, relaysToWrite, content, noteToReplay, emojiMap);
};

const submitFromKeyboard = (event: KeyboardEvent, noteToReplay: NostrEvent) => {
	if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
		callSendMessage(noteToReplay);
	}
}

const showPostBar = () => {
	const input = document.getElementById('input');
	input?.classList.add('show');
};

</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if true}
	{@const channel = channels.find(channel => channel.event.id === currentChannelId)}
	{#if channel !== undefined}
	<div id="input" class="show" on:click|stopPropagation={()=>{}}>
		<textarea id="input-text" bind:value={inputText} on:keydown={(e) => {submitFromKeyboard(e, channel.event)}}></textarea>
		<button on:click={() => {callSendMessage(channel.event)}} disabled={!inputText}>Post</button>
	</div>
	<button id="show-post-bar" on:click|stopPropagation={showPostBar}><svg><use xlink:href="/pencil-create.svg#pencil"></use></svg></button>
	{/if}
{/if}

<style>
#input {
	position: fixed;
	width: 100%;
	height: 8em;
	bottom: -8em;
	left: -0.5em;
	background-color: rgba(64, 32, 128, 0.7);
	transition: bottom 0.1s;
}
#input.show {
	bottom: 0;
}
#input > textarea {
	margin: 1em 1em 0.5em 1em;
	width: calc(100% - 2em);
	height: 3.5em;
}
#input > button {
	margin-left: 1em;
}
#show-post-bar {
	position: fixed;
	right: 1em;
	bottom: 1em;
	background-color: transparent;
}
#show-post-bar svg {
	width: 24px;
	height: 24px;
}
#input.show+#show-post-bar {
	display: none;
}
</style>

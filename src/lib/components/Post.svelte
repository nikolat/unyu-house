<script lang='ts'>
import { sendMessage, type Channel } from '$lib/util';
import type { NostrEvent } from 'nostr-tools/pure';
import type { RelayRecord } from 'nostr-tools/relay';
import type { SimplePool } from 'nostr-tools/pool';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
// @ts-ignore
import type { BaseEmoji } from '@types/emoji-mart';

export let pool: SimplePool;
export let currentChannelId: string | null;
export let relaysToUse: RelayRecord;
export let channels: Channel[] = [];
export let hidePostBar: Function;
export let resetScroll: Function;
export let emojiMap: Map<string, string>;
let inputText: string;
let emojiPicker: HTMLElement;
let emojiVisible: boolean = false;

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

const callGetEmoji = () => {
	emojiVisible = !emojiVisible;
	if (emojiPicker.children.length > 0) {
		return;
	}
	const picker = new Picker({
		data,
		custom: [
			{
				id: 'custom-emoji',
				name: 'Custom Emojis',
				emojis: Array.from(emojiMap.entries()).map(([shortcode, url]) => {return {
					id: shortcode,
					name: shortcode,
					keywords: [shortcode],
					skins: [{shortcodes: `:${shortcode}:`, src: url}],
				};})
			}
		],
		onEmojiSelect
	});
	function onEmojiSelect(emoji: BaseEmoji) {
		emojiVisible = false;
		const emojiStr = emoji.native ?? (emoji as any).shortcodes as string;
		insertText(emojiStr);
	}
	emojiPicker.appendChild(picker as any);
};

const insertText = (word: string) => {
	const textarea = document.getElementById('input-text') as HTMLTextAreaElement;
	let sentence = textarea.value;
	const len = sentence.length;
	const pos = textarea.selectionStart;
	const before = sentence.slice(0, pos);
	const after = sentence.slice(pos, pos + len);
	sentence = before + word + after;
	textarea.value = sentence;
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
		<button class="emoji" on:click={() => callGetEmoji()} title="Select Emoji"><svg><use xlink:href="/smiled.svg#emoji"></use></svg></button>
		<div id="emoji-picker-post" bind:this={emojiPicker} class={emojiVisible ? '' : 'hidden'}></div>
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
#input > * {
	vertical-align: top;
}
div.hidden {
	display: none;
}
button.emoji {
	background-color: transparent;
	border: none;
	outline: none;
	padding: 0;
	width: 24px;
	height: 24px;
}
#emoji-picker-post {
	position: relative;
	bottom: 500px;
	left: 15px;
}
</style>

<script lang="ts">
	import { sendMessage, type Channel } from '$lib/util';
	import { uploaderURLs } from '$lib/config';
	import { readServerConfig, uploadFile, type OptionalFormDataFields } from '$lib/nip96';
	import type { EventTemplate, NostrEvent } from 'nostr-tools/pure';
	import type { RelayRecord } from 'nostr-tools/relay';
	import { getToken } from 'nostr-tools/nip98';
	import type { RxNostr } from 'rx-nostr';
	import data from '@emoji-mart/data';
	import { Picker } from 'emoji-mart';
	// @ts-expect-error なんもわからんかも
	import type { BaseEmoji } from '@types/emoji-mart';

	interface Props {
		rxNostr: RxNostr;
		seenOn: Map<string, Set<string>>;
		currentChannelId: string | null;
		relaysToUse: RelayRecord;
		channels?: Channel[];
		hidePostBar: () => void;
		resetScroll: () => void;
		emojiMap: Map<string, string>;
	}

	let {
		rxNostr,
		seenOn,
		currentChannelId,
		relaysToUse,
		channels = [],
		hidePostBar,
		resetScroll,
		emojiMap
	}: Props = $props();
	let inputText: string = $state('');
	let emojiVisible: boolean = $state(false);
	let contentWarningReason: string | undefined = $state();
	let targetUrlToUpload: string = $state('');
	let filesToUpload: FileList | undefined = $state();

	const callSendMessage = (noteToReplay: NostrEvent) => {
		const content = inputText;
		if (!content) return;
		inputText = '';
		hidePostBar();
		resetScroll();
		const relaysToWrite = Object.entries(relaysToUse)
			.filter((v) => v[1].write)
			.map((v) => v[0]);
		sendMessage(
			rxNostr,
			seenOn,
			relaysToWrite,
			content,
			noteToReplay,
			emojiMap,
			contentWarningReason
		);
	};

	interface MyBaseEmoji extends BaseEmoji {
		shortcodes: string;
	}

	const callGetEmoji = () => {
		emojiVisible = !emojiVisible;
		const emojiPicker = document.getElementById('emoji-picker-post');
		if (emojiPicker?.children.length ?? 0 > 0) {
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
							skins: [{ shortcodes: `:${shortcode}:`, src: url }]
						};
					})
				}
			],
			onEmojiSelect
		});
		function onEmojiSelect(emoji: MyBaseEmoji) {
			emojiVisible = false;
			const emojiStr = emoji.native ?? emoji.shortcodes;
			insertText(emojiStr);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		emojiPicker?.appendChild(picker as any);
	};

	const insertText = (word: string): void => {
		const textarea = document.getElementById('input-text') as HTMLTextAreaElement;
		let sentence = textarea.value;
		const len = sentence.length;
		const pos = textarea.selectionStart;
		const before = sentence.slice(0, pos);
		const after = sentence.slice(pos, pos + len);
		sentence = before + word + after;
		textarea.value = sentence;
		textarea.focus();
		textarea.selectionStart = pos + word.length;
		textarea.selectionEnd = pos + word.length;
		inputText = sentence;
	};

	const setContentWarning = (reason: string | undefined) => {
		contentWarningReason = reason;
	};

	const uploadFileExec = async () => {
		if (filesToUpload === undefined || filesToUpload.length === 0) {
			return;
		}
		const nostr = window.nostr;
		if (nostr === undefined) {
			return;
		}
		const f = (e: EventTemplate) => nostr.signEvent(e);
		const c = await readServerConfig(targetUrlToUpload);
		const s = await getToken(c.api_url, 'POST', f, true);
		let file: File | undefined;
		for (const f of filesToUpload) {
			file = f;
		}
		if (file === undefined) {
			return;
		}
		const option: OptionalFormDataFields = {
			size: String(file.size),
			content_type: file.type
		};
		const fileUploadResponse = await uploadFile(file, c.api_url, s, option);
		const uploadedFileUrl = fileUploadResponse.nip94_event?.tags
			.find((tag) => tag[0] === 'url')
			?.at(1);
		if (uploadedFileUrl === undefined) {
			return;
		}
		insertText(uploadedFileUrl);
	};

	const submitFromKeyboard = (event: KeyboardEvent, noteToReplay: NostrEvent) => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			callSendMessage(noteToReplay);
		}
	};

	const showPostBar = () => {
		const input = document.getElementById('input');
		input?.classList.add('show');
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if true}
	{@const channel = channels.find((channel) => channel.event.id === currentChannelId)}
	{#if channel !== undefined}
		<div id="input" class="show" onclick={(e) => e.stopPropagation()}>
			<textarea
				id="input-text"
				bind:value={inputText}
				onkeydown={(e) => {
					submitFromKeyboard(e, channel.event);
				}}
			></textarea>
			<button
				onclick={() => {
					callSendMessage(channel.event);
				}}
				disabled={!inputText}>Post</button
			>
			<button
				class="emoji"
				onclick={() => callGetEmoji()}
				title="Select Emoji"
				aria-label="Select Emoji"><svg><use xlink:href="/smiled.svg#emoji"></use></svg></button
			>
			<div id="emoji-picker-post" class={emojiVisible ? '' : 'hidden'}></div>
			{#if contentWarningReason === undefined}
				<button
					class="content-warning off"
					onclick={() => setContentWarning('')}
					title="Add Content Warning"
					aria-label="Add Content Warning"
					><svg><use xlink:href="/alert-triangle.svg#content-warning"></use></svg></button
				>
			{:else}
				<button
					class="content-warning on"
					onclick={() => setContentWarning(undefined)}
					title="Remove Content Warning"
					aria-label="Remove Content Warning"
					><svg><use xlink:href="/alert-triangle.svg#content-warning"></use></svg></button
				>
			{/if}
			<button
				class="attachment"
				onclick={() => {
					document.getElementById('select-upload-file')?.click();
				}}
				title="Select Attachment"
				aria-label="Select Attachment"
				><svg><use xlink:href="/image.svg#attachment"></use></svg></button
			>
			<input
				id="select-upload-file"
				type="file"
				accept="image/*,video/*,audio/*"
				bind:files={filesToUpload}
				onchange={uploadFileExec}
			/>
			<select id="uploader-url-to-upload" bind:value={targetUrlToUpload}>
				{#each uploaderURLs as url (url)}
					<option value={url}>{url}</option>
				{/each}
			</select>
		</div>
		<button
			id="show-post-bar"
			onclick={(e) => {
				e.stopPropagation();
				showPostBar();
			}}
			aria-label="Show Post Bar"
			><svg><use xlink:href="/pencil-create.svg#pencil"></use></svg></button
		>
	{/if}
{/if}

<style>
	#input {
		position: fixed;
		width: 100%;
		height: 12em;
		bottom: -12em;
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
	svg {
		width: 24px;
		height: 24px;
	}
	#input.show + #show-post-bar {
		display: none;
	}
	#input > * {
		vertical-align: middle;
	}
	div.hidden {
		display: none;
	}
	button.emoji,
	button.content-warning,
	button.attachment {
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
	#select-upload-file {
		display: none;
	}
	#uploader-url-to-upload {
		display: inline;
		margin-left: 1em;
	}
	:global(#container.dark button.content-warning, #container.dark button.attachment) {
		fill: white;
	}
	:global(#container.light button.content-warning, #container.light button.attachment) {
		fill: black;
	}
	:global(#container button.content-warning.on) {
		fill: yellow;
	}
</style>

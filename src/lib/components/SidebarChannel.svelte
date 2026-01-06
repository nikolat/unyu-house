<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		picture: string;
		url: string;
		channelName: string;
		post_count: number;
		fav_count: number;
		classname: string;
	}

	let { picture, url, channelName, post_count, fav_count, classname }: Props = $props();
</script>

<li class="outline {classname}">
	<img src={picture || '/default.png'} alt="" class="channel_icon {classname}" />
	<a href={resolve(`/channels/${url}`)}>{channelName}</a>
	{#if post_count > 0}📜{post_count}{/if}
	{#if fav_count > 0}❤{fav_count}{/if}
</li>

<style>
	.outline {
		display: flex;
		align-items: center;
		padding: 0px 20px;
	}
	.channel_icon {
		margin-right: 14px;
		border-radius: 10%;
		overflow: hidden;
		object-fit: cover;
		aspect-ratio: 1;
	}
	li.pinned {
		margin-bottom: 12px;
	}
	img.pinned {
		width: 32px;
		height: 32px;
	}
	img.all {
		width: 16px;
		height: 16px;
	}
</style>

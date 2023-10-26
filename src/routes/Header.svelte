<script lang='ts'>
export let title: string;
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
svg {
	width: 20px;
	height: 20px;
}
:global(#container.expand-sidebar main) {
	width: 0%;
}
:global(#container.expand-sidebar #sidebar) {
	width: calc(100vw - (100vw - 100%));
}
:global(#container.expand-sidebar #input) {
	visibility: hidden;
}
:global(#container:not(.expand-sidebar) main) {
	width: calc(100vw - (100vw - 100%));
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

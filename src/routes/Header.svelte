<script lang='ts'>
export let title: string;
const expandSidebar = () => {
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	if (sidebar && main) {
		if (main.style.width !== '0%') {
			sidebar.style.width = 'calc(100vw - (100vw - 100%))';
			main.style.width = '0%';
			if (input) {
				input.style.visibility = 'hidden';
			}
		}
		else {
			sidebar.style.width = '0%';
			main.style.width = 'calc(100vw - (100vw - 100%))';
			if (input) {
				input.style.visibility = 'visible';
			}
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
	margin-top: 1em;
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
:global(#container.dark #toggle) {
	fill: white;
}
:global(#container.light #toggle) {
	fill: black;
}
</style>

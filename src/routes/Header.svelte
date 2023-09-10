<script lang='ts'>
const expandSidebar = () => {
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	if (sidebar && main) {
		if (main.style.width !== '0%') {
			sidebar.style.width = 'calc(100vw - calc(100vw - 100%))';
			main.style.width = '0%';
			if (input) {
				input.style.visibility = 'hidden';
			}
		}
		else {
			sidebar.style.width = '0%';
			main.style.width = 'calc(100vw - calc(100vw - 100%))';
			if (input) {
				input.style.visibility = 'visible';
			}
		}
	}
}
</script>

<header>
	<h1><a href="/">うにゅうハウス</a></h1>
	<button id="toggle" on:click={expandSidebar}><img src="/menu.svg" alt="menu" /></button>
</header>

<style>
header {
	position: fixed;
	width: 100%;
	height: 3em;
	background-color: #ccc;
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
</style>

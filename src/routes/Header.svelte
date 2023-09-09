<script lang='ts'>
const expandSidebar = () => {
	const sidebar = document.getElementById('sidebar');
	const main = document.querySelector('main');
	const input = document.getElementById('input');
	if (sidebar && main) {
		if (main.style.width !== '0%') {
			sidebar.style.width = 'calc(100% - 2em)';
			main.style.width = '0%';
			if (input) {
				input.style.display = 'none';
			}
		}
		else {
			sidebar.style.width = '0%';
			main.style.width = 'calc(100% - 2em)';
			if (input) {
				input.style.display = 'inline-block';
			}
		}
	}
}
</script>

<header>
	<h1><a href="/">うにゅうハウス</a></h1>
	<button id="toggle" on:click={expandSidebar}>三</button>
</header>

<style>
header {
	position: fixed;
	width: 100%;
	height: 2em;
	background-color: #ccc;
	display: inline-flex;
	flex-direction: row-reverse;
	justify-content: space-between;
}
h1 {
	font-size: medium;
	display: inline-block;
	width: calc(100% - 2em);
}
#toggle {
	width: 2em;
}
</style>

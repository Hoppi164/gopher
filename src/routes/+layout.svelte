<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import "@picocss/pico"
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}


<style>
	:global(.text-center) {
		text-align: center;
	}
	:global(.flex-center) {
		display: flex;
		justify-content: center;
		align-items: center;
	}
	
	
</style>

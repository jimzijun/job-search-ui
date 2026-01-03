<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type Variant = 'icon' | 'chip';
	type CompanyStatus = 'blacklist' | 'whitelist';

	const dispatch = createEventDispatcher<{
		whitelist: void;
		blacklist: void;
	}>();

	export let variant: Variant = 'icon';
	export let status: CompanyStatus | undefined = undefined;
	export let disabled = false;
	export let visitHref: string | undefined = undefined;
	export let visitLabel = 'Visit site';
	export let visitIsExternal = true;

	const isIconVariant = variant === 'icon';
	const linkTarget = visitIsExternal ? '_blank' : undefined;
	const linkRel = visitIsExternal ? 'noreferrer' : undefined;

	const handleWhitelist = () => dispatch('whitelist');
	const handleBlacklist = () => dispatch('blacklist');
</script>

<div class={`status-group status-group--${variant}`} aria-label="Company actions">
	{#if visitHref}
		<a
			class={`action ${isIconVariant ? 'action--icon' : 'action--chip'} action--primary`}
			href={visitHref}
			target={linkTarget}
			rel={linkRel}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 2 3 5v6c0 4.6 3.2 8.8 9 11 5.8-2.2 9-6.4 9-11V5l-9-3Zm0 2.2 7 2.6v4.8c0 3.6-2.6 7-7 8.9-4.4-1.9-7-5.3-7-8.9V6.8l7-2.6Zm-2.1 8.5 1.6 1.6 3.6-3.6 1.4 1.4-5 5-3-3 1.4-1.4Z"
					fill="currentColor"
				/>
			</svg>
			<span class={isIconVariant ? 'sr-only' : ''}>{visitLabel}</span>
		</a>
	{/if}

	<button
		class={`action ${isIconVariant ? 'action--icon' : 'action--chip'}`}
		class:action--active={status === 'whitelist'}
		on:click={handleWhitelist}
		disabled={disabled}
		title="Whitelist company"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 2 3 5v6c0 4 2.7 7.6 8 9 5.3-1.4 8-5 8-9V5l-8-3Zm0 2 6 2.25v4.42c0 3.24-2.22 6.18-6 7.42-3.78-1.24-6-4.18-6-7.42V6.25L12 4Zm3.53 5.47L11 14l-2.53-2.53 1.06-1.06L11 11.88l3.47-3.47 1.06 1.06Z"
				fill="currentColor"
			/>
		</svg>
		<span class={isIconVariant ? 'sr-only' : ''}>{status === 'whitelist' ? 'Whitelisted' : 'Whitelist'}</span>
	</button>

	<button
		class={`action ${isIconVariant ? 'action--icon' : 'action--chip'} action--danger`}
		class:action--active={status === 'blacklist'}
		on:click={handleBlacklist}
		disabled={disabled}
		title="Blacklist company"
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.95 4.95-10 10a8 8 0 0 1 10-10Zm-9.9 9.9 10-10a8 8 0 0 1-10 10Z"
				fill="currentColor"
			/>
		</svg>
		<span class={isIconVariant ? 'sr-only' : ''}>{status === 'blacklist' ? 'Blacklisted' : 'Blacklist'}</span>
	</button>
</div>
<style>
	@import '../styles/actionGroup.css';
</style>

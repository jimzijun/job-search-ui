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
				<path d="M12 3 4 6v5c0 4 2.7 7.6 8 9 5.3-1.4 8-5 8-9V6l-8-3Z" fill="currentColor" />
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
				d="M12 3 4 6v5c0 4 2.7 7.6 8 9 5.3-1.4 8-5 8-9V6l-8-3Zm-1 11-2.5-2.5 1.4-1.4L11 11.2l3.6-3.6 1.4 1.4L11 14Z"
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
				d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-6 8a6 6 0 0 1 1.1-3.4L15.4 17A6 6 0 0 1 6 12Zm6 6a6 6 0 0 1-3.4-1.1L16 9.4A6 6 0 0 1 12 18Z"
				fill="currentColor"
			/>
		</svg>
		<span class={isIconVariant ? 'sr-only' : ''}>{status === 'blacklist' ? 'Blacklisted' : 'Blacklist'}</span>
	</button>
</div>
<style>
	@import '../styles/actionGroup.css';
</style>

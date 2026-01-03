<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type Variant = 'icon' | 'chip';

	const dispatch = createEventDispatcher<{
		pin: void;
		submit: void;
		hide: void;
	}>();

	export let variant: Variant = 'icon';
	export let directHref: string | undefined = undefined;
	export let directLabel = 'Visit';
	export let directIsExternal = false;
	export let pinned = false;
	export let submitted = false;
	export let hidden = false;
	export let disabled = false;
	export let showPin = true;
	export let showSubmit = true;
	export let showHide = true;

	const isIconVariant = variant === 'icon';
	const linkTarget = directIsExternal ? '_blank' : undefined;
	const linkRel = directIsExternal ? 'noreferrer' : undefined;

	const handlePin = () => dispatch('pin');
	const handleSubmit = () => dispatch('submit');
	const handleHide = () => dispatch('hide');
	const visitLabel = directLabel || 'Visit';
</script>

<div class={`action-group action-group--${variant}`} aria-label="Job actions">
	{#if directHref}
		<a
			class={`action ${isIconVariant ? 'action--icon' : 'action--chip'} action--primary`}
			href={directHref}
			target={linkTarget}
			rel={linkRel}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M13 3a1 1 0 1 0 0 2h3.586l-6.293 6.293a1 1 0 0 0 1.414 1.414L18 6.414V10a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-6Z"
					fill="currentColor"
				/>
				<path
					d="M5 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 1 0 0-2H5Z"
					fill="currentColor"
				/>
			</svg>
			<span class={isIconVariant ? 'sr-only' : ''}>{visitLabel}</span>
		</a>
	{/if}

	{#if showPin}
		<button
			class={`action ${isIconVariant ? 'action--icon' : 'action--chip'}`}
			class:action--active={pinned}
			on:click={handlePin}
			disabled={disabled}
			aria-pressed={pinned ? 'true' : 'false'}
			title={pinned ? 'Unpin' : 'Pin'}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-3-7 3V4Z" fill="currentColor" />
			</svg>
			<span class={isIconVariant ? 'sr-only' : ''}>{pinned ? 'Pinned' : 'Pin job'}</span>
		</button>
	{/if}

	{#if showSubmit}
		<button
			class={`action ${isIconVariant ? 'action--icon' : 'action--chip'}`}
			class:action--active={submitted}
			on:click={handleSubmit}
			disabled={disabled}
			aria-pressed={submitted ? 'true' : 'false'}
			title={submitted ? 'Undo submitted' : 'Mark submitted'}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
					fill="currentColor"
				/>
			</svg>
			<span class={isIconVariant ? 'sr-only' : ''}>{submitted ? 'Submitted' : 'Mark submitted'}</span>
		</button>
	{/if}

	{#if showHide}
		<button
			class={`action ${isIconVariant ? 'action--icon' : 'action--chip'} action--ghost`}
			class:action--active={hidden}
			on:click={handleHide}
			disabled={disabled}
			aria-pressed={hidden ? 'true' : 'false'}
			title={hidden ? 'Unhide' : 'Hide'}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 5c-4.8 0-8.8 3-10 7 1.2 4 5.2 7 10 7s8.8-3 10-7c-1.2-4-5.2-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
					fill="currentColor"
				/>
			</svg>
			<span class={isIconVariant ? 'sr-only' : ''}>{hidden ? 'Hidden' : 'Hide job'}</span>
		</button>
	{/if}
</div>
<style>
	@import '../styles/actionGroup.css';
</style>

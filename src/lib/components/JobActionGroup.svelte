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
	.action-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border-radius: 10px;
		border: 1px solid rgba(226, 232, 240, 0.18);
		background: rgba(15, 23, 42, 0.7);
		color: #e2e8f0;
		font-weight: 700;
		padding: 8px 12px;
		cursor: pointer;
		transition: border-color 120ms ease, transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
		text-decoration: none;
	}

	.action svg {
		width: 18px;
		height: 18px;
	}

	.action:hover:not(:disabled) {
		border-color: rgba(148, 163, 184, 0.6);
		transform: translateY(-1px);
	}

	.action:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.action--icon {
		width: 36px;
		height: 36px;
		padding: 6px;
		border-radius: 12px;
		background: rgba(37, 99, 235, 0.14);
		color: #bfdbfe;
		border-color: rgba(37, 99, 235, 0.32);
	}

	.action--chip {
		padding: 8px 12px;
	}

	.action--primary {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(14, 165, 233, 0.3));
		border-color: rgba(96, 165, 250, 0.65);
		color: #e2e8f0;
		box-shadow: 0 8px 18px rgba(14, 165, 233, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.action--primary:hover:not(:disabled) {
		border-color: rgba(125, 211, 252, 0.9);
	}

	.action--ghost {
		background: transparent;
		border-color: rgba(226, 232, 240, 0.18);
		color: #e2e8f0;
	}

	.action--active {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(16, 185, 129, 0.25));
		border-color: rgba(59, 130, 246, 0.65);
		color: #0b1220;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>

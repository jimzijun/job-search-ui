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
	.status-group {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
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

	.action--danger {
		border-color: rgba(248, 113, 113, 0.6);
		color: #fecdd3;
		background: rgba(248, 113, 113, 0.12);
	}

	.action--danger.action--active {
		background: #ef4444;
		color: #0b1220;
		border-color: #fca5a5;
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

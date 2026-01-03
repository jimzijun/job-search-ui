<script lang="ts">
	export type JobCardStatus = 'blacklist' | 'whitelist';

	export type JobCardJob = {
		id: string;
		title: string;
		company: string;
		companySlug?: string;
		url?: string;
		location?: string;
		experience_range?: string;
		job_type?: string;
		salary?: string;
		has_python_keyword?: boolean;
		date_posted?: Date;
	};

	type SavedMeta = {
		pinnedAt?: string;
		submittedAt?: string;
	};

	export let job: JobCardJob;
	export let jobHref: string;
	export let companyHref: string;
	export let directHref: string;
	export let directIsExternal = false;
	export let companyLogo: string | undefined = undefined;
	export let companyStatus: JobCardStatus | undefined = undefined;
	export let isPinned = false;
	export let isSubmitted = false;
	export let isHidden = false;
	export let savedMeta: SavedMeta = {};
	export let formatDate: (date?: Date | string) => string;
	export let onTogglePinned: (() => void) | undefined;
	export let onToggleSubmitted: (() => void) | undefined;
	export let onToggleHidden: (() => void) | undefined;
	export let onWhitelist: (() => void) | undefined;
	export let onBlacklist: (() => void) | undefined;

	const directLabel = directIsExternal ? 'Job link' : 'View details';
	const showActionRail =
		Boolean(onTogglePinned) ||
		Boolean(onToggleSubmitted) ||
		Boolean(onToggleHidden) ||
		Boolean(onWhitelist) ||
		Boolean(onBlacklist);
</script>

<div class="card" data-hidden={isHidden}>
	<div class="card__grid">
		<div class="card__content">
			<div class="card__top">
				<a class="title-link" href={jobHref}>{job.title}</a>
			</div>
			<div class="card__meta">
				<a class="company-chip" href={companyHref}>
					{#if companyLogo}
						<img class="company-chip__logo" src={companyLogo} alt={`${job.company} logo`} loading="lazy" />
					{:else}
						<div class="company-chip__fallback">{job.company.slice(0, 1)}</div>
					{/if}
					<span class="company-chip__name">{job.company}</span>
				</a>
				{#if job.location}
					<span class="pill neutral">{job.location}</span>
				{/if}
			</div>
			{#if job.job_type || job.experience_range || job.salary || job.has_python_keyword !== undefined}
				<div class="card__details">
					{#if job.job_type}
						<span class="pill neutral">{job.job_type}</span>
					{/if}
					{#if job.experience_range}
						<span class="pill neutral">Exp: {job.experience_range}</span>
					{/if}
					{#if job.salary}
						<span class="pill accent">Salary {job.salary}</span>
					{/if}
					{#if job.has_python_keyword === true}
						<span class="pill success">Python keyword</span>
					{:else if job.has_python_keyword === false}
						<span class="pill neutral subtle">No Python keyword</span>
					{/if}
				</div>
			{/if}
			<div class="card__labels">
				{#if isPinned}
					<span class="pill accent">Pinned</span>
				{/if}
				{#if isSubmitted}
					<span class="pill success">Submitted</span>
				{/if}
				{#if companyStatus === 'whitelist'}
					<span class="pill success subtle">Preferred company</span>
				{:else if companyStatus === 'blacklist'}
					<span class="pill danger subtle">Blacklisted</span>
				{/if}
				{#if isHidden}
					<span class="pill neutral subtle">Hidden</span>
				{/if}
			</div>
			{#if savedMeta.pinnedAt || savedMeta.submittedAt}
				<div class="saved-meta">
					{#if savedMeta.pinnedAt}
						<p class="meta">Pinned on {formatDate(savedMeta.pinnedAt)}</p>
					{/if}
					{#if savedMeta.submittedAt}
						<p class="meta">Submitted on {formatDate(savedMeta.submittedAt)}</p>
					{/if}
				</div>
			{/if}
		</div>
		<div class="card__side">
			<div class="card__top-actions">
				<a
					class="direct-link"
					href={directHref}
					target={directIsExternal ? '_blank' : undefined}
					rel={directIsExternal ? 'noreferrer' : undefined}
				>
					{directLabel}
				</a>
				<div class="date">{formatDate(job.date_posted)}</div>
			</div>
			{#if showActionRail}
				<div class="card__action-rail" aria-label="Job and company actions">
					{#if onTogglePinned}
						<button
							class="icon-button"
							class:selected={isPinned}
							on:click={onTogglePinned}
							title={isPinned ? 'Unpin' : 'Pin'}
							aria-label={isPinned ? 'Unpin job' : 'Pin job'}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-3-7 3V4Z" fill="currentColor" />
							</svg>
							<span class="sr-only">{isPinned ? 'Unpin' : 'Pin'}</span>
						</button>
					{/if}
					{#if onToggleSubmitted}
						<button
							class="icon-button"
							class:selected={isSubmitted}
							on:click={onToggleSubmitted}
							title={isSubmitted ? 'Undo submitted' : 'Mark submitted'}
							aria-label={isSubmitted ? 'Undo submitted' : 'Mark submitted'}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
									fill="currentColor"
								/>
							</svg>
							<span class="sr-only">{isSubmitted ? 'Undo submitted' : 'Mark submitted'}</span>
						</button>
					{/if}
					{#if onToggleHidden}
						<button
							class="icon-button ghost"
							on:click={onToggleHidden}
							title={isHidden ? 'Unhide' : 'Hide'}
							aria-label={isHidden ? 'Unhide job' : 'Hide job'}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 5c-4.8 0-8.8 3-10 7 1.2 4 5.2 7 10 7s8.8-3 10-7c-1.2-4-5.2-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
									fill="currentColor"
								/>
							</svg>
							<span class="sr-only">{isHidden ? 'Unhide' : 'Hide'}</span>
						</button>
					{/if}
					{#if onWhitelist}
						<button
							class="icon-button"
							class:selected={companyStatus === 'whitelist'}
							on:click={onWhitelist}
							title="Whitelist company"
							aria-label="Whitelist company"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 3 4 6v5c0 4 2.7 7.6 8 9 5.3-1.4 8-5 8-9V6l-8-3Zm-1 11-2.5-2.5 1.4-1.4L11 11.2l3.6-3.6 1.4 1.4L11 14Z"
									fill="currentColor"
								/>
							</svg>
							<span class="sr-only">Whitelist company</span>
						</button>
					{/if}
					{#if onBlacklist}
						<button
							class="icon-button danger"
							class:selected={companyStatus === 'blacklist'}
							on:click={onBlacklist}
							title="Blacklist company"
							aria-label="Blacklist company"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-6 8a6 6 0 0 1 1.1-3.4L15.4 17A6 6 0 0 1 6 12Zm6 6a6 6 0 0 1-3.4-1.1L16 9.4A6 6 0 0 1 12 18Z"
									fill="currentColor"
								/>
							</svg>
							<span class="sr-only">Blacklist company</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.card {
		border: 1px solid rgba(226, 232, 240, 0.08);
		background: rgba(255, 255, 255, 0.02);
		border-radius: 12px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card__grid {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(180px, 1fr);
		align-items: start;
		gap: 12px;
	}

	.card__content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card__side {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-end;
		min-width: 180px;
	}

	.card[data-hidden='true'] {
		opacity: 0.6;
		border-style: dashed;
	}

	.card__top {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}

	.card__top-actions {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
		gap: 8px;
		flex-wrap: wrap;
		text-align: right;
	}

	.title-link {
		font-weight: 700;
		font-size: 17px;
		color: #f8fafc;
		text-decoration: none;
	}

	.title-link:hover {
		text-decoration: underline;
	}

	.date {
		color: #cbd5e1;
		font-size: 13px;
	}

	.card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.card__labels {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.saved-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 6px;
	}

	.saved-meta .meta {
		margin: 0;
	}

	.card__details {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.card__action-rail {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
	}

	.direct-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(37, 99, 235, 0.16);
		color: #bfdbfe;
		border: 1px solid rgba(37, 99, 235, 0.35);
		border-radius: 10px;
		padding: 6px 10px;
		font-weight: 600;
		font-size: 13px;
		text-decoration: none;
		transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.direct-link:hover {
		transform: translateY(-1px);
		border-color: rgba(96, 165, 250, 0.8);
	}

	.company-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px 5px 6px;
		border-radius: 12px;
		border: 1px solid rgba(226, 232, 240, 0.12);
		background: rgba(15, 23, 42, 0.7);
		text-decoration: none;
		color: inherit;
	}

	.company-chip__logo,
	.company-chip__fallback {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		object-fit: cover;
		background: rgba(226, 232, 240, 0.06);
		display: grid;
		place-items: center;
		color: #cbd5e1;
		font-weight: 700;
		font-size: 14px;
	}

	.company-chip__name {
		font-weight: 700;
		font-size: 13px;
		color: #e2e8f0;
	}

	button {
		background: rgba(37, 99, 235, 0.16);
		color: #bfdbfe;
		border: 1px solid rgba(37, 99, 235, 0.35);
		border-radius: 10px;
		padding: 8px 12px;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	button:hover {
		transform: translateY(-1px);
		border-color: rgba(96, 165, 250, 0.8);
	}

	button.selected {
		background: #3b82f6;
		color: #0b1220;
		border-color: #60a5fa;
	}

	button.ghost {
		background: transparent;
		color: #e2e8f0;
		border-color: rgba(226, 232, 240, 0.18);
	}

	button.danger {
		border-color: rgba(248, 113, 113, 0.6);
		color: #fecdd3;
		background: rgba(248, 113, 113, 0.12);
	}

	button.danger.selected {
		background: #ef4444;
		color: #0b1220;
		border-color: #fca5a5;
	}

	.icon-button {
		width: 36px;
		height: 36px;
		padding: 6px;
		display: grid;
		place-items: center;
		border-radius: 12px;
	}

	.icon-button svg {
		width: 18px;
		height: 18px;
	}

	.pill {
		background: rgba(37, 99, 235, 0.18);
		color: #bfdbfe;
		border: 1px solid rgba(37, 99, 235, 0.35);
		border-radius: 999px;
		padding: 6px 10px;
		font-weight: 600;
		font-size: 12px;
	}

	.pill.neutral {
		background: rgba(15, 23, 42, 0.6);
		color: #e2e8f0;
		border-color: rgba(226, 232, 240, 0.1);
	}

	.pill.accent {
		background: rgba(59, 130, 246, 0.2);
		color: #dbeafe;
		border-color: rgba(59, 130, 246, 0.45);
	}

	.pill.success {
		background: rgba(16, 185, 129, 0.18);
		color: #bbf7d0;
		border-color: rgba(16, 185, 129, 0.4);
	}

	.pill.danger {
		background: rgba(248, 113, 113, 0.16);
		color: #fecdd3;
		border-color: rgba(248, 113, 113, 0.4);
	}

	.pill.subtle {
		opacity: 0.85;
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

	@media (max-width: 900px) {
		.card__grid {
			grid-template-columns: 1fr;
		}

		.card__side {
			align-items: flex-start;
		}

		.card__top-actions,
		.card__action-rail {
			justify-content: flex-start;
		}
	}

	@media (max-width: 640px) {
		.card__top {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>

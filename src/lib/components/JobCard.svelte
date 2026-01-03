<script lang="ts">
	import { CompanyStatusGroup, JobActionGroup, JobMetaPills } from '$lib';

	type JobCardStatus = 'blacklist' | 'whitelist';

	type JobCardJob = {
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

	type ActionVariant = 'icon' | 'chip';

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
	export let onTogglePinned: (() => void) | undefined = undefined;
	export let onToggleSubmitted: (() => void) | undefined = undefined;
	export let onToggleHidden: (() => void) | undefined = undefined;
	export let onWhitelist: (() => void) | undefined = undefined;
	export let onBlacklist: (() => void) | undefined = undefined;
	export let actionVariant: ActionVariant = 'icon';
	export let showCompanyActions = true;
	export let actionsDisabled = false;

	let directLabel = 'View details';
	let showJobActions = true;
	let showCompanyActionsComputed = true;

	$: directLabel = directIsExternal ? 'Visit role' : 'View details';
	$: showJobActions = Boolean(onTogglePinned || onToggleSubmitted || onToggleHidden || directHref);
	$: showCompanyActionsComputed = showCompanyActions && Boolean(onWhitelist || onBlacklist);
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
			</div>
			<JobMetaPills job={job} companyStatus={companyStatus} />
			<div class="card__labels">
				{#if isPinned}
					<span class="pill accent">Pinned</span>
				{/if}
				{#if isSubmitted}
					<span class="pill success">Submitted</span>
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
				<div class="date">{formatDate(job.date_posted)}</div>
			</div>
			{#if showJobActions || showCompanyActionsComputed}
				<div class="card__action-rail" aria-label="Job and company actions">
					{#if showJobActions}
						<JobActionGroup
							variant={actionVariant}
							directHref={directHref}
							directLabel={directLabel}
							directIsExternal={directIsExternal}
							pinned={isPinned}
							submitted={isSubmitted}
							hidden={isHidden}
							disabled={actionsDisabled}
							showPin={Boolean(onTogglePinned)}
							showSubmit={Boolean(onToggleSubmitted)}
							showHide={Boolean(onToggleHidden)}
							on:pin={() => onTogglePinned?.()}
							on:submit={() => onToggleSubmitted?.()}
							on:hide={() => onToggleHidden?.()}
						/>
					{/if}
					{#if showCompanyActionsComputed}
						<CompanyStatusGroup
							variant={actionVariant}
							status={companyStatus}
							on:whitelist={() => onWhitelist?.()}
							on:blacklist={() => onBlacklist?.()}
						/>
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
		display: flex;
		flex-direction: column;
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
		align-items: flex-start;
		width: 100%;
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
		justify-content: space-between;
		width: 100%;
		gap: 8px;
		flex-wrap: wrap;
		text-align: left;
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

	.card__action-rail {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 6px;
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

	/* action buttons now provided by JobActionGroup + CompanyStatusGroup */

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

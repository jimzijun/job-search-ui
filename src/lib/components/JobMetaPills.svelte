<script lang="ts">
	type JobMetaCompanyStatus = 'blacklist' | 'whitelist';

	type JobMeta = {
		location?: string;
		job_type?: string;
		experience_range?: string;
		salary?: string;
		has_python_keyword?: boolean;
	};

	export let job: JobMeta;
	export let companyStatus: JobMetaCompanyStatus | undefined = undefined;
</script>

<div class="meta-row">
	{#if job.location}
		<span class="pill neutral">{job.location}</span>
	{/if}
	{#if job.job_type}
		<span class="pill neutral">{job.job_type}</span>
	{/if}
	{#if job.experience_range}
		<span class="pill neutral">Experience: {job.experience_range}</span>
	{/if}
	{#if job.salary}
		<span class="pill accent">Salary {job.salary}</span>
	{/if}
	{#if job.has_python_keyword === true}
		<span class="pill success">Python keyword</span>
	{:else if job.has_python_keyword === false}
		<span class="pill neutral subtle">No Python keyword</span>
	{/if}
	{#if companyStatus === 'whitelist'}
		<span class="pill success subtle">Preferred company</span>
	{:else if companyStatus === 'blacklist'}
		<span class="pill danger subtle">Blacklisted</span>
	{/if}
</div>

<style>
	.meta-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
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
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { doc, getDoc } from 'firebase/firestore';
	import { getDb, onAuthChange } from '$lib/firebase';

	export let params: { id: string };

type JobDetail = {
	id: string;
	title: string;
	company: string;
	companySlug?: string;
	location?: string;
	experience_range?: string;
	job_type?: string;
	salary?: string;
	has_python_keyword?: boolean;
	date_posted?: Date;
	description?: string;
	descriptionHtml?: string;
	url?: string;
};

	let job: JobDetail | null = null;
	let loading = true;
	let error = '';
	let descriptionMarkup = '';
	let authReady = false;

	const companyPath = (item: JobDetail | null) =>
		item ? `/company/${encodeURIComponent(item.companySlug ?? item.company)}` : '#';

	const formatDate = (date?: Date) =>
		date
			? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			: 'Unknown';

	const pickString = (...values: unknown[]) =>
		values.find((value) => typeof value === 'string' && value.trim() !== '') as string | undefined;

	const pickBoolean = (...values: unknown[]) => {
		for (const value of values) {
			if (typeof value === 'boolean') return value;
		}
		return undefined;
	};

	const loadJob = async () => {
		loading = true;
		error = '';
		const db = getDb();
		if (!db) {
			error = 'Firestore not available';
			loading = false;
			return;
		}

		try {
			const snap = await getDoc(doc(db, 'jobs', params.id));
			if (!snap.exists()) {
				error = 'Job not found';
				return;
			}
			const data = snap.data() as Record<string, unknown>;
			job = {
				id: params.id,
				title: (data.title as string) ?? 'Untitled role',
				company: (data.company as string) ?? 'Unknown company',
				companySlug: (data.company_slug as string) ?? (data.companySlug as string),
				location: data.location as string | undefined,
				experience_range: pickString(data.experience_range, data.experienceRange),
				job_type: pickString(data.job_type, data.jobType),
				salary: pickString(data.salary, data.salary_range, data.compensation),
				has_python_keyword: pickBoolean(
					data.has_python_keyword,
					data.hasPythonKeyword,
					data.has_python,
					data.hasPython
				),
				date_posted: data.date_posted && typeof data.date_posted === 'object' && 'toDate' in data.date_posted
					? (data.date_posted as { toDate: () => Date }).toDate()
					: undefined,
				description: (data.description as string) ?? (data.snippet as string),
				descriptionHtml: (data.description_html as string) ?? (data.descriptionHtml as string),
				url: pickString(
					data.job_url_direct,
					data.job_url,
					data.url,
					data.link,
					data.apply_url
				)
			};
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load job';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		const stopAuth = onAuthChange(async (user) => {
			authReady = true;
			if (!user) {
				job = null;
				error = 'Sign in to view this job';
				loading = false;
				return;
			}
			// Ensure the ID token is ready before reading Firestore to avoid permission errors on refresh
			try {
				await user.getIdToken();
			} catch (tokenErr) {
				console.error('Failed to refresh auth token', tokenErr);
			}
			error = '';
			// When auth is established, fetch the job if not already loaded
			if (!job) {
				void loadJob();
			}
		});

		return () => stopAuth?.();
	});

	const renderMarkdown = (content: string) =>
		marked.parse(content, { gfm: true, breaks: true }) as string;

	$: descriptionMarkup = job?.descriptionHtml
		? job.descriptionHtml
		: job?.description
			? renderMarkdown(job.description)
			: '';
</script>

<div class="page">
	<header class="topbar">
		<a class="ghost" href="/">← Back to feed</a>
		<div class="crumbs">
			<span class="muted">Job</span>
			<span>#{params.id}</span>
		</div>
	</header>

	<main class="content">
		{#if loading}
			<p class="meta">Loading job…</p>
		{:else if error}
			<p class="meta error">Error: {error}</p>
		{:else if job}
			<article class="panel">
				<header class="panel__header">
					<div>
						<p class="eyebrow">Job description</p>
						<h1>{job.title}</h1>
						<div class="meta-row">
							<a class="link" href={companyPath(job)}>{job.company}</a>
							{#if job.location}
								<span class="pill neutral">{job.location}</span>
							{/if}
							<span class="pill subtle">Posted {formatDate(job.date_posted)}</span>
						</div>
						{#if job.job_type || job.experience_range || job.salary || job.has_python_keyword !== undefined}
							<div class="meta-row">
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
							</div>
						{/if}
					</div>
					{#if job.url}
						<a class="cta" href={job.url} target="_blank" rel="noreferrer">
							<span>View / Apply</span>
							<span class="cta__icon" aria-hidden="true">↗</span>
						</a>
					{/if}
				</header>

				<section class="body">
					{#if descriptionMarkup}
						<div class="rich" aria-label="Job description">
							{@html descriptionMarkup}
						</div>
					{:else}
						<p class="meta">No description available.</p>
					{/if}
				</section>
			</article>
		{:else}
			<p class="meta">Job not found.</p>
		{/if}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		background: #0b1220;
		color: #e2e8f0;
	}

	.page {
		min-height: 100vh;
		background: radial-gradient(120% 80% at 10% 20%, rgba(81, 117, 255, 0.18), transparent),
			radial-gradient(120% 80% at 80% 0%, rgba(16, 185, 129, 0.18), transparent),
			linear-gradient(180deg, #0b1220, #0f172a 50%, #0b1220);
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		border-bottom: 1px solid rgba(226, 232, 240, 0.08);
		position: sticky;
		top: 0;
		backdrop-filter: blur(10px);
		background: rgba(11, 18, 32, 0.8);
		z-index: 10;
	}

	.crumbs {
		display: flex;
		gap: 6px;
		color: #cbd5e1;
		font-size: 14px;
	}

	.muted {
		color: #94a3b8;
	}

	.content {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px 16px 40px;
	}

	.panel {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(226, 232, 240, 0.08);
		border-radius: 16px;
		padding: 20px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
	}

	.panel__header {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	h1 {
		margin: 4px 0 6px;
		font-size: 24px;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 12px;
		margin: 0;
		color: #94a3b8;
	}

	.meta-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}

	.link {
		color: #bfdbfe;
		text-decoration: none;
		font-weight: 700;
	}

	.link:hover {
		text-decoration: underline;
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

	.pill.subtle {
		opacity: 0.85;
	}

	.meta {
		color: #94a3b8;
		margin: 4px 0 0;
		font-size: 14px;
	}

	.meta.error {
		color: #f87171;
	}

	.ghost {
		color: #e2e8f0;
		text-decoration: none;
		border: 1px solid rgba(226, 232, 240, 0.18);
		padding: 6px 10px;
		border-radius: 10px;
		font-weight: 600;
		background: transparent;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(14, 165, 233, 0.22));
		color: #e2e8f0;
		border: 1px solid rgba(96, 165, 250, 0.55);
		border-radius: 12px;
		padding: 10px 14px;
		font-weight: 700;
		text-decoration: none;
		box-shadow: 0 10px 24px rgba(14, 165, 233, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);
		transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
	}

	.cta:hover {
		transform: translateY(-1px);
		border-color: rgba(125, 211, 252, 0.9);
		box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12);
	}

	.cta__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(226, 232, 240, 0.12);
		font-size: 13px;
	}

	.body {
		margin-top: 16px;
		line-height: 1.6;
		color: #e2e8f0;
	}

	.rich :global(p) {
		margin: 0 0 12px;
	}

	.rich :global(a) {
		color: #bfdbfe;
	}

	.rich :global(h1),
	.rich :global(h2),
	.rich :global(h3) {
		margin: 18px 0 8px;
		line-height: 1.3;
	}

	.rich :global(h1) {
		font-size: 22px;
	}

	.rich :global(h2) {
		font-size: 18px;
	}

	.rich :global(h3) {
		font-size: 16px;
	}

	.rich :global(ul),
	.rich :global(ol) {
		margin: 10px 0 14px 18px;
		padding: 0;
	}

	.rich :global(li) {
		margin-bottom: 6px;
	}

	.rich :global(strong) {
		color: #f8fafc;
	}

	.rich :global(code) {
		background: rgba(148, 163, 184, 0.12);
		padding: 2px 6px;
		border-radius: 6px;
		font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		font-size: 13px;
	}

	.rich :global(pre code) {
		display: block;
		padding: 12px;
		overflow-x: auto;
	}
</style>

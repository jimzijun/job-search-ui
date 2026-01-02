<script lang="ts">
	import { onMount } from 'svelte';
	import {
		collection,
		deleteDoc,
		doc,
		getDoc,
		getDocs,
		limit,
		query,
		setDoc,
		where
	} from 'firebase/firestore';
	import { getDb, onAuthChange } from '$lib/firebase';

	export let params: { slug: string };

	type Company = {
		name: string;
		logo?: string;
		website?: string;
		description?: string;
		employees?: string;
		revenue?: string;
	};

	type CompanyStatus = 'blacklist' | 'whitelist';

	type Job = {
		id: string;
		title: string;
		location?: string;
		date_posted?: Date;
	};

	let company: Company | null = null;
	let jobs: Job[] = [];
	let loading = true;
	let error = '';
	let authReady = false;
	let userId = '';
	let companyStatus: CompanyStatus | undefined;
	let statusError = '';
	let statusSaving = false;

	const decodedName = decodeURIComponent(params.slug);

	const formatDate = (date?: Date) =>
		date
			? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			: 'Unknown';

	const pickString = (...values: unknown[]) =>
		values.find((value) => typeof value === 'string' && value.trim() !== '') as string | undefined;

	const normalizeCompanyStatus = (value: unknown): CompanyStatus | undefined =>
		value === 'blacklist' || value === 'whitelist' ? value : undefined;

	const loadCompanyStatus = async () => {
		statusError = '';
		if (!userId) {
			companyStatus = undefined;
			return;
		}

		const db = getDb();
		if (!db) return;

		try {
			const snap = await getDoc(doc(db, 'users', userId, 'company_status', params.slug));
			companyStatus = snap.exists() ? normalizeCompanyStatus(snap.data()?.['status']) : undefined;
		} catch (err) {
			statusError = err instanceof Error ? err.message : 'Failed to load company status';
		}
	};

	const setCompanyStatus = async (status?: CompanyStatus) => {
		if (!userId) {
			statusError = 'Sign in to manage this company';
			return;
		}

		const db = getDb();
		if (!db) {
			statusError = 'Firestore not available';
			return;
		}

		statusSaving = true;
		statusError = '';
		companyStatus = status;

		const ref = doc(db, 'users', userId, 'company_status', params.slug);
		try {
			if (!status) {
				await deleteDoc(ref);
			} else {
				await setDoc(ref, { status });
			}
		} catch (err) {
			statusError = err instanceof Error ? err.message : 'Failed to update company status';
			await loadCompanyStatus();
		} finally {
			statusSaving = false;
		}
	};

	const toggleCompanyStatus = (status: CompanyStatus) => {
		const nextStatus = companyStatus === status ? undefined : status;
		void setCompanyStatus(nextStatus);
	};

	const loadCompany = async () => {
		loading = true;
		error = '';
		const db = getDb();
		if (!db) {
			error = 'Firestore not available';
			loading = false;
			return;
		}

		try {
			const companySnap = await getDoc(doc(db, 'companys', params.slug));
			if (companySnap.exists()) {
				const data = companySnap.data() as Record<string, unknown>;
				const sources = (data.sources as Record<string, unknown>) ?? {};
				const indeedData = (sources.in as Record<string, unknown>) ?? {};
				const merged = (data.merged as Record<string, unknown>) ?? {};
				company = {
					name: (data.name as string) ?? decodedName,
					logo: (data.company_logo as string) ?? (indeedData.company_logo as string),
					website: pickString(
						data.website,
						data.company_url,
						merged.company_url,
						indeedData.company_url,
						indeedData.website
					),
					description: pickString(
						merged.company_description,
						data.description,
						indeedData.company_description,
						indeedData.description
					),
					employees: pickString(
						merged.company_num_employees,
						data.company_num_employees,
						indeedData.company_num_employees
					),
					revenue: pickString(merged.company_revenue, data.company_revenue, indeedData.company_revenue)
				};
			} else {
				company = { name: decodedName };
			}

			const slugJobs = await getDocs(
				query(collection(db, 'jobs'), where('company_slug', '==', params.slug), limit(20))
			);

			const jobsBySlug = slugJobs.docs.map((item) => {
				const data = item.data() as Record<string, unknown>;
				return {
					id: item.id,
					title: (data.title as string) ?? 'Untitled role',
					location: data.location as string | undefined,
					date_posted: data.date_posted && typeof data.date_posted === 'object' && 'toDate' in data.date_posted
						? (data.date_posted as { toDate: () => Date }).toDate()
						: undefined
				};
			});

			if (jobsBySlug.length > 0) {
				jobs = jobsBySlug;
			} else {
				const nameMatches = await getDocs(
					query(collection(db, 'jobs'), where('company', '==', decodedName), limit(20))
				);
				jobs = nameMatches.docs.map((item) => {
					const data = item.data() as Record<string, unknown>;
					return {
						id: item.id,
						title: (data.title as string) ?? 'Untitled role',
						location: data.location as string | undefined,
						date_posted: data.date_posted && typeof data.date_posted === 'object' && 'toDate' in data.date_posted
							? (data.date_posted as { toDate: () => Date }).toDate()
							: undefined
					};
				});
			}

			jobs = jobs.sort((a, b) => (b.date_posted?.getTime() ?? 0) - (a.date_posted?.getTime() ?? 0));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load company';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		const stopAuth = onAuthChange(async (user) => {
			authReady = true;
			if (!user) {
				userId = '';
				companyStatus = undefined;
				statusSaving = false;
				company = null;
				jobs = [];
				error = 'Sign in to view this company';
				loading = false;
				return;
			}

			try {
				// Ensure token is fresh before Firestore reads to avoid permission-denied after refresh
				await user.getIdToken();
			} catch (tokenErr) {
				console.error('Failed to refresh auth token', tokenErr);
			}

			error = '';
			userId = user.uid;
			if (!company) {
				void loadCompany();
			}
			void loadCompanyStatus();
		});

		return () => stopAuth?.();
	});
</script>

<div class="page">
	<header class="topbar">
		<a class="ghost" href="/">← Back to feed</a>
		<div class="crumbs">
			<span class="muted">Company</span>
			<span>{decodedName}</span>
		</div>
	</header>

	<main class="content">
		{#if loading}
			<p class="meta">Loading company…</p>
		{:else if error}
			<p class="meta error">Error: {error}</p>
		{:else if company}
			<article class="panel">
				<header class="panel__header">
					<div class="company-meta">
						{#if company.logo}
							<img class="logo" src={company.logo} alt={`${company.name} logo`} loading="lazy" />
						{:else}
							<div class="logo fallback">{company.name.slice(0, 1).toUpperCase()}</div>
						{/if}
						<div>
							<p class="eyebrow">Company profile</p>
							<h1>{company.name}</h1>
						</div>
					</div>

					<div class="actions">
						<div class="status-actions">
							{#if company.website}
								<a class="status-button visit" href={company.website} target="_blank" rel="noreferrer">
									Visit site
								</a>
							{/if}
							<button
								class="status-button"
								class:selected={companyStatus === 'whitelist'}
								on:click={() => toggleCompanyStatus('whitelist')}
								disabled={statusSaving}
							>
								{companyStatus === 'whitelist' ? 'Whitelisted' : 'Whitelist'}
							</button>
							<button
								class="status-button danger"
								class:selected={companyStatus === 'blacklist'}
								on:click={() => toggleCompanyStatus('blacklist')}
								disabled={statusSaving}
							>
								{companyStatus === 'blacklist' ? 'Blacklisted' : 'Blacklist'}
							</button>
						</div>
					</div>
				</header>

				{#if statusError}
					<p class="meta error status-error">Status: {statusError}</p>
				{/if}

				<section class="body">
					{#if company.description}
						<p class="plain">{company.description}</p>
					{:else}
						<p class="meta">No description available.</p>
					{/if}
				</section>

				{#if company.employees || company.revenue}
					<section class="facts">
						<h2>Company info</h2>
						<div class="facts__grid">
							{#if company.employees}
								<div class="fact">
									<p class="label">Team size</p>
									<p class="value">{company.employees}</p>
								</div>
							{/if}
							{#if company.revenue}
								<div class="fact">
									<p class="label">Revenue</p>
									<p class="value">{company.revenue}</p>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<section class="jobs">
					<div class="jobs__header">
						<h2>Recent jobs</h2>
						<p class="meta">{jobs.length} listed</p>
					</div>
					{#if jobs.length === 0}
						<p class="meta">No jobs found for this company.</p>
					{:else}
						<ul class="job-list">
							{#each jobs as job (job.id)}
								<li>
									<a class="job-row" href={`/jobs/${job.id}`}>
										<div>
											<div class="job-title">{job.title}</div>
											<div class="job-meta">
												{#if job.location}
													<span class="pill neutral">{job.location}</span>
												{/if}
												<span class="pill subtle">Posted {formatDate(job.date_posted)}</span>
											</div>
										</div>
										<span class="arrow">→</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</article>
		{:else}
			<p class="meta">Company not found.</p>
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
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.panel__header {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
	}

	.company-meta {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	h1 {
		margin: 4px 0 6px;
		font-size: 24px;
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 12px;
		margin: 0;
		color: #94a3b8;
	}

	.logo {
		width: 50px;
		height: 50px;
		border-radius: 12px;
		object-fit: cover;
		background: rgba(226, 232, 240, 0.06);
		display: grid;
		place-items: center;
		color: #cbd5e1;
		font-weight: 700;
		font-size: 18px;
	}

	.logo.fallback {
		border: 1px solid rgba(226, 232, 240, 0.18);
	}

	.meta {
		color: #94a3b8;
		margin: 4px 0 0;
		font-size: 14px;
	}

	.meta.error {
		color: #f87171;
	}

	.link {
		color: #bfdbfe;
		text-decoration: none;
		font-weight: 700;
	}

	.link:hover {
		text-decoration: underline;
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #2563eb, #22c55e);
		color: #0b1220;
		font-weight: 700;
		text-decoration: none;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid rgba(226, 232, 240, 0.14);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
		transition: transform 120ms ease, box-shadow 120ms ease;
	}

	.button:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
	}

	.actions {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-left: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.status-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.status-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1px solid rgba(226, 232, 240, 0.18);
		background: rgba(255, 255, 255, 0.03);
		color: #e2e8f0;
		font-weight: 700;
		padding: 8px 12px;
		cursor: pointer;
		transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
		text-decoration: none;
	}

	.status-button:hover {
		transform: translateY(-1px);
		border-color: rgba(226, 232, 240, 0.32);
	}

	.status-button.selected {
		background: rgba(34, 197, 94, 0.15);
		border-color: rgba(34, 197, 94, 0.45);
	}

	.status-button.visit {
		background: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(34, 197, 94, 0.2));
		border-color: rgba(226, 232, 240, 0.24);
		color: #e2e8f0;
	}

	.status-button.visit:hover {
		border-color: rgba(226, 232, 240, 0.4);
	}

	.status-button.danger {
		border-color: rgba(248, 113, 113, 0.35);
		color: #fecdd3;
	}

	.status-button.danger.selected {
		background: rgba(248, 113, 113, 0.14);
		border-color: rgba(248, 113, 113, 0.6);
	}

	.status-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
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

	.body {
		line-height: 1.6;
		color: #e2e8f0;
	}

	.facts {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.facts__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
	}

	.fact {
		padding: 12px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.fact.link-card {
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.label {
		margin: 0;
		color: #94a3b8;
		font-size: 13px;
		letter-spacing: 0.01em;
		text-transform: uppercase;
	}

	.value {
		margin: 0;
		font-weight: 700;
		color: #e2e8f0;
		word-break: break-word;
	}

	.jobs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.jobs__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		flex-wrap: wrap;
	}

	.job-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.job-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
		background: rgba(255, 255, 255, 0.02);
	}

	.job-title {
		font-weight: 700;
	}

	.job-meta {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 4px;
	}

	.arrow {
		color: #bfdbfe;
		font-weight: 700;
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

	.pill.subtle {
		opacity: 0.85;
	}

	.plain {
		white-space: pre-line;
		margin: 0;
	}

	.status-error {
		margin: 0;
	}
</style>

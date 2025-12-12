<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import {
		collection,
		doc,
		getDoc,
		getDocs,
		limit,
	onSnapshot,
	orderBy,
	query,
	setDoc,
	startAfter,
	deleteDoc,
	type DocumentData,
	type QueryDocumentSnapshot,
	type Unsubscribe
} from 'firebase/firestore';
import {
	getAuthClient,
	getDb,
	onAuthChange,
	signInWithGoogle,
	signOutUser
} from '$lib/firebase';

	type Job = {
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

	type JobInteraction = {
		hidden?: boolean;
		pinned?: boolean;
		submitted?: boolean;
	};

	type CompanyStatus = 'blacklist' | 'whitelist';
	type CompanyStatusEntry = {
		key: string;
		status: CompanyStatus;
		name: string;
		logo?: string;
		jobCount: number;
	};

const PAGE_SIZE = 20;
const newJobThreshold = new Date();
newJobThreshold.setHours(0, 0, 0, 0);
newJobThreshold.setDate(newJobThreshold.getDate() - 2);
const COMPANY_LOGOS_STORAGE_KEY = 'jobspy-company-logos';
const jobInteractionsStorageKey = (id: string) => `jobspy-job-interactions-${id}`;
const companyStatusStorageKey = (id: string) => `jobspy-company-statuses-${id}`;

	let liveJobs: Job[] = [];
	let pastJobs: Job[] = [];
	let companyLogos: Record<string, string | undefined> = {};
	let loading = true; // initial live feed load
	let loadingMore = false; // pagination fetch state
	let hasMore = false; // whether older pages likely exist
	let error = '';
	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let liveCursor: QueryDocumentSnapshot<DocumentData> | null = null;
	let pastCursor: QueryDocumentSnapshot<DocumentData> | null = null;
	let liveUnsubscribe: Unsubscribe | null = null;
	let newJobs: Job[] = [];
	let recentJobs: Job[] = [];
	let pinnedJobs: Job[] = [];
	let userId = '';
	let jobInteractions: Record<string, JobInteraction> = {};
	let companyStatuses: Record<string, CompanyStatus | undefined> = {};
	let jobInteractionsUnsubscribe: Unsubscribe | null = null;
let companyStatusUnsubscribe: Unsubscribe | null = null;
let lastUserSubscriptionId: string | null = null;
let companyStatusEntries: CompanyStatusEntry[] = [];
let blacklistedCompanies: CompanyStatusEntry[] = [];
let whitelistedCompanies: CompanyStatusEntry[] = [];
let hydratedPinnedJobs: Record<string, Job> = {};
let showStatusManager = false;
let navCollapsed = false;
let layoutEl: HTMLDivElement | null = null;
let authReady = false;
let authError = '';
let jobLookupId = '';
let jobLookupError = '';

	const navLinks = [
		{ href: '#status-manager', label: 'Company status' },
		{ href: '#pinned', label: 'Pinned' },
		{ href: '#new-jobs', label: 'New jobs' },
		{ href: '#recent-jobs', label: 'Recent jobs' }
	];

	const openJobById = () => {
		const trimmed = jobLookupId.trim();
		if (!trimmed) {
			jobLookupError = 'Enter a job id';
			return;
		}
		jobLookupError = '';
		goto(`/jobs/${encodeURIComponent(trimmed)}`);
	};

	$: if (jobLookupError && jobLookupId.trim()) {
		jobLookupError = '';
	}

	const hydrateJobInteractionsFromStorage = () => {
		if (!browser || !userId) return;
		try {
			const cached = localStorage.getItem(jobInteractionsStorageKey(userId));
			if (!cached) return;
			const parsed = JSON.parse(cached) as Record<string, JobInteraction>;
			jobInteractions = parsed;
		} catch (err) {
			console.error('Failed to read cached job interactions', err);
		}
	};

	const persistJobInteractionsToStorage = () => {
		if (!browser || !userId) return;
		try {
			localStorage.setItem(jobInteractionsStorageKey(userId), JSON.stringify(jobInteractions));
		} catch (err) {
			console.error('Failed to cache job interactions', err);
		}
	};

	const hydrateCompanyLogosFromStorage = () => {
		if (!browser) return;
		try {
			const cached = localStorage.getItem(COMPANY_LOGOS_STORAGE_KEY);
			if (!cached) return;
			const parsed = JSON.parse(cached) as Record<string, string | undefined>;
			companyLogos = parsed;
		} catch (err) {
			console.error('Failed to read cached company logos', err);
		}
	};

	const persistCompanyLogosToStorage = () => {
		if (!browser) return;
		try {
			localStorage.setItem(COMPANY_LOGOS_STORAGE_KEY, JSON.stringify(companyLogos));
		} catch (err) {
			console.error('Failed to cache company logos', err);
		}
	};

	const hydrateCompanyStatusesFromStorage = () => {
		if (!browser || !userId) return;
		try {
			const cached = localStorage.getItem(companyStatusStorageKey(userId));
			if (!cached) return;
			const parsed = JSON.parse(cached) as Record<string, CompanyStatus | undefined>;
			companyStatuses = parsed;
		} catch (err) {
			console.error('Failed to read cached company statuses', err);
		}
	};

	const persistCompanyStatusesToStorage = () => {
		if (!browser || !userId) return;
		try {
			localStorage.setItem(companyStatusStorageKey(userId), JSON.stringify(companyStatuses));
		} catch (err) {
			console.error('Failed to cache company statuses', err);
		}
	};

	const pickString = (...values: unknown[]) =>
		values.find((value) => typeof value === 'string' && value.trim() !== '') as string | undefined;

	const mapJobData = (data: DocumentData, id: string): Job => ({
		id,
		title: data.title ?? 'Untitled role',
		company: data.company ?? 'Unknown company',
		companySlug: data.company_slug ?? data.companySlug,
		url: pickString(
			data.job_url_direct,
			data.job_url,
			data.direct_url,
			data.url,
			data.link,
			data.apply_url
		),
		location: data.location,
		experience_range: data.experience_range ?? data.experienceRange,
		job_type: data.job_type ?? data.jobType,
		salary: data.salary ?? data.salary_range ?? data.compensation,
		has_python_keyword:
			typeof data.has_python_keyword === 'boolean'
				? data.has_python_keyword
				: typeof data.hasPythonKeyword === 'boolean'
					? data.hasPythonKeyword
					: undefined,
		date_posted: data.date_posted?.toDate ? data.date_posted.toDate() : undefined
	});

	const mapJob = (doc: QueryDocumentSnapshot<DocumentData>): Job => mapJobData(doc.data(), doc.id);

	const ensurePinnedJobsLoaded = async (interactions: Record<string, JobInteraction>) => {
		if (!browser || !userId) return;
		const db = getDb();
		if (!db) return;

		const pinnedIds = Object.entries(interactions)
			.filter(([, interaction]) => Boolean(interaction.pinned || interaction.submitted))
			.map(([id]) => id);

		if (pinnedIds.length === 0) return;

		const knownIds = new Set(
			[...liveJobs, ...pastJobs, ...Object.values(hydratedPinnedJobs)].map((job) => job.id)
		);
		const missingIds = pinnedIds.filter((id) => !knownIds.has(id));
		if (missingIds.length === 0) return;

		try {
			const snapshots = await Promise.all(missingIds.map((id) => getDoc(doc(db, 'jobs', id))));
			const found = snapshots
				.filter((snap) => snap.exists())
				.map((snap) => mapJobData(snap.data() ?? {}, snap.id));

			if (found.length === 0) return;
			hydratedPinnedJobs = { ...hydratedPinnedJobs, ...Object.fromEntries(found.map((job) => [job.id, job])) };
			void refreshCompanyLogos(found);
		} catch (err) {
			console.error('Failed to load pinned jobs', err);
		}
	};

	const refreshCompanyLogos = async (jobsForLogos: Job[]) => {
		const db = getDb();
		if (!db) return;

		const slugs = jobsForLogos
			.map((job) => job.companySlug)
			.filter((slug): slug is string => Boolean(slug));
		const missingSlugs = Array.from(new Set(slugs.filter((slug) => !(slug in companyLogos))));
		if (missingSlugs.length === 0) return;

		try {
			const entries = await Promise.all(
				missingSlugs.map(async (slug) => {
					const snap = await getDoc(doc(db, 'companys', slug));
					if (!snap.exists()) return [slug, undefined] as const;
					const data = snap.data() as Record<string, unknown>;
					const sources = (data.sources as Record<string, unknown>) ?? {};
					const indeedData = (sources.in as Record<string, unknown>) ?? {};
					const logo = (data.company_logo as string) ?? (indeedData.company_logo as string);
					return [slug, logo] as const;
				})
			);
			companyLogos = { ...companyLogos, ...Object.fromEntries(entries) };
			if (entries.length > 0) {
				persistCompanyLogosToStorage();
			}
		} catch (err) {
			console.error('Failed to fetch company logos', err);
		}
	};

	const getCompanyLogo = (job: Job) =>
		job.companySlug ? companyLogos[job.companySlug] : undefined;

	const getCompanyKey = (job: Job) => job.companySlug ?? job.company.toLowerCase();

	const getInteraction = (jobId: string): JobInteraction => jobInteractions[jobId] ?? {};

	const getCompanyStatus = (job: Job): CompanyStatus | undefined =>
		companyStatuses[getCompanyKey(job)];

	const jobPath = (job: Job) => `/jobs/${job.id}`;
	const companyPath = (job: Job) => `/company/${encodeURIComponent(job.companySlug ?? job.company)}`;

const isJobHidden = (job: Job) => Boolean(getInteraction(job.id).hidden);

	const isCompanyBlacklisted = (job: Job) => getCompanyStatus(job) === 'blacklist';

	const isHidden = (job: Job) => isJobHidden(job) || isCompanyBlacklisted(job);

	const isPinned = (job: Job) => Boolean(getInteraction(job.id).pinned);

	const isSubmitted = (job: Job) => Boolean(getInteraction(job.id).submitted);

	const isNewJob = (job: Job) =>
		job.date_posted ? job.date_posted.getTime() >= newJobThreshold.getTime() : false;

	const sortByDateDesc = (a: Job, b: Job) =>
		(b.date_posted?.getTime() ?? 0) - (a.date_posted?.getTime() ?? 0);

	const isPinnedLike = (job: Job) => isPinned(job) || isSubmitted(job);

	const sortByPinnedThenDate = (a: Job, b: Job) => {
		const pinnedDiff = Number(isPinnedLike(b)) - Number(isPinnedLike(a));
		if (pinnedDiff !== 0) return pinnedDiff;
		return sortByDateDesc(a, b);
	};

	const resetLiveFeedState = () => {
		liveJobs = [];
		pastJobs = [];
		newJobs = [];
		recentJobs = [];
		pinnedJobs = [];
		liveCursor = null;
		pastCursor = null;
		hasMore = false;
		loadingMore = false;
		error = '';
		loading = true;
	};

	const subscribeToUserData = () => {
		if (!browser || !userId) return;
		const db = getDb();
		if (!db) return;

		if (lastUserSubscriptionId === userId) return;
		lastUserSubscriptionId = userId;

		jobInteractionsUnsubscribe?.();
		companyStatusUnsubscribe?.();
		jobInteractions = {};
		companyStatuses = {};
		hydratedPinnedJobs = {};
		hydrateJobInteractionsFromStorage();
		hydrateCompanyStatusesFromStorage();
		void ensurePinnedJobsLoaded(jobInteractions);

		const interactionsRef = collection(db, 'users', userId, 'job_interactions');
		jobInteractionsUnsubscribe = onSnapshot(
			interactionsRef,
			(snapshot) => {
				const next: Record<string, JobInteraction> = {};
				snapshot.forEach((doc) => {
					next[doc.id] = doc.data() as JobInteraction;
				});
				jobInteractions = next;
				persistJobInteractionsToStorage();
				void ensurePinnedJobsLoaded(next);
			},
			(err) => console.error('job_interactions listener error', err)
		);

		const companyStatusRef = collection(db, 'users', userId, 'company_status');
		companyStatusUnsubscribe = onSnapshot(
			companyStatusRef,
			(snapshot) => {
				const next: Record<string, CompanyStatus | undefined> = {};
				snapshot.forEach((doc) => {
					const status = (doc.data().status as CompanyStatus | undefined) ?? undefined;
					next[doc.id] = status;
				});
				companyStatuses = next;
				persistCompanyStatusesToStorage();
			},
			(err) => console.error('company_status listener error', err)
		);
	};

	$: {
		// ensure list derivations react to interaction/status changes
		jobInteractions;
		companyStatuses;
		const all = [...liveJobs, ...pastJobs, ...Object.values(hydratedPinnedJobs)];
		const seen = new Set<string>();
		const unique = all.filter((job) => {
			if (seen.has(job.id)) return false;
			seen.add(job.id);
			return true;
		});
		const visible = unique.filter((job) => !isHidden(job));
		pinnedJobs = visible.filter(isPinnedLike).sort(sortByDateDesc);
		const nonPinned = visible.filter((job) => !isPinnedLike(job));
		newJobs = nonPinned.filter(isNewJob).sort(sortByDateDesc);
		recentJobs = nonPinned.filter((job) => !isNewJob(job)).sort(sortByDateDesc);
	}

	const startLiveSubscription = () => {
		if (!browser) return;
		error = '';
		loading = true;
		try {
			const db = getDb();
			if (!db) throw new Error('Firestore not available');

			const q = query(collection(db, 'jobs'), orderBy('date_posted', 'desc'), limit(PAGE_SIZE));
			liveUnsubscribe = onSnapshot(
				q,
				(snapshot) => {
					const mapped = snapshot.docs.map(mapJob);
					const previousLive = liveJobs;
					liveJobs = mapped;
					liveCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
					const dedupedPast = pastJobs.filter((job) => !mapped.some((live) => live.id === job.id));
					const droppedFromLive = previousLive.filter(
						(job) => !mapped.some((live) => live.id === job.id)
					);
					const droppedToAdd = droppedFromLive.filter(
						(job) => !dedupedPast.some((p) => p.id === job.id)
					);
					pastJobs = [...droppedToAdd, ...dedupedPast];
					hasMore = hasMore || snapshot.size === PAGE_SIZE;
					loading = false;
					void refreshCompanyLogos(mapped);
				},
				(err) => {
					const code = (err as { code?: string }).code;
					error = code === 'permission-denied' ? 'Sign in to view jobs' : err.message;
					loading = false;
				}
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load jobs';
			loading = false;
		}
	};

	const restartLiveSubscription = () => {
		liveUnsubscribe?.();
		liveUnsubscribe = null;
		resetLiveFeedState();
		startLiveSubscription();
	};

	const fetchPastJobs = async () => {
		if (!browser || loading || loadingMore || !hasMore) return;
		const startCursor = pastCursor ?? liveCursor;
		if (!startCursor) return;

		loadingMore = true;
		try {
			const db = getDb();
			if (!db) throw new Error('Firestore not available');

			const q = query(
				collection(db, 'jobs'),
				orderBy('date_posted', 'desc'),
				startAfter(startCursor),
				limit(PAGE_SIZE)
			);
			const snapshot = await getDocs(q);
			const mapped = snapshot.docs.map(mapJob);
			const deduped = mapped.filter(
				(job) => !liveJobs.some((live) => live.id === job.id) && !pastJobs.some((p) => p.id === job.id)
			);

			pastJobs = [...pastJobs, ...deduped];
			pastCursor = snapshot.docs[snapshot.docs.length - 1] ?? pastCursor;
			hasMore = snapshot.size === PAGE_SIZE;
			void refreshCompanyLogos(deduped);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load jobs';
		} finally {
			loadingMore = false;
		}
	};

	const loadMore = async () => {
		if (loading || loadingMore || !hasMore) return;
		await fetchPastJobs();
	};

	const setJobInteraction = async (jobId: string, updates: Partial<JobInteraction>) => {
		if (!browser || !userId) return;
		const db = getDb();
		if (!db) return;

		const current = getInteraction(jobId);
		jobInteractions = { ...jobInteractions, [jobId]: { ...current, ...updates } };
		persistJobInteractionsToStorage();
		void ensurePinnedJobsLoaded(jobInteractions);

		await setDoc(doc(db, 'users', userId, 'job_interactions', jobId), updates, { merge: true });
	};

	const toggleJobFlag = async (jobId: string, key: keyof JobInteraction) => {
		const current = Boolean(getInteraction(jobId)[key]);
		await setJobInteraction(jobId, { [key]: !current } as Partial<JobInteraction>);
	};

	const setupObserver = () => {
		if (!browser || !sentinel) return;
		observer?.disconnect();

		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) void loadMore();
				}
			},
			{ rootMargin: '0px 0px 200px 0px' }
		);

		observer.observe(sentinel);
	};

	const handleSignIn = async () => {
		authError = '';
		try {
			await signInWithGoogle();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Sign-in failed';
		}
	};

	const handleSignOut = async () => {
		authError = '';
		try {
			await signOutUser();
		} catch (err) {
			authError = err instanceof Error ? err.message : 'Sign-out failed';
		}
	};

	const startAuthListener = () => {
		return onAuthChange((user) => {
			userId = user?.uid ?? '';
			authReady = true;
			if (!user) {
				jobInteractionsUnsubscribe?.();
				companyStatusUnsubscribe?.();
				liveUnsubscribe?.();
				liveUnsubscribe = null;
				lastUserSubscriptionId = null;
				jobInteractions = {};
				companyStatuses = {};
				hydratedPinnedJobs = {};
				resetLiveFeedState();
				loading = false;
			} else {
				hydrateJobInteractionsFromStorage();
				hydrateCompanyStatusesFromStorage();
				subscribeToUserData();
				restartLiveSubscription();
			}
		});
	};

	onMount(() => {
		if (browser) {
			hydrateCompanyLogosFromStorage();
		}
		startLiveSubscription();
		const stopAuth = startAuthListener();
		const auth = getAuthClient();
		if (!auth) {
			authReady = true;
		}

		return () => {
			stopAuth?.();
		};
	});

	$: if (sentinel) setupObserver();

	onDestroy(() => {
		if (liveUnsubscribe) liveUnsubscribe();
		jobInteractionsUnsubscribe?.();
		companyStatusUnsubscribe?.();
		observer?.disconnect();
	});

	const formatDate = (date?: Date) =>
		date
			? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			: 'Unknown';

	const getCompanyMeta = (companyKey: string) => {
		const jobs = [...liveJobs, ...pastJobs];
		const match = jobs.find((job) => getCompanyKey(job) === companyKey);
		const name = match?.company ?? companyKey;
		const logo = match ? getCompanyLogo(match) : companyLogos[companyKey];
		const jobCount = jobs.filter((job) => getCompanyKey(job) === companyKey).length;
		return { name, logo, jobCount };
	};

	const setCompanyStatus = async (companyKey: string, status?: CompanyStatus) => {
		if (!browser || !userId) return;
		const db = getDb();
		if (!db) return;

		if (!status) {
			const { [companyKey]: _current, ...rest } = companyStatuses;
			companyStatuses = rest;
		} else {
			companyStatuses = { ...companyStatuses, [companyKey]: status };
		}
		persistCompanyStatusesToStorage();

		const ref = doc(db, 'users', userId, 'company_status', companyKey);
		if (!status) {
			await deleteDoc(ref);
		} else {
			await setDoc(ref, { status });
		}
	};

	const setCompanyStatusForJob = async (job: Job, status: CompanyStatus) => {
		const companyKey = getCompanyKey(job);
		const nextStatus = companyStatuses[companyKey] === status ? undefined : status;
		await setCompanyStatus(companyKey, nextStatus);
	};

	$: companyStatusEntries = Object.entries(companyStatuses)
		.filter((entry): entry is [string, CompanyStatus] => Boolean(entry[1]))
		.map(([key, status]) => {
			const meta = getCompanyMeta(key);
			return {
				key,
				status,
				name: meta.name,
				logo: meta.logo,
				jobCount: meta.jobCount
			};
		})
		.sort((a, b) => {
			if (a.status === b.status) return a.name.localeCompare(b.name);
			return a.status === 'blacklist' ? -1 : 1;
		});

	$: blacklistedCompanies = companyStatusEntries.filter((entry) => entry.status === 'blacklist');
	$: whitelistedCompanies = companyStatusEntries.filter((entry) => entry.status === 'whitelist');

	onMount(() => {
		if (!browser || !layoutEl) return;

		const updateNavState = (width: number) => {
			navCollapsed = width < 960;
		};

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			updateNavState(entry.contentRect.width);
		});

		observer.observe(layoutEl);
		updateNavState(layoutEl.clientWidth);

		return () => observer.disconnect();
	});
</script>

<div class="page">
	<header class="topbar">
		<div class="logo">JobSpy</div>
		<div class="subtitle">Last 3 days + history, auto-loads on scroll</div>
	</header>

	<main class="content">
		<div bind:this={layoutEl} class="layout" class:nav-collapsed={navCollapsed}>
			{#if !navCollapsed}
				<aside class="sidebar">
					<nav>
						<div class="nav-title">Jump to</div>
						{#each navLinks as link}
							<a href={link.href}>{link.label}</a>
						{/each}
					</nav>
				</aside>
			{/if}
			<section class="panel">
				{#if navCollapsed}
					<nav class="inline-nav">
						<div class="nav-title">Jump to</div>
						<div class="inline-nav__links">
							{#each navLinks as link}
								<a href={link.href}>{link.label}</a>
							{/each}
						</div>
					</nav>
				{/if}
				<div class="panel__header">
					<h1>Job Feed</h1>
					<p class="meta">Pinned first, then most recent</p>
				</div>

			<div class="user-control">
				<label>Active user</label>
				<div class="user-control__field auth-row">
					{#if !authReady}
						<p class="meta">Checking sign-in…</p>
					{:else if !userId}
						<button on:click={handleSignIn}>Sign in with Google</button>
					{:else}
						<div>
							<p class="meta">Signed in as <code>{userId}</code></p>
						</div>
						<button class="ghost" on:click={handleSignOut}>Sign out</button>
					{/if}
				</div>
				{#if authError}
					<p class="error">{authError}</p>
				{/if}
				<p class="meta">
					Selections sync to Firestore at <code>users/{userId || '…'}</code>
				</p>
			</div>

			<form class="quick-open" on:submit|preventDefault={openJobById}>
				<div>
					<label for="job-id-input">Open job by ID</label>
					<p class="meta">Paste a job id from anywhere in the feed to jump to the detail page</p>
				</div>
				<div class="quick-open__controls">
					<input
						id="job-id-input"
						name="job-id"
						autocomplete="off"
						placeholder="e.g. abc123"
						bind:value={jobLookupId}
					/>
					<button type="submit">Open</button>
				</div>
				{#if jobLookupError}
					<p class="meta error">{jobLookupError}</p>
				{/if}
			</form>

			<div class="section" id="status-manager">
				<div class="section__header">
					<h2>Company status</h2>
					<p class="meta">Review blacklist/whitelist for this user</p>
					<button class="ghost" on:click={() => (showStatusManager = !showStatusManager)}>
						{showStatusManager ? 'Hide manager' : 'Show manager'}
					</button>
				</div>
				<div class="status-summary">
					<span class="pill danger subtle">{blacklistedCompanies.length} blacklisted</span>
					<span class="pill success subtle">{whitelistedCompanies.length} whitelisted</span>
				</div>
				{#if showStatusManager}
					{#if companyStatusEntries.length === 0}
						<p class="meta">No companies marked yet.</p>
					{:else}
						<div class="status-grid">
							<div class="status-column">
								<div class="status-column__header">
									<h3>Blacklisted</h3>
									<p class="meta">{blacklistedCompanies.length} companies</p>
								</div>
								{#if blacklistedCompanies.length === 0}
									<p class="meta">No blacklisted companies.</p>
								{:else}
									<div class="status-list">
										{#each blacklistedCompanies as company (company.key)}
											<div class="status-row danger">
												<div class="status-row__info">
													{#if company.logo}
														<img
															class="status-row__logo"
															src={company.logo}
															alt={`${company.name} logo`}
															loading="lazy"
														/>
													{:else}
														<div class="status-row__avatar">{company.name.slice(0, 1).toUpperCase()}</div>
													{/if}
													<div>
														<div class="status-row__name">{company.name}</div>
														<p class="meta">
															{company.jobCount > 0
																? `${company.jobCount} job${company.jobCount === 1 ? '' : 's'} in feed`
																: 'No jobs currently loaded'}
														</p>
													</div>
												</div>
												<div class="status-row__actions">
													<button class="ghost" on:click={() => setCompanyStatus(company.key)}>
														Remove
													</button>
													<button on:click={() => setCompanyStatus(company.key, 'whitelist')}>
														Move to whitelist
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
							<div class="status-column">
								<div class="status-column__header">
									<h3>Whitelisted</h3>
									<p class="meta">{whitelistedCompanies.length} companies</p>
								</div>
								{#if whitelistedCompanies.length === 0}
									<p class="meta">No whitelisted companies.</p>
								{:else}
									<div class="status-list">
										{#each whitelistedCompanies as company (company.key)}
											<div class="status-row success">
												<div class="status-row__info">
													{#if company.logo}
														<img
															class="status-row__logo"
															src={company.logo}
															alt={`${company.name} logo`}
															loading="lazy"
														/>
													{:else}
														<div class="status-row__avatar">{company.name.slice(0, 1).toUpperCase()}</div>
													{/if}
													<div>
														<div class="status-row__name">{company.name}</div>
														<p class="meta">
															{company.jobCount > 0
																? `${company.jobCount} job${company.jobCount === 1 ? '' : 's'} in feed`
																: 'No jobs currently loaded'}
														</p>
													</div>
												</div>
												<div class="status-row__actions">
													<button class="ghost" on:click={() => setCompanyStatus(company.key)}>
														Remove
													</button>
													<button class="danger" on:click={() => setCompanyStatus(company.key, 'blacklist')}>
														Move to blacklist
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/if}
			</div>

			{#if loading}
				<p class="meta">Loading jobs…</p>
			{:else if authReady && !userId}
				<div class="auth-prompt">
					<p class="meta">Sign in above to view and save jobs.</p>
				</div>
			{:else if error}
				<p class="meta error">{error}</p>
			{:else}
				{#if pinnedJobs.length === 0 && newJobs.length === 0 && recentJobs.length === 0}
					<p class="meta">No jobs found.</p>
				{:else}
					{#if pinnedJobs.length > 0}
						<div class="section" id="pinned">
							<div class="section__header">
								<h2>Pinned</h2>
								<p class="meta">Pinned by you, sorted by most recent</p>
							</div>
							<div class="list">
								{#each pinnedJobs as job (job.id)}
									<div class="card" data-hidden={isHidden(job)}>
										<div class="card__grid">
											<div class="card__content">
												<div class="card__top">
													<a class="title-link" href={jobPath(job)}>{job.title}</a>
												</div>
												<div class="card__meta">
													<a class="company-chip" href={companyPath(job)}>
														{#if getCompanyLogo(job)}
															<img
																class="company-chip__logo"
																src={getCompanyLogo(job)}
																alt={`${job.company} logo`}
																loading="lazy"
															/>
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
													<span class="pill accent">Pinned</span>
													{#if isSubmitted(job)}
														<span class="pill success">Submitted</span>
													{/if}
													{#if getCompanyStatus(job) === 'whitelist'}
														<span class="pill success subtle">Preferred company</span>
													{:else if getCompanyStatus(job) === 'blacklist'}
														<span class="pill danger subtle">Blacklisted</span>
													{/if}
													{#if isJobHidden(job)}
														<span class="pill neutral subtle">Hidden</span>
													{/if}
												</div>
											</div>
											<div class="card__side">
												<div class="card__top-actions">
													<a
														class="direct-link"
														href={job.url ?? jobPath(job)}
														target={job.url ? '_blank' : undefined}
														rel={job.url ? 'noreferrer' : undefined}
													>
														{job.url ? 'Job link' : 'View details'}
													</a>
													<div class="date">{formatDate(job.date_posted)}</div>
												</div>
												<div class="card__action-rail" aria-label="Job and company actions">
													<button
														class="icon-button"
														class:selected={isPinned(job)}
														on:click={() => toggleJobFlag(job.id, 'pinned')}
														title={isPinned(job) ? 'Unpin' : 'Pin'}
														aria-label={isPinned(job) ? 'Unpin job' : 'Pin job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-3-7 3V4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isPinned(job) ? 'Unpin' : 'Pin'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={isSubmitted(job)}
														on:click={() => toggleJobFlag(job.id, 'submitted')}
														title={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														aria-label={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">
															{isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														</span>
													</button>
													<button
														class="icon-button ghost"
														on:click={() => toggleJobFlag(job.id, 'hidden')}
														title={isJobHidden(job) ? 'Unhide' : 'Hide'}
														aria-label={isJobHidden(job) ? 'Unhide job' : 'Hide job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 5c-4.8 0-8.8 3-10 7 1.2 4 5.2 7 10 7s8.8-3 10-7c-1.2-4-5.2-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isJobHidden(job) ? 'Unhide' : 'Hide'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={getCompanyStatus(job) === 'whitelist'}
														on:click={() => setCompanyStatusForJob(job, 'whitelist')}
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
													<button
														class="icon-button danger"
														class:selected={getCompanyStatus(job) === 'blacklist'}
														on:click={() => setCompanyStatusForJob(job, 'blacklist')}
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
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="section" id="new-jobs">
						<div class="section__header">
							<h2>New jobs</h2>
							<p class="meta">Last 3 days</p>
						</div>
						{#if newJobs.length === 0}
							<p class="meta">No new jobs yet.</p>
						{:else}
							<div class="list">
								{#each newJobs as job (job.id)}
									<div class="card" data-hidden={isHidden(job)}>
										<div class="card__grid">
											<div class="card__content">
												<div class="card__top">
													<a class="title-link" href={jobPath(job)}>{job.title}</a>
												</div>
												<div class="card__meta">
													<a class="company-chip" href={companyPath(job)}>
														{#if getCompanyLogo(job)}
															<img
																class="company-chip__logo"
																src={getCompanyLogo(job)}
																alt={`${job.company} logo`}
																loading="lazy"
															/>
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
													{#if isPinned(job)}
														<span class="pill accent">Pinned</span>
													{/if}
													{#if isSubmitted(job)}
														<span class="pill success">Submitted</span>
													{/if}
													{#if getCompanyStatus(job) === 'whitelist'}
														<span class="pill success subtle">Preferred company</span>
													{:else if getCompanyStatus(job) === 'blacklist'}
														<span class="pill danger subtle">Blacklisted</span>
													{/if}
													{#if isJobHidden(job)}
														<span class="pill neutral subtle">Hidden</span>
													{/if}
												</div>
											</div>
											<div class="card__side">
												<div class="card__top-actions">
													<a
														class="direct-link"
														href={job.url ?? jobPath(job)}
														target={job.url ? '_blank' : undefined}
														rel={job.url ? 'noreferrer' : undefined}
													>
														{job.url ? 'Job link' : 'View details'}
													</a>
													<div class="date">{formatDate(job.date_posted)}</div>
												</div>
												<div class="card__action-rail" aria-label="Job and company actions">
													<button
														class="icon-button"
														class:selected={isPinned(job)}
														on:click={() => toggleJobFlag(job.id, 'pinned')}
														title={isPinned(job) ? 'Unpin' : 'Pin'}
														aria-label={isPinned(job) ? 'Unpin job' : 'Pin job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-3-7 3V4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isPinned(job) ? 'Unpin' : 'Pin'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={isSubmitted(job)}
														on:click={() => toggleJobFlag(job.id, 'submitted')}
														title={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														aria-label={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">
															{isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														</span>
													</button>
													<button
														class="icon-button ghost"
														on:click={() => toggleJobFlag(job.id, 'hidden')}
														title={isJobHidden(job) ? 'Unhide' : 'Hide'}
														aria-label={isJobHidden(job) ? 'Unhide job' : 'Hide job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 5c-4.8 0-8.8 3-10 7 1.2 4 5.2 7 10 7s8.8-3 10-7c-1.2-4-5.2-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isJobHidden(job) ? 'Unhide' : 'Hide'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={getCompanyStatus(job) === 'whitelist'}
														on:click={() => setCompanyStatusForJob(job, 'whitelist')}
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
													<button
														class="icon-button danger"
														class:selected={getCompanyStatus(job) === 'blacklist'}
														on:click={() => setCompanyStatusForJob(job, 'blacklist')}
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
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="section" id="recent-jobs">
						<div class="section__header">
							<h2>Recent jobs</h2>
							<p class="meta">Older than 3 days — scroll to load more</p>
						</div>
						{#if recentJobs.length === 0}
							{#if hasMore}
								<p class="meta">Scroll to load earlier jobs…</p>
							{:else}
								<p class="meta">No recent jobs yet.</p>
							{/if}
						{:else}
							<div class="list">
								{#each recentJobs as job (job.id)}
									<div class="card" data-hidden={isHidden(job)}>
										<div class="card__grid">
											<div class="card__content">
												<div class="card__top">
													<a class="title-link" href={jobPath(job)}>{job.title}</a>
												</div>
												<div class="card__meta">
													<a class="company-chip" href={companyPath(job)}>
														{#if getCompanyLogo(job)}
															<img
																class="company-chip__logo"
																src={getCompanyLogo(job)}
																alt={`${job.company} logo`}
																loading="lazy"
															/>
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
													{#if isPinned(job)}
														<span class="pill accent">Pinned</span>
													{/if}
													{#if isSubmitted(job)}
														<span class="pill success">Submitted</span>
													{/if}
													{#if getCompanyStatus(job) === 'whitelist'}
														<span class="pill success subtle">Preferred company</span>
													{:else if getCompanyStatus(job) === 'blacklist'}
														<span class="pill danger subtle">Blacklisted</span>
													{/if}
													{#if isJobHidden(job)}
														<span class="pill neutral subtle">Hidden</span>
													{/if}
												</div>
											</div>
											<div class="card__side">
												<div class="card__top-actions">
													<a
														class="direct-link"
														href={job.url ?? jobPath(job)}
														target={job.url ? '_blank' : undefined}
														rel={job.url ? 'noreferrer' : undefined}
													>
														{job.url ? 'Job link' : 'View details'}
													</a>
													<div class="date">{formatDate(job.date_posted)}</div>
												</div>
												<div class="card__action-rail" aria-label="Job and company actions">
													<button
														class="icon-button"
														class:selected={isPinned(job)}
														on:click={() => toggleJobFlag(job.id, 'pinned')}
														title={isPinned(job) ? 'Unpin' : 'Pin'}
														aria-label={isPinned(job) ? 'Unpin job' : 'Pin job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-7-3-7 3V4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isPinned(job) ? 'Unpin' : 'Pin'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={isSubmitted(job)}
														on:click={() => toggleJobFlag(job.id, 'submitted')}
														title={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														aria-label={isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">
															{isSubmitted(job) ? 'Undo submitted' : 'Mark submitted'}
														</span>
													</button>
													<button
														class="icon-button ghost"
														on:click={() => toggleJobFlag(job.id, 'hidden')}
														title={isJobHidden(job) ? 'Unhide' : 'Hide'}
														aria-label={isJobHidden(job) ? 'Unhide job' : 'Hide job'}
													>
														<svg viewBox="0 0 24 24" aria-hidden="true">
															<path
																d="M12 5c-4.8 0-8.8 3-10 7 1.2 4 5.2 7 10 7s8.8-3 10-7c-1.2-4-5.2-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
																fill="currentColor"
															/>
														</svg>
														<span class="sr-only">{isJobHidden(job) ? 'Unhide' : 'Hide'}</span>
													</button>
													<button
														class="icon-button"
														class:selected={getCompanyStatus(job) === 'whitelist'}
														on:click={() => setCompanyStatusForJob(job, 'whitelist')}
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
													<button
														class="icon-button danger"
														class:selected={getCompanyStatus(job) === 'blacklist'}
														on:click={() => setCompanyStatusForJob(job, 'blacklist')}
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
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						{#if loadingMore}
							<p class="meta">Loading more…</p>
						{/if}
						{#if !hasMore && (newJobs.length > 0 || recentJobs.length > 0)}
							<p class="meta">You reached the end.</p>
						{/if}
						<div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
					</div>
				{/if}
			{/if}
			</section>
		</div>
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
		padding: 16px 24px;
		border-bottom: 1px solid rgba(226, 232, 240, 0.08);
		position: sticky;
		top: 0;
		backdrop-filter: blur(10px);
		background: rgba(11, 18, 32, 0.8);
		z-index: 10;
	}

	.logo {
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.subtitle {
		color: #cbd5e1;
		font-size: 14px;
	}

	.content {
		max-width: 1100px;
		margin: 0 auto;
		padding: 32px 20px 48px;
	}

	.layout {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 16px;
		align-items: start;
	}

	.layout.nav-collapsed {
		grid-template-columns: 1fr;
	}

	.sidebar {
		position: sticky;
		top: 72px;
	}

	.sidebar nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
	}

	.nav-title {
		font-weight: 700;
		color: #cbd5e1;
		margin-bottom: 2px;
	}

	.sidebar a {
		color: #e2e8f0;
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 10px;
		transition: background 120ms ease, transform 120ms ease;
		border: 1px solid transparent;
	}

	.sidebar a:hover {
		background: rgba(37, 99, 235, 0.12);
		border-color: rgba(37, 99, 235, 0.28);
		transform: translateX(2px);
	}

	.inline-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
		padding: 10px 12px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
	}

	.inline-nav__links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.inline-nav a {
		color: #e2e8f0;
		text-decoration: none;
		padding: 6px 10px;
		border-radius: 10px;
		border: 1px solid rgba(226, 232, 240, 0.14);
		background: rgba(15, 23, 42, 0.5);
		transition: background 120ms ease, border-color 120ms ease;
	}

	.inline-nav a:hover {
		background: rgba(37, 99, 235, 0.12);
		border-color: rgba(37, 99, 235, 0.28);
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
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.user-control {
		margin: 12px 0 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.user-control__field {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.user-control input {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(226, 232, 240, 0.12);
		border-radius: 10px;
		padding: 8px 10px;
		color: #e2e8f0;
		min-width: 180px;
	}

	.user-control code {
		background: rgba(226, 232, 240, 0.08);
		padding: 4px 8px;
		border-radius: 6px;
	}

	.quick-open {
		margin: 10px 0 6px;
		padding: 12px 14px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.quick-open__controls {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.quick-open input {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(226, 232, 240, 0.12);
		border-radius: 10px;
		padding: 8px 10px;
		color: #e2e8f0;
		min-width: 220px;
		flex: 1;
	}

	h1 {
		margin: 0;
		font-size: 22px;
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.meta {
		color: #94a3b8;
		margin: 4px 0 0;
		font-size: 14px;
	}

	.meta.error {
		color: #f87171;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}

	.section {
		margin-top: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

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

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 10px;
	}

	.status-column {
		border: 1px solid rgba(226, 232, 240, 0.08);
		background: rgba(255, 255, 255, 0.02);
		border-radius: 12px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.status-column__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.status-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border: 1px solid rgba(226, 232, 240, 0.1);
		background: rgba(255, 255, 255, 0.02);
		border-radius: 10px;
		padding: 10px;
	}

	.status-row.danger {
		border-color: rgba(248, 113, 113, 0.4);
	}

	.status-row.success {
		border-color: rgba(16, 185, 129, 0.35);
	}

	.status-row__info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.status-row__name {
		font-weight: 700;
	}

	.status-row__logo,
	.status-row__avatar {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		object-fit: cover;
		display: grid;
		place-items: center;
		background: rgba(226, 232, 240, 0.06);
		color: #cbd5e1;
		font-weight: 700;
	}

	.status-row__actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.status-summary {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
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
		.layout {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}

		.panel__header {
			flex-direction: column;
			align-items: flex-start;
		}

		.card__top {
			flex-direction: column;
			align-items: flex-start;
		}

		.content {
			padding: 20px 16px 32px;
		}
	}

	.sentinel {
		height: 1px;
	}
</style>

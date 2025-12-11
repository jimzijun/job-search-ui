import { browser } from '$app/environment';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_APP_ID,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID
} from '$env/static/public';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY,
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: PUBLIC_FIREBASE_PROJECT_ID,
	appId: PUBLIC_FIREBASE_APP_ID
};

const getApp = () => {
	if (app) return app;
	if (!browser) return null;
	app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
	return app;
};

export const getDb = () => {
	if (db) return db;
	const instance = getApp();
	if (!instance) return null;
	db = getFirestore(instance);
	return db;
};

export const getAuthClient = () => {
	if (auth) return auth;
	const instance = getApp();
	if (!instance) return null;
	auth = getAuth(instance);
	return auth;
};

export const onAuthChange = (handler: (user: User | null) => void) => {
	const client = getAuthClient();
	if (!client) return () => {};
	return onAuthStateChanged(client, handler);
};

export const signInWithGoogle = async () => {
	const client = getAuthClient();
	if (!client) return null;
	const provider = new GoogleAuthProvider();
	const result = await signInWithPopup(client, provider);
	return result.user;
};

export const signOutUser = async () => {
	const client = getAuthClient();
	if (!client) return;
	await signOut(client);
};

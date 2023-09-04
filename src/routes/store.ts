import { writable } from 'svelte/store';

export const storedLoginpubkey = writable('');
export const storedUseRelaysNIP07 = writable(false);
export const storedRelaysToUse = writable({});

import { writable } from 'svelte/store';

export const storedLoginpubkey = writable('');
export const storedUseRelaysNIP07 = writable(false);
export const storedRelaysToUse = writable({});
export const storedMuteList = writable([]);
export const storedFavList = writable([]);
export const storedFavedList = writable([]);

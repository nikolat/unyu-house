import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type EventTemplate,
	type Filter,
	type Sub,
} from 'nostr-tools';
import { defaultRelays, relaysToGetRelays } from './config';
import type { NostrAPI } from './@types/nostr';
import { goto } from '$app/navigation';

interface Window {
	nostr?: NostrAPI;
}
declare const window: Window & typeof globalThis

export interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	event: NostrEvent
	post_count: number
	fav_count: number
}

export interface Profile {
	name: string
	display_name?: string
	about: string
	picture: string
	website?: string
	created_at: number
	tags: string[][]
}

export interface GetRelays {
	read: boolean
	write: boolean
}

export const urlDarkTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css';
export const urlLightTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/light.css';
export const urlDefaultTheme = urlDarkTheme;

export class RelayConnector {

	#pool: SimplePool;
	#relays: string[];
	#loginPubkey: string;
	#filterKind42: Filter<42>;
	#callbackPhase1: Function;
	#callbackPhase2: Function;
	#callbackPhase3: Function;

	constructor(pool: SimplePool, relays: string[], loginPubkey: string, filterKind42: Filter<42>, callbackPhase1: Function, callbackPhase2: Function, callbackPhase3: Function) {
		this.#pool = pool;
		this.#relays = relays;
		this.#loginPubkey = loginPubkey;
		this.#filterKind42 = filterKind42;
		this.#callbackPhase1 = callbackPhase1;
		this.#callbackPhase2 = callbackPhase2;
		this.#callbackPhase3 = callbackPhase3;
	}

	getEventsPhase1 = () => {
		const limit = 300;
		const filterPhase1: Filter<7|40|41|42|10000|10001|10005>[] = [{kinds: [7], '#k': ['42'], limit: limit}, {kinds: [40, 41], limit: limit}, this.#filterKind42];
		if (this.#loginPubkey) {
			filterPhase1.push({kinds: [10000, 10001, 10005], authors: [this.#loginPubkey]});
		}
		const sub: Sub<7|40|41|42|10000|10001|10005> = this.#pool.sub(this.#relays, filterPhase1);
		const events: {[key: number]: NostrEvent<7|40|41|42|10000|10001|10005>[]} = {7: [], 40: [], 41: [], 42: [], 10000: [], 10001: [], 10005: []};
		sub.on('event', (ev: NostrEvent<7|40|41|42|10000|10001|10005>) => {
			events[ev.kind].push(ev);
		});
		sub.on('eose', () => {
			console.log('getEventsPhase1 * EOSE *');
			sub.unsub();
			const channels = this.#getChannels(events[7], events[40], events[41], events[42]);
			const notes = this.#getNotes(events[42]);
			const event10000 = events[10000].length === 0 ? null : events[10000].reduce((a, b) => a.created_at > b.created_at ? a : b);
			const pinList = this.#getPinList(events[10005].length > 0 ? events[10005] : events[10001], channels);
			this.#callbackPhase1(this.#loginPubkey, channels, notes, event10000, pinList);
			const pubkeysToGet: string[] = this.#getPubkeysForFilter(Object.values(events).flat());
			const idsToGet: string[] = this.#getIdsForFilter(events[42]);
			const filterPhase2: Filter[] = [];
			if (pubkeysToGet.length > 0) {
				filterPhase2.push({kinds: [0], authors: pubkeysToGet});
			}
			if (idsToGet.length > 0) {
				filterPhase2.push({ids: idsToGet});
			}
			const filterPhase3Base: Filter<42> = this.#filterKind42;
			filterPhase3Base.since = events[42].map(ev => ev.created_at).reduce((a, b) => Math.max(a, b), 0) + 1;
			filterPhase3Base.limit = 1;
			const filterPhase3: Filter<0|7|40|41|42|10000|10001|10005>[] = [filterPhase3Base];
			if (this.#loginPubkey) {
				filterPhase2.push(
					{kinds: [7], authors: [this.#loginPubkey], '#e': notes.map(v => v.id)},
					{kinds: [7], '#p': [this.#loginPubkey], '#e': notes.map(v => v.id)}
				);
				filterPhase3.push(
					{kinds: [0, 7, 10000, 10001, 10005], authors: [this.#loginPubkey], limit: 1},
					{kinds: [7], '#p': [this.#loginPubkey], limit: 1},
					{kinds: [40, 41], limit: 1}
				);
			}
			this.#getEventsPhase2(filterPhase2, filterPhase3, true);
		});
	};

	#getEventsPhase2 = (filterPhase2: Filter[], filterPhase3: Filter<0|7|40|41|42|10000|10001|10005>[], goPhase3: Boolean) => {
		const sub: Sub = this.#pool.sub(this.#relays, filterPhase2);
		const events: {[key: number]: NostrEvent[]} = {0: [], 7: []};
		const eventsQuoted: NostrEvent[] = [];
		const eventsAll: NostrEvent[] = [];
		sub.on('event', (ev: NostrEvent) => {
			if ([0, 7].includes(ev.kind)) {
				events[ev.kind].push(ev);
			}
			else {
				eventsQuoted.push(ev);
			}
			eventsAll.push(ev);
		});
		sub.on('eose', () => {
			if (goPhase3) {
				console.log('getEventsPhase2 * EOSE *');
			}
			else {
				console.log('getEventsPhase2-2 * EOSE *');
			}
			sub.unsub();
			const profs = this.#getFrofiles(events[0]);
			this.#callbackPhase2(profs, events[7], eventsQuoted);
			if (goPhase3) {
				const pubkeysObtained = Object.keys(profs);
				if (eventsAll.length > 0) {
					const pubkeysToGet: string[] = this.#getPubkeysForFilter(eventsAll).filter(v => !pubkeysObtained.includes(v));
					if (pubkeysToGet.length > 0) {
						const filterPhase2: Filter<0>[] = [{kinds: [0], authors: pubkeysToGet}];
						this.#getEventsPhase2(filterPhase2, [], false);
					}
				}
				this.#getEventsPhase3(filterPhase3, pubkeysObtained, eventsQuoted.map(v => v.id));
			}
		});
	};

	#getEventsPhase3 = (filterPhase3: Filter<0|7|40|41|42|10000|10001|10005>[], pubkeysObtained: string[], idsObtained: string[]) => {
		const sub: Sub<0|7|40|41|42|10000|10001|10005> = this.#pool.sub(this.#relays, filterPhase3);
		sub.on('event', (ev: NostrEvent<0|7|40|41|42|10000|10001|10005>) => {
			this.#callbackPhase3(sub, ev);
			const pubkeysToGet: string[] = this.#getPubkeysForFilter([ev]).filter(v => !pubkeysObtained.includes(v));
			const idsToGet: string[] = this.#getIdsForFilter([ev]).filter(v => !idsObtained.includes(v));
			if (pubkeysToGet.length > 0 || idsToGet.length > 0) {
				const filterPhase2: Filter[] = [];
				if (pubkeysToGet.length > 0) {
					pubkeysObtained = pubkeysObtained.concat(pubkeysToGet);
					filterPhase2.push({kinds: [0], authors: pubkeysToGet});
				}
				if (idsToGet.length > 0) {
					idsObtained = idsObtained.concat(idsToGet);
					filterPhase2.push({ids: idsToGet});
				}
				this.#getEventsPhase2(filterPhase2, [], false);
			}
		});
		sub.on('eose', () => {
			//これは永続的に走らせておく
			console.log('getEventsPhase3 * EOSE *');
		});
	};

	#getPubkeysForFilter = (events: NostrEvent[]): string[] => {
		const pubkeys: Set<string> = new Set();
		for(const ev of events.filter(ev => [7, 40].includes(ev.kind))) {
			pubkeys.add(ev.pubkey);
		}
		for(const ev of events.filter(ev => ev.kind === 0)) {
			//npubでの言及
			let content;
			try {
				content = JSON.parse(ev.content);
			} catch (error) {
				console.warn(error);
				console.info(ev);
				continue;
			}
			if (!content.about)
				continue;
			const matchesIteratorNpub = (content.about as string).matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIteratorNpub) {
				let d;
				try {
					d = nip19.decode(match[1]);
				} catch (error) {
					console.warn(error);
					console.info(ev);
					continue;
				}
				if (d.type === 'npub') {
					pubkeys.add(d.data);
				}
			}
		}
		for(const ev of events.filter(ev => [1, 42].includes(ev.kind))) {
			pubkeys.add(ev.pubkey);
			//pタグ送信先
			for (const pubkey of ev.tags.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1])) {
				pubkeys.add(pubkey);
			}
			//npubでの言及
			const matchesIteratorNpub = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIteratorNpub) {
				let d;
				try {
					d = nip19.decode(match[1]);
				} catch (error) {
					console.warn(error);
					console.info(ev);
					continue;
				}
				if (d.type === 'npub')
					pubkeys.add(d.data);
			}
		}
		return Array.from(pubkeys);
	};

	#getIdsForFilter = (events: NostrEvent[]): string[] => {
		const ids: Set<string> = new Set();
		for (const ev of events) {
			const matchesIterator = ev.content.matchAll(/nostr:(note\w{59}|nevent\w+)/g);
			for (const match of matchesIterator) {
				let d;
				try {
					d = nip19.decode(match[1]);
				} catch (error) {
					console.warn(error);
					console.info(ev);
					continue;
				}
				if (d.type === 'note')
					ids.add(d.data);
				else if (d.type === 'nevent')
					ids.add(d.data.id);
			}
		}
		return Array.from(ids);
	};

	#getChannels = (events7: NostrEvent[], events40: NostrEvent[], events41: NostrEvent[], events42: NostrEvent[]): Channel[] => {
		const channelObjects: {[key: string]: Channel} = {};
		for (const ev of events40) {
			let json: any;
			try {
				json = JSON.parse(ev.content);
			} catch (error) {
				console.warn(error);
				continue;
			}
			if (['name'].some(metadata => !Object.hasOwn(json, metadata))) {
				continue;
			}
			channelObjects[ev.id] = json;
			channelObjects[ev.id].updated_at = ev.created_at;
			channelObjects[ev.id].event = ev;
			channelObjects[ev.id].post_count = 0;
			channelObjects[ev.id].fav_count = 0;
		}
		for (const ev of events41) {
			for (const tag of ev.tags) {
				const id = tag[1];
				if (tag[0] === 'e' && id in channelObjects && ev.pubkey === channelObjects[id].event.pubkey && channelObjects[id].updated_at < ev.created_at) {
					const savedEvent = channelObjects[id].event;
					let json: any;
					try {
						json = JSON.parse(ev.content);
					} catch (error) {
						console.warn(error);
						continue;
					}
					if (['name'].some(metadata => !Object.hasOwn(json, metadata))) {
						continue;
					}
					channelObjects[id] = json;
					channelObjects[id].updated_at = ev.created_at;
					channelObjects[id].event = savedEvent;
					channelObjects[id].post_count = 0;
					channelObjects[id].fav_count = 0;
				}
			}
		}
		for (const ev of events42) {
			const rootid = ev.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1);
			if (rootid === undefined) {
				continue;
			}
			if (rootid in channelObjects) {
				channelObjects[rootid].post_count++;
			}
		}
		for (const ev of events7) {
			const rootid = ev.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root')?.at(1);
			if (rootid === undefined) {
				continue;
			}
			if (rootid in channelObjects) {
				channelObjects[rootid].fav_count++;
			}
		}
		const channels: Channel[] = this.#getSortedChannels(channelObjects);
		return channels;
	};

	// 降順にソートされたチャンネル情報の配列を返す
	#getSortedChannels = (channelObjects: {[key: string]: Channel}) => {
		const channelArray: Channel[] = Object.values(channelObjects);
		channelArray.sort((a, b) => {
			if (a.updated_at < b.updated_at) {
				return 1;
			}
			if (a.updated_at > b.updated_at) {
				return -1;
			}
			return 0;
		});
		return channelArray;
	};

	#getNotes = (events42: NostrEvent[]): NostrEvent[] => {
		events42.sort((a, b) => {
			if (a.created_at < b.created_at) {
				return -1;
			}
			if (a.created_at > b.created_at) {
				return 1;
			}
			return 0;
		});
		return events42;
	};

	#getPinList = (events10005: NostrEvent[], channels: Channel[]): string[] => {
		if (events10005.length === 0)
			return [];
		const pinList = events10005.reduce((a, b) => a.created_at > b.created_at ? a : b).tags.filter(tag => tag.length >= 2 && tag[0] === 'e').map(tag => tag[1]);
		console.info(`Pinned Channels: kind ${events10005[0].kind} received`);
		if (events10005[0].kind === 10001 && channels.some(ch => pinList.includes(ch.event.id)) ) {
			if (confirm('チャンネルのピン留めの移行が必要です！\nnostterにログインしてください。')) {
				goto('https://nostter.app/');
			}
		}
		return pinList;
	};

	#getFrofiles = (events: NostrEvent[]): {[key: string]: Profile} => {
		const profs: {[key: string]: Profile} = {};
		for (const ev of events.filter(ev => ev.kind === 0)) {
			if ((profs[ev.pubkey] && profs[ev.pubkey].created_at < ev.created_at) || !profs[ev.pubkey]) {
				try {
					profs[ev.pubkey] = JSON.parse(ev.content);
				} catch (error) {
					console.warn(error);
					continue;
				}
				profs[ev.pubkey].created_at = ev.created_at;
				profs[ev.pubkey].tags = ev.tags;
			}
		}
		return profs;
	};
};

export const sendMessage = async(pool: SimplePool, relaysToWrite: string[], content: string, targetEventToReply: NostrEvent) => {
	const seenOn = pool.seenOn(targetEventToReply.id);
	if (seenOn.length === 0) {
		throw new Error(`The event to reply is not found: ${targetEventToReply.id}`);
	}
	const recommendeRelay = seenOn[0];
	const tags: string[][] = [];
	const mentionPubkeys: Set<string> = new Set();
	const rootTag = targetEventToReply.tags.find(tag => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root');
	if (rootTag !== undefined) {
		tags.push(rootTag);
		tags.push(['e', targetEventToReply.id, recommendeRelay, 'reply']);
		mentionPubkeys.add(targetEventToReply.pubkey);
	}
	else {
		tags.push(['e', targetEventToReply.id, recommendeRelay, 'root']);
	}
	for (const pubkeyToReply of targetEventToReply.tags.filter(tag => tag.length >= 2 && tag[0] === 'p').map(tag => tag[1])) {
		mentionPubkeys.add(pubkeyToReply);
	}
	const mentionIds: Set<string> = new Set();
	const matchesIteratorId = content.matchAll(/(^|\W|\b)(nostr:(note\w{59}|nevent\w+))($|\W|\b)/g);
	for (const match of matchesIteratorId) {
		let d;
		try {
			d = nip19.decode(match[3]);
		} catch (error) {
			console.warn(error);
			console.info(content);
			continue;
		}
		if (d.type === 'note') {
			mentionIds.add(d.data);
		}
		else if (d.type === 'nevent') {
			mentionIds.add(d.data.id);
		}
	}
	const matchesIteratorPubkey = content.matchAll(/(^|\W|\b)(nostr:(npub\w{59}))($|\W|\b)/g);
	for (const match of matchesIteratorPubkey) {
		let d;
		try {
			d = nip19.decode(match[3]);
		} catch (error) {
			console.warn(error);
			console.info(content);
			continue;
		}
		if (d.type === 'npub') {
			mentionPubkeys.add(d.data);
		}
	}
	const matchesIteratorHashTag = content.matchAll(/(^|\s|\b)#(\S+)/g);
	const hashtags: Set<string> = new Set();
	for (const match of matchesIteratorHashTag) {
		hashtags.add(match[2]);
	}
	for (const id of mentionIds) {
		tags.push(['e', id, '', 'mention']);
	}
	for (const p of mentionPubkeys) {
		tags.push(['p', p, '']);
	}
	for (const t of hashtags) {
		tags.push(['t', t]);
	}
	const baseEvent: EventTemplate<42> = {
		kind: 42,
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: content
	};
	if (window.nostr === undefined)
		return;
	const newEvent = await window.nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

export const sendFav = async(pool: SimplePool, relaysToWrite: string[], targetEvent: NostrEvent, content: string) => {
	const tags: string[][] = targetEvent.tags.filter(tag => tag.length >= 2 && (tag[0] === 'e' || (tag[0] === 'p' && tag[1] !== targetEvent.pubkey)));
	tags.push(['e', targetEvent.id, '', '']);
	tags.push(['p', targetEvent.pubkey, '']);
	tags.push(['k', String(targetEvent.kind)]);
	const baseEvent: EventTemplate<7> = {
		kind: 7,
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: content
	};
	if (window.nostr === undefined)
		return;
	const newEvent = await window.nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

export const sendCreateChannel = async(pool: SimplePool, relaysToWrite: string[], name: string, about: string, picture: string) => {
	const baseEvent: EventTemplate<40> = {
		kind: 40,
		created_at: Math.floor(Date.now() / 1000),
		tags: [],
		content: JSON.stringify({name: name ?? '', about: about ?? '', picture: picture ?? ''})
	};
	if (window.nostr === undefined)
		return;
	const newEvent = await window.nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

export const sendEditChannel = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, currentChannelId: string, name: string, about: string, picture: string) => {
	const limit = 500;
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const sub: Sub<40|41> = pool.sub(relaysToRead, [{kinds: [40], ids: [currentChannelId], limit: limit}, {kinds: [41], authors: [loginPubkey], '#e': [currentChannelId], limit: limit}]);
	let newestEvent: NostrEvent<40|41>;
	sub.on('event', (ev: NostrEvent<40|41>) => {
		if (ev.pubkey === loginPubkey && (!newestEvent || newestEvent.created_at < ev.created_at)) {
			newestEvent = ev;
		}
	});
	sub.on('eose', async () => {
		console.log('sendEditChannelPhase1 * EOSE *');
		sub.unsub();
		if (!newestEvent) {
			throw new Error(`The event to edit does not exist: ${currentChannelId}`);
		}
		const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
		const objContent: object = JSON.parse(newestEvent.content);
		(objContent as any).name = name;
		(objContent as any).about = about;
		(objContent as any).picture = picture;
		const baseEvent: EventTemplate<41> = {
			kind: 41,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['e', currentChannelId, pool.seenOn(currentChannelId).at(0) ?? '']],
			content: JSON.stringify(objContent)
		};
		if (window.nostr === undefined)
			return;
		const newEvent = await window.nostr.signEvent(baseEvent);
		const pubs = pool.publish(relaysToWrite, newEvent);
		await Promise.all(pubs);
		console.log('sendEditChannelPhase2 * Complete *');
	});
};

export const sendEditProfile = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, prof: Profile) => {
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const sub: Sub<0> = pool.sub(relaysToRead, [{kinds: [0], authors: [loginPubkey]}]);
	let newestEvent: NostrEvent<0>;
	sub.on('event', (ev: NostrEvent<0>) => {
		if (ev.pubkey === loginPubkey && (!newestEvent || newestEvent.created_at < ev.created_at)) {
			newestEvent = ev;
		}
	});
	sub.on('eose', async () => {
		console.log('sendEditProfilePhase1 * EOSE *');
		sub.unsub();
		const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
		let objContent: object;
		if (newestEvent !== undefined) {
			objContent = JSON.parse(newestEvent.content);
		}
		else {
			objContent = {};
		}
		(objContent as any).name = prof.name;
		(objContent as any).about = prof.about;
		(objContent as any).picture = prof.picture;
		(objContent as any).display_name = prof.display_name;
		(objContent as any).website = prof.website;
		const baseEvent: EventTemplate<0> = {
			kind: 0,
			created_at: Math.floor(Date.now() / 1000),
			tags: newestEvent?.tags ?? [],
			content: JSON.stringify(objContent),
		};
		if (window.nostr === undefined)
			return;
		const newEvent = await window.nostr.signEvent(baseEvent);
		const pubs = pool.publish(relaysToWrite, newEvent);
		await Promise.all(pubs);
		console.log('sendEditProfilePhase2 * Complete *');
	});
};

export const sendDeletion = async(pool: SimplePool, relaysToWrite: string[], eventId: string) => {
	const baseEvent: EventTemplate<5> = {
		kind: 5,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['e', eventId]],
		content: ''
	};
	if (window.nostr === undefined)
		return;
	const newEvent = await window.nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

export const sendMuteUser = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, pubkey: string, toSet: boolean) => {
	await sendPinOrMute(pool, relaysToUse, loginPubkey, pubkey, toSet, 10000, 'p');
};

export const sendMute = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, eventId: string, toSet: boolean) => {
	await sendPinOrMute(pool, relaysToUse, loginPubkey, eventId, toSet, 10000, 'e');
};

export const sendPin = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, eventId: string, toSet: boolean) => {
	await sendPinOrMute(pool, relaysToUse, loginPubkey, eventId, toSet, 10005, 'e');
};

const sendPinOrMute = async(pool: SimplePool, relaysToUse: object, loginPubkey: string, eventId: string, toSet: boolean, kind: number, tagName: string) => {
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const sub: Sub = pool.sub(relaysToRead, [{kinds: [kind], authors: [loginPubkey]}]);
	let newestEvent: NostrEvent;
	sub.on('event', (ev: NostrEvent) => {
		if (ev.pubkey === loginPubkey && (!newestEvent || newestEvent.created_at < ev.created_at)) {
			newestEvent = ev;
		}
	});
	sub.on('eose', async () => {
		console.log('sendPinOrMutePhase1 * EOSE *');
		sub.unsub();
		if (window.nostr === undefined)
			return;
		let tags;
		let content = '';
		if (newestEvent) {
			tags = newestEvent.tags;
			const publicList = newestEvent.tags.filter(tag => tag.length >= 2 && tag[0] === tagName).map(tag => tag[1]);
			let list: string[][] = [];
			if (newestEvent.content !== '') {
				try {
					const content = await window.nostr.nip04.decrypt(loginPubkey, newestEvent.content);
					list = JSON.parse(content);
				} catch (error) {
					console.warn(error);
					return;
				}
			}
			const privateList = list.filter(tag => tag.length >= 2 && tag[0] === tagName).map(tag => tag[1]);
			const includes: boolean = [...publicList, ...privateList].includes(eventId);
			if ((includes && toSet) || (!includes && !toSet)) {
				throw new Error(`The event does not have to update: ${newestEvent.id}`);
			}
			if (toSet) {
				tags = [...tags, [tagName, eventId]];
				content = newestEvent.content;
			}
			else {
				if (publicList.includes(eventId)) {
					tags = tags.filter(tag => !(tag.length >= 2 && tag[0] === tagName && tag[1] === eventId));
					content = newestEvent.content;
				}
				else {
					content = await window.nostr.nip04.encrypt(loginPubkey, JSON.stringify(list.filter(tag => !(tag.length >= 2 && tag[0] === tagName && tag[1] === eventId))));
				}
			}
		}
		else {
			if (toSet) {
				tags = [[tagName, eventId]];
			}
			else {
				throw new Error(`The kind ${kind} event to remove the pin does not exist: ${eventId}`);
			}
		}
		const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
		const baseEvent: EventTemplate = {
			kind: kind,
			created_at: Math.floor(Date.now() / 1000),
			tags: tags,
			content: content
		};
		const newEvent = await window.nostr.signEvent(baseEvent);
		const pubs = pool.publish(relaysToWrite, newEvent);
		await Promise.all(pubs);
		console.log('sendPinOrMutePhase2 * Complete *');
	});
};

export const getExpandTagsList = (content: string, tags: string[][]): [IterableIterator<RegExpMatchArray>, string[], {[key: string]: string}] => {
	const regMatchArray = ['https?://[\\w!?/=+\\-_~:;.,*&@#$%()[\\]]+', 'nostr:npub\\w{59}', 'nostr:note\\w{59}', 'nostr:nevent\\w+', '#\\S+'];
	const emojiUrls: {[key: string]: string} = {};
	const emojiRegs = [];
	for (const tag of tags) {
		emojiRegs.push(':' + tag[1] + ':');
		emojiUrls[':' + tag[1] + ':'] = tag[2];
	}
	if (emojiRegs.length > 0) {
		regMatchArray.push(emojiRegs.join('|'));
	}
	const regMatch = new RegExp(regMatchArray.map(v => '(' + v + ')').join('|'), 'g');
	const regSplit = new RegExp(regMatchArray.join('|'));
	const plainTexts = content.split(regSplit);
	const matchesIterator = content.matchAll(regMatch);
	return [matchesIterator, plainTexts, emojiUrls];
};

export const getRelaysToUse = (relaysSelected: string, pool: SimplePool, loginPubkey: string): Promise<{[key: string]: GetRelays}> => {
	switch (relaysSelected) {
		case 'kind3':
			return new Promise((resolve) => {
				getGeneralEvents(pool, relaysToGetRelays, [{kinds: [3], authors: [loginPubkey]}]).then((events: NostrEvent[]) => {
					if (events.length === 0) {
						resolve({});
					}
					else {
						const ev: NostrEvent = events.reduce((a: NostrEvent, b: NostrEvent) => a.created_at > b.created_at ? a : b)
						resolve(ev.content.length > 0 ? JSON.parse(ev.content) : {});
					}
				});
			});
		case 'kind10002':
			return new Promise((resolve) => {
				getGeneralEvents(pool, relaysToGetRelays, [{kinds: [10002], authors: [loginPubkey]}]).then((events: NostrEvent[]) => {
					if (events.length === 0) {
						resolve({});
					}
					else {
						const ev: NostrEvent = events.reduce((a: NostrEvent, b: NostrEvent) => a.created_at > b.created_at ? a : b)
						const newRelays: {[key: string]: GetRelays} = {};
						for (const tag of ev.tags.filter(tag => tag.length >= 2 && tag[0] === 'r')) {
							newRelays[tag[1]] = {'read': tag.length === 2 || tag[2] === 'read', 'write': tag.length === 2 || tag[2] === 'write'};
						}
						resolve(newRelays);
					}
				});
			});
		case 'nip07':
			if (window.nostr === undefined || window.nostr.getRelays === undefined)
				return Promise.resolve({});
			return window.nostr.getRelays();
		case 'default':
		default:
			return Promise.resolve(defaultRelays);
	}
};

const getGeneralEvents = (pool: SimplePool, relays: string[], filters: Filter[]): Promise<NostrEvent[]> => {
	return new Promise((resolve) => {
		const sub: Sub = pool.sub(relays, filters);
		const events: NostrEvent[] = [];
		sub.on('event', (ev: NostrEvent) => {
			events.push(ev);
		});
		sub.on('eose', () => {
			console.log('getGeneralEvents * EOSE *');
			sub.unsub();
			resolve(events);
		});
	});
};

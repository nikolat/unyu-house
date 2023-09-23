import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Filter,
	type Sub,
} from 'nostr-tools';

export interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	id: string
	pubkey: string
	recommendedRelay: string
}

export interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
	created_at: number
}

export const urlDarkTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css';
export const urlLightTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/light.css';
export const urlDefaultTheme = urlDarkTheme;

export const getEventsPhase1 = async(pool: SimplePool, relays: string[], filterKind42: Filter<42>, callbackPhase1: Function, callbackPhase2: Function, callbackPhase3: Function, loginPubkey: string) => {
	const limit = 500;
	const filterPhase1: Filter<40|41|42|10000>[] = [{kinds: [40, 41], limit: limit}, filterKind42];
	if (loginPubkey) {
		filterPhase1.push({kinds: [10000], authors: [loginPubkey]});
	}
	const sub: Sub<40|41|42|10000> = pool.sub(relays, filterPhase1);
	const events: {[key: number]: NostrEvent<40|41|42|10000>[]} = {40: [], 41: [], 42: [], 10000: []};
	sub.on('event', (ev: NostrEvent<40|41|42|10000>) => {
		events[ev.kind].push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsPhase1 * EOSE *');
		sub.unsub();
		const channels = getChannels(pool, events[40], events[41]);
		const notes = getNotes(events[42]);
		const muteList = getMuteList(events[10000]);
		callbackPhase1(channels, notes, muteList);
		const pubkeysToGet: string[] = getPubkeysForFilter(Object.values(events).reduce((a, b) => a.concat(b), []));
		const idsToGet: string[] = getIdsForFilter(events[42]);
		const filterPhase2: Filter[] = [];
		if (pubkeysToGet.length > 0) {
			filterPhase2.push({kinds: [0], authors: pubkeysToGet});
		}
		if (idsToGet.length > 0) {
			filterPhase2.push({ids: idsToGet});
		}
		const filterPhase3Base: Filter<42> = filterKind42;
		filterPhase3Base.since = events[42].map(ev => ev.created_at).reduce((a, b) => Math.max(a, b), 0) + 1;
		filterPhase3Base.limit = 1;
		const filterPhase3: Filter<7|40|41|42>[] = [filterPhase3Base];
		if (loginPubkey) {
			filterPhase2.push(
				{kinds: [7], authors: [loginPubkey], '#e': notes.map(v => v.id)},
				{kinds: [7], '#p': [loginPubkey], '#e': notes.map(v => v.id)}
			);
			filterPhase3.push(
				{kinds: [7], authors: [loginPubkey], limit: 1},
				{kinds: [7], '#p': [loginPubkey], limit: 1},
				{kinds: [40, 41], limit: 1}
			);
		}
		getEventsPhase2(pool, relays, filterPhase2, filterPhase3, callbackPhase2, callbackPhase3, true);
	});
};

export const getEventsPhase2 = async(pool: SimplePool, relays: string[], filterPhase2: Filter[], filterPhase3: Filter<7|40|41|42>[], callbackPhase2: Function, callbackPhase3: Function, goPhase3: Boolean) => {
	const sub: Sub = pool.sub(relays, filterPhase2);
	const events: {[key: number]: NostrEvent[]} = {0: [], 7: []};
	const eventsQuoted: NostrEvent[] = [];
	sub.on('event', (ev: NostrEvent) => {
		if ([0, 7].includes(ev.kind)) {
			events[ev.kind].push(ev);
		}
		else {
			eventsQuoted.push(ev);
		}
	});
	sub.on('eose', () => {
		console.log('getEventsPhase2 * EOSE *');
		sub.unsub();
		const profs = getFrofiles(events[0]);
		callbackPhase2(profs, events[7], eventsQuoted);
		if (eventsQuoted.length > 0) {
			const filterPhase2: Filter<0>[] = [{kinds: [0], authors: getPubkeysForFilter(eventsQuoted)}];
			getEventsPhase2(pool, relays, filterPhase2, [], callbackPhase2, ()=>{}, false);
		}
		if (goPhase3) {
			getEventsPhase3(pool, relays, filterPhase3, profs, eventsQuoted, callbackPhase2, callbackPhase3);
		}
	});
};

export const getEventsPhase3 = async(pool: SimplePool, relays: string[], filterPhase3: Filter<7|40|41|42>[], profs: {[key: string]: Profile}, eventsQuoted: NostrEvent[], callbackPhase2:Function, callbackPhase3: Function) => {
	const sub: Sub<7|40|41|42> = pool.sub(relays, filterPhase3);
	sub.on('event', (ev: NostrEvent<7|40|41|42>) => {
		callbackPhase3(sub, ev);
		const pubkeysToGet: string[] = getPubkeysForFilter([ev]).filter(v => !(v in profs));
		const idsToGet: string[] = getIdsForFilter([ev]).filter(v => !(v in eventsQuoted.map(v => v.id)));
		if (pubkeysToGet.length > 0 || idsToGet.length > 0) {
			const filterPhase2: Filter[] = [];
			if (pubkeysToGet.length > 0) {
				filterPhase2.push({kinds: [0], authors: pubkeysToGet});
			}
			if (idsToGet.length > 0) {
				filterPhase2.push({ids: idsToGet});
			}
			getEventsPhase2(pool, relays, filterPhase2, filterPhase3, callbackPhase2, callbackPhase3, false);
		}
	});
	sub.on('eose', () => {
		//これは永続的に走らせておく
		console.log('getEventsPhase3 * EOSE *');
	});
};

const getPubkeysForFilter = (events: NostrEvent[]): string[] => {
	const pubkeys: Set<string> = new Set();
	for(const ev of events.filter(v => [0, 40].concat(v.kind))) {
		pubkeys.add(ev.pubkey);
	}
	for(const ev of events.filter(v => [1, 42].concat(v.kind))) {
		pubkeys.add(ev.pubkey);
		//pタグ送信先
		for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
			pubkeys.add(pubkey);
		}
		//npubでの言及
		const matchesIteratorNpub = ev.content.matchAll(/nostr:(npub\w{59})/g);
		for (const match of matchesIteratorNpub) {
			const d = nip19.decode(match[1]);
			if (d.type === 'npub')
				pubkeys.add(d.data);
		}
	}
	return Array.from(pubkeys);
};

const getIdsForFilter = (events: NostrEvent[]): string[] => {
	const ids: Set<string> = new Set();
	for (const ev of events) {
		const matchesIterator = ev.content.matchAll(/nostr:(note\w{59}|nevent\w+)/g);
		for (const match of matchesIterator) {
			const d = nip19.decode(match[1]);
			if (d.type === 'note')
				ids.add(d.data);
			else if (d.type === 'nevent')
				ids.add(d.data.id);
		}
	}
	return Array.from(ids);
};

const getChannels = (pool: SimplePool, events40: NostrEvent[], events41: NostrEvent[]): Channel[] => {
	const channelObjects: {[key: string]: Channel} = {};
	for (const ev of events40) {
		try {
			channelObjects[ev.id] = JSON.parse(ev.content);
		} catch (error) {
			console.log(error);
			continue;
		}
		channelObjects[ev.id].updated_at = ev.created_at;
		channelObjects[ev.id].id = ev.id;
		channelObjects[ev.id].pubkey = ev.pubkey;
		channelObjects[ev.id].recommendedRelay = pool.seenOn(ev.id)[0];
	}
	for (const ev of events41) {
		for (const tag of ev.tags) {
			const id = tag[1];
			if (tag[0] === 'e' && id in channelObjects && ev.pubkey === channelObjects[id].pubkey && channelObjects[id].updated_at < ev.created_at) {
				const savedRecommendedRelay = channelObjects[id].recommendedRelay;
				try {
					channelObjects[id] = JSON.parse(ev.content);
				} catch (error) {
					console.log(error);
					continue;
				}
				channelObjects[id].updated_at = ev.created_at;
				channelObjects[id].id = id;
				channelObjects[id].pubkey = ev.pubkey;
				channelObjects[id].recommendedRelay = savedRecommendedRelay;
			}
		}
	}
	const channels: Channel[] = getSortedChannels(channelObjects);
	return channels;
};

const getNotes = (events42: NostrEvent[]): NostrEvent[] => {
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

const getMuteList = (events10000: NostrEvent[]): string[] => {
	let muteList: string[] = [];
	let muteList_created_at = 0;
	for (const ev of events10000) {
		if (muteList_created_at < ev.created_at) {
			muteList = ev.tags.filter(v => v[0] === 'p').map(v => v[1]);
			muteList_created_at = ev.created_at;
		}
	}
	return muteList;
}

const getFrofiles = (events: NostrEvent[]): {[key: string]: Profile} => {
	const profs: {[key: string]: Profile} = {};
	for (const ev of events.filter(ev => ev.kind === 0)) {
		if ((profs[ev.pubkey] && profs[ev.pubkey].created_at < ev.created_at) || !profs[ev.pubkey]) {
			try {
				profs[ev.pubkey] = JSON.parse(ev.content);
			} catch (error) {
				console.log(error);
				continue;
			}
			profs[ev.pubkey].created_at = ev.created_at;
		}
	}
	return profs;
}

const getFrofilesAndNotesQuoted = (events: NostrEvent[]): [{[key: string]: Profile}, NostrEvent[]] => {
	const profs: {[key: string]: Profile} = {};
	for (const ev of events.filter(ev => ev.kind === 0)) {
		if ((profs[ev.pubkey] && profs[ev.pubkey].created_at < ev.created_at) || !profs[ev.pubkey]) {
			try {
				profs[ev.pubkey] = JSON.parse(ev.content);
			} catch (error) {
				console.log(error);
				continue;
			}
			profs[ev.pubkey].created_at = ev.created_at;
		}
	}
	const notesQuoted: NostrEvent[] = events.filter(ev => ev.kind !== 0);
	return [profs, notesQuoted];
};

// 降順にソートされたチャンネル情報の配列を返す
const getSortedChannels = (channelObjects: {[key: string]: Channel}) => {
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

export const getEventsForLoginPhase1 = async(pool: SimplePool, relays: string[], pubkey: string, idsFavSearch: string[], callbackForLoginPhase1: Function, callbackForLoginPhase2: Function) => {
	const sub: Sub<7|10000> = pool.sub(relays, [{kinds: [10000], authors: [pubkey]}, {kinds: [7], authors: [pubkey], '#e': idsFavSearch}, {kinds: [7], '#e': idsFavSearch, '#p': [pubkey]}]);
	const events: NostrEvent<7|10000>[] = [];
	sub.on('event', (ev: NostrEvent<7|10000>) => {
		events.push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsForLoginPhase1 * EOSE *');
		sub.unsub();
		const [muteList, favList, favedList, profileListToGet] = getMuteListAndFavs(events, pubkey);
		callbackForLoginPhase1(muteList, favList, favedList);
		const filterPhase2: Filter<0>[] = [{kinds: [0], authors: profileListToGet}];
		getEventsForLoginPhase2(pool, relays, filterPhase2, callbackForLoginPhase2);
	});
};

const getEventsForLoginPhase2 = async(pool: SimplePool, relays: string[], filterPhase2: Filter[], callbackForLoginPhase2: Function) => {
	const sub = pool.sub(relays, filterPhase2);
	const events: NostrEvent[] = [];
	sub.on('event', (ev: NostrEvent) => {
		events.push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsForLoginPhase2 * EOSE *');
		sub.unsub();
		const [profs, notesQuoted] = getFrofilesAndNotesQuoted(events);
		callbackForLoginPhase2(profs);
	});
};

const getMuteListAndFavs = (events: NostrEvent<7|10000>[], pubkey: string): [string[], string[], NostrEvent[], string[]] => {
	const favList: string[] = [];
	const favedList: NostrEvent[] = [];
	const profileListToGet = new Set<string>();
	let muteList: string[] = [];
	let muteList_created_at = 0;
	for (const ev of events) {
		switch (ev.kind) {
			case 10000:
				if (muteList_created_at < ev.created_at) {
					muteList = ev.tags.filter(v => v[0] === 'p').map(v => v[1]);
					muteList_created_at = ev.created_at;
				}
				break;
			case 7:
				if (ev.pubkey === pubkey) {
					favList.push(ev.tags.filter(v => v[0] === 'e')[0][1]);
					profileListToGet.add(ev.tags.filter(v => v[0] === 'p')[0][1]);
				}
				if (ev.tags.some(v => v[0] === 'p' && v[1] === pubkey)) {
					favedList.push(ev);
					profileListToGet.add(ev.pubkey);
				}
				break;
			default:
				break;
		}
	}
	return [muteList, favList, favedList, Array.from(profileListToGet)];
};

export const sendMessage = async(pool: SimplePool, relaysToWrite: string[], content: string, currentChannelId: string, recommendedRelay: string, replyId: string, pubkeysToReply: string[]) => {
	const tags = [['e', currentChannelId, recommendedRelay, 'root']];
	if (replyId) {
		tags.push(['e', replyId, '', 'reply']);
	}
	const mentionIds: Set<string> = new Set();
	const matchesIteratorId = content.matchAll(/(^|\W|\b)(nostr:(note\w{59}|nevent\w+))($|\W|\b)/g);
	for (const match of matchesIteratorId) {
		const d = nip19.decode(match[3]);
		if (d.type === 'note') {
			mentionIds.add(d.data);
		}
		else if (d.type === 'nevent') {
			mentionIds.add(d.data.id);
		}
	}
	for (const id of mentionIds) {
		tags.push(['e', id, '', 'mention']);
	}
	const mentionPubkeys: Set<string> = new Set();
	const matchesIteratorPubkey = content.matchAll(/(^|\W|\b)(nostr:(npub\w{59}))($|\W|\b)/g);
	for (const match of matchesIteratorPubkey) {
		const d = nip19.decode(match[3]);
		if (d.type === 'npub') {
			mentionPubkeys.add(d.data);
		}
	}
	for (const pubkeyToReply of pubkeysToReply) {
		mentionPubkeys.add(pubkeyToReply);
	}
	for (const p of mentionPubkeys) {
		tags.push(['p', p, '']);
	}
	const baseEvent: UnsignedEvent<42> = {
		kind: 42,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: content
	};
	const newEvent: NostrEvent<42> = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
}

export const sendFav = async(pool: SimplePool, relaysToWrite: string[], noteid: string, targetPubkey: string) => {
	const tags = [['p', targetPubkey, ''], ['e', noteid, '', '']];
	const baseEvent: UnsignedEvent<7> = {
		kind: 7,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: '+'
	};
	const newEvent: NostrEvent<7> = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
}

export const sendCreateChannel = async(pool: SimplePool, relaysToWrite: string[], name: string, about: string, picture: string) => {
	const baseEvent: UnsignedEvent<40> = {
		kind: 40,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: [],
		content: JSON.stringify({name: name ?? '', about: about ?? '', picture: picture ?? ''})
	};
	const newEvent: NostrEvent<40> = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

export const sendEditChannel = async(pool: SimplePool, relaysToUse: object, currentChannelId: string, name: string, about: string, picture: string) => {
	const limit = 500;
	const relaysToRead = Object.entries(relaysToUse).filter(v => v[1].read).map(v => v[0]);
	const sub: Sub<40|41> = pool.sub(relaysToRead, [{kinds: [40], ids: [currentChannelId], limit: limit}, {kinds: [41], '#e': [currentChannelId], limit: limit}]);
	let newestEvent: NostrEvent<40|41>;
	sub.on('event', (ev: NostrEvent<40|41>) => {
		if (!newestEvent || newestEvent.created_at < ev.created_at) {
			newestEvent = ev;
		}
	});
	sub.on('eose', async () => {
		console.log('sendEditChannelPhase1 * EOSE *');
		sub.unsub();
		if (!newestEvent) {
			return;
		}
		const relaysToWrite = Object.entries(relaysToUse).filter(v => v[1].write).map(v => v[0]);
		const objContent: object = JSON.parse(newestEvent.content);
		(objContent as any).name = name ?? '';
		(objContent as any).about = about ?? '';
		(objContent as any).picture = picture ?? '';
		const baseEvent: UnsignedEvent<41> = {
			kind: 41,
			pubkey: '',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['e', currentChannelId, pool.seenOn(currentChannelId)[0] ?? '']],
			content: JSON.stringify(objContent)
		};
		const newEvent: NostrEvent<41> = await (window as any).nostr.signEvent(baseEvent);
		const pubs = pool.publish(relaysToWrite, newEvent);
		await Promise.all(pubs);
		console.log('sendEditChannelPhase2 * Complete *');
	});
};

export const sendDeletion = async(pool: SimplePool, relaysToWrite: string[], eventId: string) => {
	const baseEvent: UnsignedEvent<5> = {
		kind: 5,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: [['e', eventId]],
		content: ''
	};
	const newEvent: NostrEvent<5> = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

//for debug
export const sendProfile = async(pool: SimplePool, relaysToWrite: string[], objProfile: object) => {
	const baseEvent: UnsignedEvent<0> = {
		kind: 0,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: [],
		content: JSON.stringify(objProfile)
	};
	const newEvent: NostrEvent<0> = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
};

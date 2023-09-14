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

export const title = 'うにゅうハウス';
export const urlDarkTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css';
export const urlLightTheme = 'https://cdn.jsdelivr.net/npm/water.css@2/out/light.css';
export const urlDefaultTheme = urlDarkTheme;
export const defaultRelays = {
	'wss://relay-jp.nostr.wirednet.jp': {'read': true, 'write': true},
	'wss://yabu.me': {'read': true, 'write': true},
}

export const getEventsPhase1 = async(pool: SimplePool, relays: string[], filterKind42: Filter<42>, callbackPhase1: Function, callbackPhase2: Function, callbackPhase3: Function, loginPubkey: string) => {
	const limit = 500;
	const sub: Sub<40|41|42> = pool.sub(relays, [{kinds: [40, 41], limit: limit}, filterKind42]);
	const events: NostrEvent<40|41|42>[] = [];
	sub.on('event', (ev: NostrEvent<40|41|42>) => {
		events.push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsPhase1 * EOSE *');
		sub.unsub();
		const [channels, notes] = getChannelsAndNotes(pool, events);
		callbackPhase1(channels, notes);
		const filterPhase2: Filter[] = [{kinds: [0], authors: getPubkeysForFilter(events)}, {ids: getIdsForFilter(events)}];
		const filterPhase3_1: Filter<42> = filterKind42;
		filterPhase3_1.since = events.filter(ev => ev.kind === 42).map(ev => ev.created_at).reduce((a, b) => Math.max(a, b), 0) + 1;
		filterPhase3_1.limit = 1;
		const filterPhase3: Filter<7|42>[] = [filterPhase3_1];
		if (loginPubkey) {
			const filterPhase3_2: Filter<7> = {kinds: [7], '#p': [loginPubkey], limit: 1};
			const filterPhase3_3: Filter<7> = {kinds: [7], authors: [loginPubkey], limit: 1};
			filterPhase3.push(filterPhase3_2);
			filterPhase3.push(filterPhase3_3);
		}
		getEventsPhase2(pool, relays, filterPhase2, filterPhase3, callbackPhase2, callbackPhase3, true);
	});
};

export const getEventsPhase2 = async(pool: SimplePool, relays: string[], filterPhase2: Filter[], filterPhase3: Filter<7|42>[], callbackPhase2: Function, callbackPhase3: Function, goPhase3: Boolean) => {
	const sub: Sub = pool.sub(relays, filterPhase2);
	const events: NostrEvent[] = [];
	sub.on('event', (ev: NostrEvent) => {
		events.push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsPhase2 * EOSE *');
		sub.unsub();
		const [profs, notesQuoted] = getFrofilesAndNotesQuoted(events);
		callbackPhase2(profs, notesQuoted);
		if (notesQuoted.length > 0) {
			const filterPhase2: Filter[] = [{kinds: [0], authors: getPubkeysForFilter(notesQuoted)}];
			getEventsPhase2(pool, relays, filterPhase2, [], callbackPhase2, ()=>{}, false);
		}
		if (goPhase3) {
			getEventsPhase3(pool, relays, filterPhase3, profs, notesQuoted, callbackPhase2, callbackPhase3);
		}
	});
};

export const getEventsPhase3 = async(pool: SimplePool, relays: string[], filterPhase3: Filter<7|42>[], profs: {[key: string]: Profile}, notesQuoted: NostrEvent[], callbackPhase2:Function, callbackPhase3: Function) => {
	const sub: Sub<7|42> = pool.sub(relays, filterPhase3);
	sub.on('event', (ev: NostrEvent<7|42>) => {
		callbackPhase3(sub, ev);
		const pubkeysToGet: string[] = getPubkeysForFilter([ev]).filter(v => !(v in profs));
		const idsToGet: string[] = getIdsForFilter([ev]).filter(v => !(v in notesQuoted.map(v => v.id)));
		if (pubkeysToGet.length > 0 || idsToGet.length > 0) {
			const filterPhase2: Filter[] = [{kinds: [0], authors: pubkeysToGet}, {ids: idsToGet}];
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
	for (const ev of events) {
		switch (ev.kind) {
			case 40:
				pubkeys.add(ev.pubkey);
				break;
			case 41:
				//40さえあればいい
				break;
			case 1:
			case 42:
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
				break;
			default:
				break;
		}
	}
	return Array.from(pubkeys);
};

const getIdsForFilter = (events: NostrEvent<7|40|41|42>[]): string[] => {
	const ids: Set<string> = new Set();
	for (const ev of events.filter(ev => ev.kind === 42)) {
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

const getChannelsAndNotes = (pool: SimplePool, events: NostrEvent<40|41|42>[]): [Channel[], NostrEvent[]] => {
	const channelObjects: {[key: string]: Channel} = {};
	for (const ev of events.filter(ev => ev.kind === 40)) {
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
	for (const ev of events.filter(ev => ev.kind === 41)) {
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
	const notes: NostrEvent[] = events.filter(ev => ev.kind === 42);
	notes.sort((a, b) => {
		if (a.created_at < b.created_at) {
			return -1;
		}
		if (a.created_at > b.created_at) {
			return 1;
		}
		return 0;
	});
	return [channels, notes];
};

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

export const sendMessage = async(pool: SimplePool, relaysToWrite: string[], content: string, currentChannelId: string, recommendedRelay: string) => {
	const tags = [['e', currentChannelId, recommendedRelay, 'root']];
	const matchesIteratorPubkey = content.matchAll(/(^|\W|\b)(nostr:(npub\w{59}))($|\W|\b)/g);
	const mentionPubkeys: Set<string> = new Set();
	for (const match of matchesIteratorPubkey) {
		const d = nip19.decode(match[3]);
		if (d.type === 'npub') {
			mentionPubkeys.add(d.data);
		}
	}
	for (const p of mentionPubkeys) {
		tags.push(['p', p, '']);
	}
	const matchesIteratorId = content.matchAll(/(^|\W|\b)(nostr:(note\w{59}|nevent\w+))($|\W|\b)/g);
	const mentionIds: Set<string> = new Set();
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

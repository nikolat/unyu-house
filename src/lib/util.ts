import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Sub,
	type Filter,
} from 'nostr-tools';
import { storedLoginpubkey } from './store';

interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	id: string
	pubkey: string
	recommendedRelay: string
}

interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
	created_at: number
}

export const getEventsPhase1 = async(pool: SimplePool, relays: string[], filterKind42: Filter<42>, callbackPhase1: Function, callbackPhase2: Function, callbackPhase3: Function) => {
	const limit = 500;
	const sub = pool.sub(relays, [{kinds: [40, 41], limit: limit}, filterKind42]);
	const events: NostrEvent[] = [];
	sub.on('event', (ev: NostrEvent) => {
		events.push(ev);
	});
	sub.on('eose', () => {
		console.log('getEventsPhase1 * EOSE *');
		sub.unsub();
		const [channels, notes] = getChannelsAndNotes(pool, events);
		callbackPhase1(channels, notes);
		const filterPhase2 = [{kinds: [0], authors: getPubkeysForFilter(events)}, {ids: getIdsForFilter(events)}];
		const filterPhase3 = filterKind42;
		filterPhase3.since = events.filter(ev => ev.kind === 42).map(ev => ev.created_at).reduce((a, b) => Math.max(a, b), 0) + 1;
		getEventsPhase2(pool, relays, filterPhase2, filterPhase3, callbackPhase2, callbackPhase3, true);
	});
};

export const getEventsPhase2 = async(pool: SimplePool, relays: string[], filterPhase2: Filter[], filterPhase3: Filter<42>, callbackPhase2: Function, callbackPhase3: Function, goPhase3: Boolean) => {
	const sub = pool.sub(relays, filterPhase2);
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
			const filterPhase2 = [{kinds: [0], authors: getPubkeysForFilter(notesQuoted)}];
			getEventsPhase2(pool, relays, filterPhase2, {}, callbackPhase2, ()=>{}, false);
		}
		if (goPhase3) {
			getEventsPhase3(pool, relays, filterPhase3, profs, notesQuoted, callbackPhase2, callbackPhase3);
		}
	});
};

export const getEventsPhase3 = async(pool: SimplePool, relays: string[], filterPhase3: Filter<42>, profs: {[key: string]: Profile}, notesQuoted: NostrEvent[], callbackPhase2:Function, callbackPhase3: Function) => {
	const sub = pool.sub(relays, [filterPhase3]);
	sub.on('event', (ev: NostrEvent) => {
		callbackPhase3(ev);
		const pubkeysToGet = getPubkeysForFilter([ev]).filter(v => !(v in profs));
		const idsToGet = getIdsForFilter([ev]).filter(v => !(v in notesQuoted.map(v => v.id)));
		if (pubkeysToGet.length > 0 || idsToGet.length > 0) {
			const filterPhase2 = [{kinds: [0], authors: pubkeysToGet}, {ids: idsToGet}];
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

const getIdsForFilter = (events: NostrEvent[]): string[] => {
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

const getChannelsAndNotes = (pool: SimplePool, events: NostrEvent[]): [Channel[], NostrEvent[]] => {
	const channelObjects: {[key: string]: Channel} = {};
	for (const ev of events.filter(ev => ev.kind === 40)) {
		channelObjects[ev.id] = JSON.parse(ev.content);
		channelObjects[ev.id].updated_at = ev.created_at;
		channelObjects[ev.id].id = ev.id;
		channelObjects[ev.id].pubkey = ev.pubkey;
		channelObjects[ev.id].recommendedRelay = pool.seenOn(ev.id)[0];
	}
	for (const ev of events.filter(ev => ev.kind === 41)) {
		for (const tag of ev.tags) {
			const id = tag[1];
			if (tag[0] === 'e' && id in Object.keys(channelObjects) && ev.pubkey === channelObjects[id].pubkey && channelObjects[id].updated_at < ev.created_at) {
				const savedRecommendedRelay = channelObjects[id].recommendedRelay;
				channelObjects[id] = JSON.parse(ev.content);
				channelObjects[id].updated_at = ev.created_at;
				channelObjects[id].id = id;
				channelObjects[id].pubkey = ev.pubkey;
				channelObjects[id].recommendedRelay = savedRecommendedRelay;
			}
		}
	}
	const channels = getSortedChannels(channelObjects);
	const notes = events.filter(ev => ev.kind === 42);
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
			profs[ev.pubkey] = JSON.parse(ev.content);
			profs[ev.pubkey].created_at = ev.created_at;
		}
	}
	const notesQuoted = events.filter(ev => ev.kind !== 0);
	return [profs, notesQuoted];
};



















// kind:40を取得する
export const getChannels = async (pool: SimplePool, channelEvents: NostrEvent[], relays: string[], metadataEvents: NostrEvent[], channels: Channel[], profs: {[key: string]: Profile}, callbackChannels: Function, callbackProfile: Function) => {
	const channelObjects: {[key: string]: Channel} = {};
	const pubkeys: Set<string> = new Set();
	const sub = pool.sub(relays, [{kinds: [40]}]);
	sub.on('event', (ev: NostrEvent) => {
		channelEvents.push(ev);
		channelObjects[ev.id] = JSON.parse(ev.content);
		channelObjects[ev.id].updated_at = ev.created_at;
		channelObjects[ev.id].id = ev.id;
		channelObjects[ev.id].pubkey = ev.pubkey;
		channelObjects[ev.id].recommendedRelay = pool.seenOn(ev.id)[0];
		pubkeys.add(ev.pubkey);
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getChannels * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// kind:41を取得する
		getMetadata(pool, relays, metadataEvents, channels, channelEvents, channelObjects, callbackChannels);
		// チャンネル作成者のプロフィールを取得しに行く
		getProfile(pool, relays, Array.from(pubkeys), profs, callbackProfile);
	});
};

// kind:41を取得する
const getMetadata = async (pool: SimplePool, relays: string[], metadataEvents: NostrEvent[], channels: Channel[], channelEvents: NostrEvent[], channelObjects: {[key: string]: Channel}, callbackChannels: Function) => {
	const sub = pool.sub(relays, [{kinds: [41]}]);
	sub.on('event', (ev: NostrEvent) => {
		metadataEvents.push(ev);
//		console.log(ev);
	});
	sub.on('eose', async () => {
		console.log('getMetadata * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 更新すべきkind:41を適用する
		await updateChannels(metadataEvents, channelEvents, channelObjects);
		// 表示を反映させる
		channels = getSortedChannels(channelObjects);
		callbackChannels(channels);
	});
};

// 更新すべきkind:41を適用する
const updateChannels = async(metadataEvents: NostrEvent[], channelEvents: NostrEvent[], channelObjects: {[key: string]: Channel}) => {
	metadataEvents.forEach(m => {
		channelEvents.forEach(c => {
			if (m.pubkey === c.pubkey) {
				m.tags.forEach(tag => {
					if ((tag[0] === 'e') && (tag[1] === c.id) && (channelObjects[c.id].updated_at < m.created_at)) {
//						console.log('kind:41 replace', channelObjects[c.id], JSON.parse(m.content));
						const savedRecommendedRelay = channelObjects[c.id].recommendedRelay;
						channelObjects[c.id] = JSON.parse(m.content);
						channelObjects[c.id].updated_at = m.created_at;
						channelObjects[c.id].id = c.id;
						channelObjects[c.id].pubkey = c.pubkey;
						channelObjects[c.id].recommendedRelay = savedRecommendedRelay;
					}
				});
			}
		})
	});
};

// 降順にソートされたチャンネル情報の配列を返す
export const getSortedChannels = (channelObjects: {[key: string]: Channel}) => {
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

// kind:42を取得する
export const getNotes = async (pool: SimplePool, relays: string[], subNotes: Sub<42>, filter: Filter<42>[], notes: NostrEvent[], profs: {[key: string]: Profile}, callbackNotes: Function, callbackProfile: Function, callbackNotesQuoted: Function) => {
	subNotes = pool.sub(relays, filter);
	const pubkeys: Set<string> = new Set();
	const eventkeys: Set<string> = new Set();
	let getEOSE = false;
	const update = () => {
		// 時系列順にソートする
		notes.sort((a, b) => {
			if (a.created_at < b.created_at) {
				return -1;
			}
			if (a.created_at > b.created_at) {
				return 1;
			}
			return 0;
		});
		// 表示を反映させる
		callbackNotes(notes);
	};
	subNotes.on('event', (ev: NostrEvent) => {
		notes.push(ev);
		if (getEOSE) {
			update();
			//プロフィールを取得
			const pubkeysToGet: Set<string> = new Set();
			pubkeysToGet.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeysToGet.add(pubkey);
			}
			const matchesIteratorNpub = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIteratorNpub) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeysToGet.add(d.data);
			}
			const pubkeysToGetArray = Array.from(pubkeysToGet).filter(v => !(v in profs))
			if (pubkeysToGetArray.length > 0) {
				getProfile(pool, relays, Array.from(pubkeysToGetArray), profs, callbackProfile);
			}
			//引用を取得
			const eventkeysToGet: Set<string> = new Set();
			const matchesIteratorNevent = ev.content.matchAll(/nostr:(note\w{59}|nevent\w+)/g);
			for (const match of matchesIteratorNevent) {
				const d = nip19.decode(match[1]);
				if (d.type === 'note')
					eventkeysToGet.add(d.data);
				else if (d.type === 'nevent')
					eventkeysToGet.add(d.data.id);
			}
			const eventkeysToGetArray = Array.from(eventkeysToGet);//暫定
			if (eventkeysToGetArray.length > 0) {
				getNotesQuoted(pool, relays, Array.from(eventkeysToGetArray), callbackNotesQuoted);
			}
		}
		else {
			pubkeys.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeys.add(pubkey);
			}
			const matchesIteratorNpub = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIteratorNpub) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeys.add(d.data);
			}
			const matchesIteratorNevent = ev.content.matchAll(/nostr:(note\w{59}|nevent\w+)/g);
			for (const match of matchesIteratorNevent) {
				const d = nip19.decode(match[1]);
				if (d.type === 'note')
					eventkeys.add(d.data);
				else if (d.type === 'nevent')
					eventkeys.add(d.data.id);
			}
		}
//		console.log(ev);
	});
	subNotes.on('eose', () => {
		console.log('getNotes * EOSE *');
		getEOSE = true;
		update();
		// 投稿の取得が終わったらプロフィールと引用を取得しに行く
		getProfile(pool, relays, Array.from(pubkeys), profs, callbackProfile);
		getNotesQuoted(pool, relays, Array.from(eventkeys), callbackNotesQuoted);
	});
};

// プロフィールを取得する
export const getProfile = async (pool: SimplePool, relays: string[], pubkeys: string[], profs: {[key: string]: Profile}, callbackProfile: Function) => {
	const sub = pool.sub(relays, [{kinds: [0], authors: pubkeys}]);
	sub.on('event', (ev: NostrEvent) => {
		if ((profs[ev.pubkey] && profs[ev.pubkey].created_at < ev.created_at) || !profs[ev.pubkey]) {
			profs[ev.pubkey] = JSON.parse(ev.content);
			profs[ev.pubkey].created_at = ev.created_at;
		}
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getProfile * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackProfile(profs);
	});
};

const getNotesQuoted = async (pool: SimplePool, relays: string[], ids: string[], callbackNotesQuoted: Function) => {
	const notes: NostrEvent[] = [];
	const sub = pool.sub(relays, [{ids: ids}]);
	sub.on('event', (ev: NostrEvent) => {
		notes.push(ev);
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getProfile * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackNotesQuoted(notes);
	});
};

// ミュートリストを取得する
export const getMuteList = async (pool: SimplePool, relays: string[], pubkey: string, callbackMuteList: Function) => {
	let muteList: string[];
	let created_at = 0;
	const sub = pool.sub(relays, [{kinds: [10000], authors: [pubkey]}]);
	sub.on('event', (ev: NostrEvent) => {
		if (created_at < ev.created_at) {
			muteList = ev.tags.filter(v => v[0] === 'p').map(v => v[1]);
			created_at = ev.created_at;
		}
	});
	sub.on('eose', () => {
		console.log('getMuteList * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackMuteList(muteList);
	});
};

// ふぁぼを取得する
export const getFavList = async (pool: SimplePool, relays: string[], pubkey: string, ids: string[], callbackFav: Function) => {
	const favEvents: NostrEvent[] = [];
	const sub = pool.sub(relays, [{kinds: [7], authors: [pubkey], '#e': ids}]);
	sub.on('event', (ev: NostrEvent) => {
		favEvents.push(ev);
	});
	sub.on('eose', () => {
		console.log('getFavList * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		const favList = new Set<string>(favEvents.map(ev => ev.tags.filter(tag => tag[0] === 'e')[0][1]));
		callbackFav(Array.from(favList));
	});
};

// ふぁぼられを取得する
export const getFavedList = async (pool: SimplePool, relays: string[], pubkey: string, ids: string[], callbackFavedList: Function, callbackProfile: Function) => {
	const profs: {[key: string]: Profile} = {};
	const favedEvents: NostrEvent[] = [];
	const sub = pool.sub(relays, [{kinds: [7], '#e': ids, '#p': [pubkey]}]);
	sub.on('event', (ev: NostrEvent) => {
		favedEvents.push(ev);
	});
	sub.on('eose', () => {
		console.log('getFavedList * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackFavedList(favedEvents);
		// 投稿の取得が終わったらプロフィールと引用を取得しに行く
		const favedPubkeys = new Set<string>(favedEvents.map(v => v.pubkey));
		getProfile(pool, relays, Array.from(favedPubkeys), profs, callbackProfile);
	});
};

let loginPubkey: string;
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});

export const sendFav = async(pool: SimplePool, relaysToWrite: string[], noteid: string, targetPubkey: string) => {
	const savedloginPubkey = loginPubkey;
	storedLoginpubkey.set('');
	const tags = [['p', targetPubkey, ''], ['e', noteid, '', '']];
	const baseEvent: UnsignedEvent = {
		kind: 7,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: '+'
	};
	const newEvent: NostrEvent = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
	storedLoginpubkey.set(savedloginPubkey);
}

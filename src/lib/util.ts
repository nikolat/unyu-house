import type { Filter } from 'nostr-tools/filter';
import type { EventTemplate, NostrEvent } from 'nostr-tools/pure';
import type { RelayRecord } from 'nostr-tools/relay';
import type { WindowNostr } from 'nostr-tools/nip07';
import { binarySearch, normalizeURL } from 'nostr-tools/utils';
import * as nip05 from 'nostr-tools/nip05';
import * as nip19 from 'nostr-tools/nip19';
import { defaultRelays, relaysToGetRelays } from './config';
import {
  createRxBackwardReq,
  createRxForwardReq,
  type RxNostr,
  type EventPacket,
} from 'rx-nostr';
import type { OperatorFunction } from 'rxjs';

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

export interface Channel {
  name: string;
  about: string;
  picture: string;
  updated_at: number;
  event: NostrEvent;
  event41?: NostrEvent;
  post_count: number;
  fav_count: number;
}

export interface Profile {
  name: string;
  display_name?: string;
  about: string;
  picture: string;
  website?: string;
  created_at: number;
  tags: string[][];
}

export const urlDarkTheme =
  'https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css';
export const urlLightTheme =
  'https://cdn.jsdelivr.net/npm/water.css@2/out/light.css';
export const urlDefaultTheme = urlDarkTheme;

export class RelayConnector {
  #rxNostr: RxNostr;
  #tie: OperatorFunction<
    EventPacket,
    EventPacket & {
      seenOn: Set<string>;
      isNew: boolean;
    }
  >;
  #relays: string[];
  #loginPubkey: string;
  #filterBase: Filter[];
  #until: number;
  #since: number;
  #callbackPhase3: Function;
  #callbackEvent: (event: NostrEvent) => void;
  #execScroll: Function;

  constructor(
    rxNostr: RxNostr,
    tie: OperatorFunction<
      EventPacket,
      EventPacket & { seenOn: Set<string>; isNew: boolean }
    >,
    relays: string[],
    loginPubkey: string,
    filterBase: Filter[],
    until: number,
    callbackPhase3: Function,
    callbackEvent: (event: NostrEvent) => void,
    execScroll: Function,
  ) {
    this.#rxNostr = rxNostr;
    this.#tie = tie;
    this.#relays = relays;
    this.#loginPubkey = loginPubkey;
    this.#filterBase = filterBase;
    this.#until = until;
    this.#since = until + 1;
    this.#callbackPhase3 = callbackPhase3;
    this.#callbackEvent = callbackEvent;
    this.#execScroll = execScroll;
  }

  getEventsPhase1 = async () => {
    const limit_channel = 300;
    const zap_sender_pubkeys = [
      'be1d89794bf92de5dd64c1e60f6a2c70c140abac9932418fee30c5c637fe9479', //WoS
      '79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432', //Alby
    ];
    const events: { [key: number]: NostrEvent[] } = {
      0: [],
      3: [],
      7: [],
      16: [],
      40: [],
      41: [],
      42: [],
      9735: [],
      10000: [],
      10005: [],
      10030: [],
      30007: [],
    };
    let filterPhase1: Filter[] = this.#filterBase;
    if (this.#loginPubkey) {
      filterPhase1.unshift({
        kinds: [3, 10000, 10005, 10030, 30007],
        authors: [this.#loginPubkey],
        until: this.#until,
      });
    }
    //0
    const promises = [];
    promises.push(
      getGeneralEvents(
        this.#rxNostr,
        this.#tie,
        this.#relays,
        filterPhase1,
        this.#callbackEvent,
      ).then((evs: NostrEvent[]) => {
        for (const ev of evs) {
          events[ev.kind].push(ev);
        }
      }),
    );
    await Promise.all(promises);
    filterPhase1 = [];
    const channelsToGet: string[] = events[42]
      .map(
        (ev) =>
          ev.tags
            .find(
              (tag) => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root',
            )
            ?.at(1) ?? '',
      )
      .filter((e) => e !== '');
    filterPhase1.push({ kinds: [40], ids: channelsToGet, until: this.#until });
    filterPhase1.push({ kinds: [41], '#e': channelsToGet, until: this.#until });
    let pubkeysToGet: string[] = this.#getPubkeysForFilter(
      Object.values(events).flat(),
    );
    if (pubkeysToGet.length > 0) {
      filterPhase1.push({
        kinds: [0],
        authors: pubkeysToGet,
        until: this.#until,
      });
    }
    //1
    promises.length = 0;
    promises.push(
      getGeneralEvents(
        this.#rxNostr,
        this.#tie,
        this.#relays,
        filterPhase1,
        this.#callbackEvent,
      ).then((evs: NostrEvent[]) => {
        for (const ev of evs) {
          events[ev.kind].push(ev);
        }
      }),
    );
    await Promise.all(promises);
    this.#execScroll();
    filterPhase1 = [];
    const pinList = this.#getPinList(events[10005]);
    const idsToGet: string[] = [
      ...this.#getIdsForFilter([...events[16], ...events[42]]).filter(
        (v) => !events[42].map((ev) => ev.id).includes(v),
      ),
      ...pinList,
    ];
    if (idsToGet.length > 0) {
      filterPhase1.push({ ids: idsToGet, until: this.#until });
    }
    filterPhase1.push({
      kinds: [7],
      until: this.#until,
      '#e': events[42].map((ev) => ev.id),
    });
    filterPhase1.push({
      kinds: [9735],
      authors: zap_sender_pubkeys,
      until: this.#until,
      '#e': events[42].map((ev) => ev.id),
    });
    filterPhase1.push({
      kinds: [40],
      until: this.#until,
      limit: limit_channel,
    });
    filterPhase1.push({
      kinds: [41],
      until: this.#until,
      limit: limit_channel,
    });
    //2
    promises.length = 0;
    promises.push(
      getGeneralEvents(
        this.#rxNostr,
        this.#tie,
        this.#relays,
        filterPhase1,
        this.#callbackEvent,
      ).then((evs: NostrEvent[]) => {
        for (const ev of evs) {
          if (events[ev.kind] === undefined) {
            events[ev.kind] = [];
          }
          events[ev.kind].push(ev);
        }
      }),
    );
    await Promise.all(promises);
    console.log('getEventsPhase1 * EOSE *');
    const filterPhase2: Filter[] = [];
    pubkeysToGet = this.#getPubkeysForFilter(
      Object.values(events).flat(),
    ).filter((pubkey) => !events[0].map((ev) => ev.pubkey).includes(pubkey));
    if (pubkeysToGet.length > 0) {
      filterPhase2.push({
        kinds: [0],
        authors: pubkeysToGet,
        until: this.#until,
      });
    }
    if (events[10030].length > 0) {
      const atags = events[10030]
        .reduce((a, b) => (a.created_at > b.created_at ? a : b))
        .tags.filter((tag) => tag.length >= 2 && tag[0] === 'a')
        .map((tag) => tag[1]);
      for (const atag of atags) {
        const ary = atag.split(':');
        filterPhase2.push({
          kinds: [parseInt(ary[0])],
          authors: [ary[1]],
          '#d': [ary[2]],
          until: this.#until,
        });
      }
    }
    const filterPhase3Base: Filter[] = [];
    for (const f of this.#filterBase) {
      if (f.kinds?.some((kind) => [0, 40, 41].includes(kind))) {
        continue;
      }
      delete f.until;
      f.since = this.#since;
      filterPhase3Base.push(f);
    }
    const filterPhase3: Filter[] = [
      ...filterPhase3Base,
      { kinds: [7], '#k': ['42'], since: this.#since },
      { kinds: [40, 41], since: this.#since },
    ];
    if (this.#loginPubkey) {
      filterPhase3.push(
        {
          kinds: [0, 10000, 10005],
          authors: [this.#loginPubkey],
          since: this.#since,
        },
        { kinds: [9735], authors: zap_sender_pubkeys, since: this.#since },
      );
    }
    this.#getEventsPhase2(filterPhase2, filterPhase3, true);
  };

  #getEventsPhase2 = async (
    filterPhase2: Filter[],
    filterPhase3: Filter[],
    goPhase3: Boolean,
  ) => {
    const events: { [key: number]: NostrEvent[] } = {
      0: [],
      42: [],
      30030: [],
    };
    const eventsQuoted: NostrEvent[] = [];
    const eventsAll: NostrEvent[] = [];
    const promises = [];
    promises.push(
      getGeneralEvents(
        this.#rxNostr,
        this.#tie,
        this.#relays,
        filterPhase2,
        this.#callbackEvent,
      ).then((evs: NostrEvent[]) => {
        for (const ev of evs) {
          if ([0, 42, 30030].includes(ev.kind)) {
            events[ev.kind].push(ev);
          } else {
            eventsQuoted.push(ev);
          }
          eventsAll.push(ev);
        }
      }),
    );
    await Promise.all(promises);
    if (goPhase3) {
      console.log('getEventsPhase2 * EOSE *');
    } else {
      console.log('getEventsPhase2-2 * EOSE *');
    }
    const profs = this.#getProfiles(events[0]);
    if (goPhase3) {
      const pubkeysObtained = Object.keys(profs);
      const idsToGet: string[] = this.#getIdsForFilter(events[42]).filter(
        (v) => !events[42].map((ev) => ev.id).includes(v),
      );
      if (eventsAll.length > 0) {
        const pubkeysToGet: string[] = this.#getPubkeysForFilter(
          eventsAll,
        ).filter((v) => !pubkeysObtained.includes(v));
        const newFilterPhase2: Filter[] = [];
        if (pubkeysToGet.length > 0) {
          newFilterPhase2.push({
            kinds: [0],
            authors: pubkeysToGet,
            until: this.#until,
          });
        }
        if (idsToGet.length > 0) {
          newFilterPhase2.push({ ids: idsToGet, until: this.#until });
        }
        if (newFilterPhase2.length > 0) {
          this.#getEventsPhase2(newFilterPhase2, [], false);
        }
      }
      this.#getEventsPhase3(
        filterPhase3,
        pubkeysObtained,
        eventsQuoted.map((v) => v.id),
      );
    }
  };

  #getEventsPhase3 = (
    filterPhase3: Filter[],
    pubkeysObtained: string[],
    idsObtained: string[],
  ) => {
    console.log('getEventsPhase3 * START *');
    const rxReq = createRxForwardReq();
    this.#rxNostr.setDefaultRelays(this.#relays);
    this.#rxNostr
      .use(rxReq)
      .pipe(this.#tie)
      .subscribe({
        next: (packet) => {
          const ev = packet.event;
          this.#callbackPhase3(ev);
          const pubkeysToGet: string[] = this.#getPubkeysForFilter([ev]).filter(
            (v) => !pubkeysObtained.includes(v),
          );
          const idsToGet: string[] = this.#getIdsForFilter([ev]).filter(
            (v) => !idsObtained.includes(v),
          );
          const filterPhase2: Filter[] = [];
          if (pubkeysToGet.length > 0) {
            pubkeysObtained = pubkeysObtained.concat(pubkeysToGet);
            filterPhase2.push({
              kinds: [0],
              authors: pubkeysToGet,
            });
          }
          if (idsToGet.length > 0) {
            idsObtained = idsObtained.concat(idsToGet);
            filterPhase2.push({ ids: idsToGet });
          }
          if (filterPhase2.length > 0) {
            this.#getEventsPhase2(filterPhase2, [], false);
          }
        },
      });
    try {
      rxReq.emit(filterPhase3);
    } catch (error) {
      console.error(error);
    }
  };

  #getPubkeysForFilter = (events: NostrEvent[]): string[] => {
    const pubkeys: Set<string> = new Set();
    for (const ev of events.filter((ev) => [7, 16, 40].includes(ev.kind))) {
      pubkeys.add(ev.pubkey);
    }
    for (const ev of events.filter((ev) => ev.kind === 0)) {
      //npubでの言及
      let content;
      try {
        content = JSON.parse(ev.content);
      } catch (error) {
        console.warn(error);
        console.info(ev);
        continue;
      }
      if (!content.about) continue;
      const matchesIteratorNpub = (content.about as string).matchAll(
        /nostr:(npub\w{59})/g,
      );
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
    for (const ev of events.filter((ev) => [1, 42].includes(ev.kind))) {
      pubkeys.add(ev.pubkey);
      //pタグ送信先
      for (const pubkey of ev.tags
        .filter((tag) => tag.length >= 2 && tag[0] === 'p')
        .map((tag) => tag[1])) {
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
        if (d.type === 'npub') pubkeys.add(d.data);
      }
    }
    return Array.from(pubkeys);
  };

  #getIdsForFilter = (events: NostrEvent[]): string[] => {
    const ids: Set<string> = new Set();
    for (const ev of events) {
      if (ev.kind === 42) {
        const matchesIterator = ev.content.matchAll(
          /nostr:(note\w{59}|nevent\w+)/g,
        );
        for (const match of matchesIterator) {
          let d;
          try {
            d = nip19.decode(match[1]);
          } catch (error) {
            console.warn(error);
            console.info(ev);
            continue;
          }
          if (d.type === 'note') ids.add(d.data);
          else if (d.type === 'nevent') ids.add(d.data.id);
        }
      } else if (ev.kind === 16) {
        const id = ev.tags
          .find((tag) => tag.length >= 2 && tag[0] === 'e')
          ?.at(1);
        if (id !== undefined) {
          ids.add(id);
        }
      }
    }
    return Array.from(ids);
  };

  #getPinList = (events: NostrEvent[]): string[] => {
    if (events.length === 0) return [];
    return events
      .reduce((a, b) => (a.created_at > b.created_at ? a : b))
      .tags.filter((tag) => tag.length >= 2 && tag[0] === 'e')
      .map((tag) => tag[1]);
  };

  #getProfiles = (events: NostrEvent[]): { [key: string]: Profile } => {
    const profs: { [key: string]: Profile } = {};
    for (const ev of events.filter((ev) => ev.kind === 0)) {
      if (
        (profs[ev.pubkey] && profs[ev.pubkey].created_at < ev.created_at) ||
        !profs[ev.pubkey]
      ) {
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
}

export const sendMessage = async (
  rxNostr: RxNostr,
  seenOn: Map<string, Set<string>>,
  relaysToWrite: string[],
  content: string,
  targetEventToReply: NostrEvent,
  emojiMap: Map<string, string>,
  contentWarningReason: string | undefined = undefined,
) => {
  const seenOnAry = Array.from(seenOn.get(targetEventToReply.id) ?? []);
  if (seenOnAry.length === 0) {
    throw new Error(
      `The event to reply is not found: ${targetEventToReply.id}`,
    );
  }
  const recommendeRelay = seenOnAry[0];
  const tags: string[][] = [];
  const mentionPubkeys: Set<string> = new Set();
  const rootTag = targetEventToReply.tags.find(
    (tag) => tag.length >= 4 && tag[0] === 'e' && tag[3] === 'root',
  );
  if (rootTag !== undefined) {
    tags.push(rootTag);
    tags.push(['e', targetEventToReply.id, recommendeRelay, 'reply']);
    mentionPubkeys.add(targetEventToReply.pubkey);
  } else {
    tags.push(['e', targetEventToReply.id, recommendeRelay, 'root']);
  }
  for (const pubkeyToReply of targetEventToReply.tags
    .filter((tag) => tag.length >= 2 && tag[0] === 'p')
    .map((tag) => tag[1])) {
    mentionPubkeys.add(pubkeyToReply);
  }
  const mentionIds: Set<string> = new Set();
  const matchesIteratorId = content.matchAll(
    /(^|\W|\b)(nostr:(note\w{59}|nevent\w+))($|\W|\b)/g,
  );
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
    } else if (d.type === 'nevent') {
      mentionIds.add(d.data.id);
    }
  }
  const matchesIteratorPubkey = content.matchAll(
    /(^|\W|\b)(nostr:(npub\w{59}|nprofile\w+))($|\W|\b)/g,
  );
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
    } else if (d.type === 'nprofile') {
      mentionPubkeys.add(d.data.pubkey);
    }
  }
  const matchesIteratorHashTag = content.matchAll(/(^|\s)#([^\s#]+)/g);
  const hashtags: Set<string> = new Set();
  for (const match of matchesIteratorHashTag) {
    hashtags.add(match[2]);
  }
  const matchesIteratorEmojiTag = content.matchAll(
    new RegExp(`:(${Array.from(emojiMap.keys()).join('|')}):`, 'g'),
  );
  const emojitags: Set<string> = new Set();
  for (const match of matchesIteratorEmojiTag) {
    if (emojiMap.has(match[1])) emojitags.add(match[1]);
  }
  for (const id of mentionIds) {
    tags.push(['e', id, '', 'mention']);
  }
  for (const p of mentionPubkeys) {
    tags.push(['p', p, '']);
  }
  for (const t of hashtags) {
    tags.push(['t', t.toLowerCase()]);
  }
  for (const e of emojitags) {
    tags.push(['emoji', e, emojiMap.get(e) as string]);
  }
  if (contentWarningReason !== undefined) {
    tags.push(['content-warning', contentWarningReason]);
  }
  const baseEvent: EventTemplate = {
    kind: 42,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: content,
  };
  if (window.nostr === undefined) return;
  const newEvent = await window.nostr.signEvent(baseEvent);
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(newEvent);
};

export const sendRepost = async (
  rxNostr: RxNostr,
  seenOn: Map<string, Set<string>>,
  relaysToWrite: string[],
  targetEvent: NostrEvent,
) => {
  const recommendeRelay =
    Array.from(seenOn.get(targetEvent.id) ?? []).at(0) ?? '';
  const tags: string[][] = [
    ['e', targetEvent.id, recommendeRelay, ''],
    ['p', targetEvent.pubkey, ''],
    ['k', String(targetEvent.kind)],
  ];
  const baseEvent: EventTemplate = {
    kind: 16,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: '',
  };
  if (window.nostr === undefined) return;
  const newEvent = await window.nostr.signEvent(baseEvent);
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(newEvent);
};

export const sendFav = async (
  rxNostr: RxNostr,
  relaysToWrite: string[],
  targetEvent: NostrEvent,
  content: string,
  emojiurl?: string,
) => {
  const tags: string[][] = [
    ...targetEvent.tags.filter(
      (tag) =>
        tag.length >= 2 &&
        (tag[0] === 'e' || (tag[0] === 'p' && tag[1] !== targetEvent.pubkey)),
    ),
    ['e', targetEvent.id, '', ''],
    ['p', targetEvent.pubkey, ''],
    ['k', String(targetEvent.kind)],
  ];
  if (emojiurl) {
    tags.push(['emoji', content.replaceAll(':', ''), emojiurl]);
  }
  const baseEvent: EventTemplate = {
    kind: 7,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: content,
  };
  if (window.nostr === undefined) return;
  const newEvent = await window.nostr.signEvent(baseEvent);
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(newEvent);
};

export const sendCreateChannel = async (
  rxNostr: RxNostr,
  relaysToWrite: string[],
  name: string,
  about: string,
  picture: string,
) => {
  const baseEvent: EventTemplate = {
    kind: 40,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify({
      name: name ?? '',
      about: about ?? '',
      picture: picture ?? '',
      relays: relaysToWrite,
    }),
  };
  if (window.nostr === undefined) return;
  const newEvent = await window.nostr.signEvent(baseEvent);
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(newEvent);
};

export const sendEditChannel = async (
  rxNostr: RxNostr,
  seenOn: Map<string, Set<string>>,
  relaysToUse: object,
  loginPubkey: string,
  currentChannelId: string,
  name: string,
  about: string,
  picture: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let newestEvent: NostrEvent;
    const onevent = (packet: EventPacket) => {
      const ev = packet.event;
      if (
        ev.pubkey === loginPubkey &&
        (!newestEvent || newestEvent.created_at < ev.created_at)
      ) {
        newestEvent = ev;
      }
    };
    const oneose = async () => {
      console.log('sendEditChannelPhase1 * EOSE *');
      if (!newestEvent) {
        throw new Error(
          `The event to edit does not exist: ${currentChannelId}`,
        );
      }
      const relaysToWrite = Object.entries(relaysToUse)
        .filter((v) => v[1].write)
        .map((v) => v[0]);
      const objContent: object = JSON.parse(newestEvent.content);
      (objContent as any).name = name;
      (objContent as any).about = about;
      (objContent as any).picture = picture;
      (objContent as any).relays = relaysToWrite;
      const recommendeRelay =
        Array.from(seenOn.get(currentChannelId) ?? []).at(0) ?? '';
      const baseEvent: EventTemplate = {
        kind: 41,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', currentChannelId, recommendeRelay]],
        content: JSON.stringify(objContent),
      };
      if (window.nostr === undefined) return;
      let newEvent;
      try {
        newEvent = await window.nostr.signEvent(baseEvent);
      } catch (error) {
        reject(error);
        return;
      }
      rxNostr.setDefaultRelays(relaysToWrite);
      rxNostr.send(newEvent);
      console.log('sendEditChannelPhase2 * Complete *');
      resolve();
    };
    const now = Math.floor(Date.now() / 1000);
    const relaysToRead = Object.entries(relaysToUse)
      .filter((v) => v[1].read)
      .map((v) => v[0]);
    const rxReq = createRxBackwardReq();
    rxNostr.use(rxReq).subscribe({
      next: onevent,
      complete: oneose,
    });
    rxReq.emit(
      [
        { kinds: [40], ids: [currentChannelId], until: now },
        {
          kinds: [41],
          authors: [loginPubkey],
          '#e': [currentChannelId],
          until: now,
        },
      ],
      { relays: relaysToRead },
    );
    rxReq.over();
  });
};

export const sendEditProfile = async (
  rxNostr: RxNostr,
  relaysToUse: object,
  loginPubkey: string,
  prof: Profile,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let newestEvent: NostrEvent;
    const onevent = (packet: EventPacket) => {
      const ev = packet.event;
      if (
        ev.pubkey === loginPubkey &&
        (!newestEvent || newestEvent.created_at < ev.created_at)
      ) {
        newestEvent = ev;
      }
    };
    const oneose = async () => {
      console.log('sendEditProfilePhase1 * EOSE *');
      const relaysToWrite = Object.entries(relaysToUse)
        .filter((v) => v[1].write)
        .map((v) => v[0]);
      let objContent: object;
      if (newestEvent !== undefined) {
        objContent = JSON.parse(newestEvent.content);
      } else {
        objContent = {};
      }
      (objContent as any).name = prof.name;
      (objContent as any).about = prof.about;
      (objContent as any).picture = prof.picture;
      (objContent as any).display_name = prof.display_name;
      (objContent as any).website = prof.website;
      const baseEvent: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: newestEvent?.tags ?? [],
        content: JSON.stringify(objContent),
      };
      if (window.nostr === undefined) return;
      let newEvent;
      try {
        newEvent = await window.nostr.signEvent(baseEvent);
      } catch (error) {
        reject(error);
        return;
      }
      rxNostr.setDefaultRelays(relaysToWrite);
      rxNostr.send(newEvent);
      console.log('sendEditProfilePhase2 * Complete *');
      resolve();
    };
    const relaysToRead = Object.entries(relaysToUse)
      .filter((v) => v[1].read)
      .map((v) => v[0]);
    const rxReq = createRxBackwardReq();
    rxNostr.use(rxReq).subscribe({
      next: onevent,
      complete: oneose,
    });
    rxReq.emit([{ kinds: [0], authors: [loginPubkey] }], {
      relays: relaysToRead,
    });
    rxReq.over();
  });
};

export const sendDeletion = async (
  rxNostr: RxNostr,
  relaysToWrite: string[],
  event: NostrEvent,
) => {
  const baseEvent: EventTemplate = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', event.id],
      ['k', String(event.kind)],
    ],
    content: '',
  };
  if (window.nostr === undefined) return;
  const newEvent = await window.nostr.signEvent(baseEvent);
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(newEvent);
};

export const sendMuteUser = async (
  rxNostr: RxNostr,
  relaysToUse: object,
  loginPubkey: string,
  pubkey: string,
  toSet: boolean,
) => {
  await sendPinOrMute(
    rxNostr,
    relaysToUse,
    loginPubkey,
    pubkey,
    toSet,
    10000,
    'p',
  );
};

export const sendMute = async (
  rxNostr: RxNostr,
  relaysToUse: object,
  loginPubkey: string,
  eventId: string,
  toSet: boolean,
) => {
  await sendPinOrMute(
    rxNostr,
    relaysToUse,
    loginPubkey,
    eventId,
    toSet,
    10000,
    'e',
  );
};

export const sendPin = async (
  rxNostr: RxNostr,
  relaysToUse: object,
  loginPubkey: string,
  eventId: string,
  toSet: boolean,
) => {
  await sendPinOrMute(
    rxNostr,
    relaysToUse,
    loginPubkey,
    eventId,
    toSet,
    10005,
    'e',
  );
};

const sendPinOrMute = async (
  rxNostr: RxNostr,
  relaysToUse: object,
  loginPubkey: string,
  eventId: string,
  toSet: boolean,
  kind: number,
  tagName: string,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let newestEvent: NostrEvent;
    const onevent = (packet: EventPacket) => {
      const ev = packet.event;
      if (
        ev.pubkey === loginPubkey &&
        (!newestEvent || newestEvent.created_at < ev.created_at)
      ) {
        newestEvent = ev;
      }
    };
    const oneose = async () => {
      console.log('sendPinOrMutePhase1 * EOSE *');
      if (window.nostr === undefined) return;
      let tags;
      let content = '';
      if (newestEvent) {
        tags = newestEvent.tags;
        const publicList = newestEvent.tags
          .filter((tag) => tag.length >= 2 && tag[0] === tagName)
          .map((tag) => tag[1]);
        let list: string[][] = [];
        if (newestEvent.content !== '' && window.nostr.nip04 !== undefined) {
          try {
            const content = await window.nostr.nip04.decrypt(
              loginPubkey,
              newestEvent.content,
            );
            list = JSON.parse(content);
          } catch (error) {
            console.warn(error);
            reject(error);
            return;
          }
        }
        const privateList = list
          .filter((tag) => tag.length >= 2 && tag[0] === tagName)
          .map((tag) => tag[1]);
        const includes: boolean = [...publicList, ...privateList].includes(
          eventId,
        );
        if ((includes && toSet) || (!includes && !toSet)) {
          throw new Error(
            `The event does not have to update: ${newestEvent.id}`,
          );
        }
        if (toSet) {
          tags = [...tags, [tagName, eventId]];
          content = newestEvent.content;
        } else {
          if (publicList.includes(eventId)) {
            tags = tags.filter(
              (tag) =>
                !(tag.length >= 2 && tag[0] === tagName && tag[1] === eventId),
            );
            content = newestEvent.content;
          } else if (window.nostr.nip04 !== undefined) {
            try {
              content = await window.nostr.nip04.encrypt(
                loginPubkey,
                JSON.stringify(
                  list.filter(
                    (tag) =>
                      !(
                        tag.length >= 2 &&
                        tag[0] === tagName &&
                        tag[1] === eventId
                      ),
                  ),
                ),
              );
            } catch (error) {
              reject(error);
              return;
            }
          }
        }
      } else {
        if (toSet) {
          tags = [[tagName, eventId]];
        } else {
          throw new Error(
            `The kind ${kind} event to remove the pin does not exist: ${eventId}`,
          );
        }
      }
      const relaysToWrite = Object.entries(relaysToUse)
        .filter((v) => v[1].write)
        .map((v) => v[0]);
      const baseEvent: EventTemplate = {
        kind: kind,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content,
      };
      let newEvent;
      try {
        newEvent = await window.nostr.signEvent(baseEvent);
      } catch (error) {
        reject(error);
        return;
      }
      rxNostr.setDefaultRelays(relaysToWrite);
      rxNostr.send(newEvent);
      console.log('sendPinOrMutePhase2 * Complete *');
      resolve();
    };
    const relaysToRead = Object.entries(relaysToUse)
      .filter((v) => v[1].read)
      .map((v) => v[0]);

    const rxReq = createRxBackwardReq();
    rxNostr.use(rxReq).subscribe({
      next: onevent,
      complete: oneose,
    });
    rxReq.emit([{ kinds: [kind], authors: [loginPubkey] }], {
      relays: relaysToRead,
    });
    rxReq.over();
  });
};

export const broadcast = async (
  rxNostr: RxNostr,
  relaysToWrite: string[],
  event40: NostrEvent,
  event41: NostrEvent | undefined,
) => {
  rxNostr.setDefaultRelays(relaysToWrite);
  rxNostr.send(event40);
  if (event41 !== undefined) {
    rxNostr.send(event41);
  }
  console.log('broadcast * Complete *');
};

export const getExpandTagsList = (
  content: string,
  tags: string[][],
): [
  IterableIterator<RegExpMatchArray>,
  string[],
  { [key: string]: string },
] => {
  const regMatchArray = [
    'https?://[\\w!?/=+\\-_~:;.,*&@#$%[\\]]+',
    'nostr:npub\\w{59}',
    'nostr:nprofile\\w+',
    'nostr:note\\w{59}',
    'nostr:nevent\\w+',
    'nostr:naddr\\w+',
    '#[^\\s#]+',
  ];
  const emojiUrls: { [key: string]: string } = {};
  const emojiRegs = [];
  if (tags === undefined) {
    // why??
  } else {
    for (const tag of tags) {
      emojiRegs.push(':' + tag[1] + ':');
      emojiUrls[':' + tag[1] + ':'] = tag[2];
    }
  }
  if (emojiRegs.length > 0) {
    regMatchArray.push(emojiRegs.join('|'));
  }
  const regMatch = new RegExp(
    regMatchArray.map((v) => '(' + v + ')').join('|'),
    'g',
  );
  const regSplit = new RegExp(regMatchArray.join('|'));
  const plainTexts = content.split(regSplit);
  const matchesIterator = content.matchAll(regMatch);
  return [matchesIterator, plainTexts, emojiUrls];
};

export const getRelaysToUse = (
  relaysSelected: string,
  rxNostr: RxNostr,
  tie: OperatorFunction<
    EventPacket,
    EventPacket & { seenOn: Set<string>; isNew: boolean }
  >,
  loginPubkey: string,
): Promise<RelayRecord> => {
  switch (relaysSelected) {
    case 'kind3':
      return new Promise((resolve) => {
        getGeneralEvents(rxNostr, tie, relaysToGetRelays, [
          { kinds: [3], authors: [loginPubkey] },
        ]).then((events: NostrEvent[]) => {
          if (events.length === 0) {
            resolve({});
          } else {
            const ev: NostrEvent = events.reduce(
              (a: NostrEvent, b: NostrEvent) =>
                a.created_at > b.created_at ? a : b,
            );
            resolve(ev.content.length > 0 ? JSON.parse(ev.content) : {});
          }
        });
      });
    case 'kind10002':
      return new Promise((resolve) => {
        getGeneralEvents(rxNostr, tie, relaysToGetRelays, [
          { kinds: [10002], authors: [loginPubkey] },
        ]).then((events: NostrEvent[]) => {
          if (events.length === 0) {
            resolve({});
          } else {
            const ev: NostrEvent = events.reduce(
              (a: NostrEvent, b: NostrEvent) =>
                a.created_at > b.created_at ? a : b,
            );
            const newRelays: RelayRecord = {};
            for (const tag of ev.tags.filter(
              (tag) => tag.length >= 2 && tag[0] === 'r',
            )) {
              newRelays[normalizeURL(tag[1])] = {
                read: tag.length === 2 || tag[2] === 'read',
                write: tag.length === 2 || tag[2] === 'write',
              };
            }
            resolve(newRelays);
          }
        });
      });
    case 'nip05':
      return new Promise((resolve) => {
        getGeneralEvents(rxNostr, tie, relaysToGetRelays, [
          { kinds: [0], authors: [loginPubkey] },
        ]).then(async (events: NostrEvent[]) => {
          if (events.length === 0) {
            resolve({});
            return;
          }
          const ev: NostrEvent = events.reduce(
            (a: NostrEvent, b: NostrEvent) =>
              a.created_at > b.created_at ? a : b,
          );
          const nip05field = JSON.parse(ev.content).nip05;
          if (nip05field === undefined) {
            resolve({});
            return;
          }
          nip05.useFetchImplementation(fetch);
          const p = await nip05.queryProfile(nip05field);
          if (p === null || p === undefined || p.relays === undefined) {
            resolve({});
            return;
          }
          const newRelays: RelayRecord = {};
          for (const relay of p.relays) {
            newRelays[normalizeURL(relay)] = { read: true, write: true };
          }
          resolve(newRelays);
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

const getGeneralEvents = (
  rxNostr: RxNostr,
  tie: OperatorFunction<
    EventPacket,
    EventPacket & { seenOn: Set<string>; isNew: boolean }
  >,
  relays: string[],
  filters: Filter[],
  callbackEvent: (event: NostrEvent) => void = () => {},
): Promise<NostrEvent[]> => {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const rxReq = createRxBackwardReq();
    rxNostr
      .use(rxReq)
      .pipe(tie)
      .subscribe({
        next: (
          packet: EventPacket & {
            seenOn: Set<string>;
          },
        ) => {
          const ev = packet.event;
          events.push(ev);
          callbackEvent(ev);
        },
        complete: () => {
          console.log('getGeneralEvents * EOSE *');
          resolve(events);
        },
      });
    rxReq.emit(filters, { relays });
    rxReq.over();
  });
};

export function insertEventIntoAscendingList(
  sortedArray: NostrEvent[],
  event: NostrEvent,
): NostrEvent[] {
  const [idx, found] = binarySearch(sortedArray, (b) => {
    if (event.id === b.id) return 0;
    if (event.created_at === b.created_at) return b.id.localeCompare(event.id);
    return event.created_at - b.created_at;
  });
  if (!found) {
    sortedArray.splice(idx, 0, event);
  }
  return sortedArray;
}

export const zap = (npub: string, id: string, relays: string[]) => {
  const elm = document.createElement('button') as HTMLButtonElement;
  elm.dataset.npub = npub;
  elm.dataset.noteId = id;
  elm.dataset.relays = relays.join(',');
  (window as any).nostrZap.initTarget(elm);
  elm.dispatchEvent(new Event('click'));
};

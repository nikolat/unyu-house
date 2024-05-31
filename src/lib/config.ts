import type { RelayRecord } from 'nostr-tools/relay';

export const title = 'うにゅうハウス';
export const defaultRelays: RelayRecord = {
	'wss://relay-jp.nostr.wirednet.jp/': {'read': true, 'write': true},
	'wss://yabu.me/': {'read': true, 'write': true},
	'wss://nrelay.c-stellar.net/': {'read': true, 'write': false},
};
export const relaysToGetRelays = [
	'wss://relay-jp.nostr.wirednet.jp/',
	'wss://yabu.me/',
	'wss://nos.lol/',
	'wss://relay.damus.io/',
];
export const urlToLinkNote = 'https://nostter.app';
export const urlToLinkNaddr = 'https://njump.me';
export const urlNIP07guide = 'https://scrapbox.io/nostr/nos2x%E3%81%AE%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97%E3%81%A8%E4%BD%BF%E3%81%84%E6%96%B9';

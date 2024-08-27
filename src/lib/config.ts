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
export const uploaderURLs = [
  'https://yabu.me',
  'https://nostpic.com',
  'https://nostr.build',
  'https://nostrcheck.me',
  'https://void.cat',
  'https://files.sovbit.host',
];
export const urlToLinkNote = 'https://nostter.app';
export const urlToLinkNaddr = 'https://njump.me';
export const urlNIP07guide =
  'https://welcome.nostr-jp.org/tutorial/nip-07.html';

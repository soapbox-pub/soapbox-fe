import { generateKey } from 'openpgp';

import KVStore from 'soapbox/storage/kv_store';

/**
 * Detect whether a message contains valid PGP headers.
 * @see {@link https://datatracker.ietf.org/doc/html/rfc4880#section-7}
 */
const isPgpMessage = (message: string): boolean => {
  return /^-----BEGIN PGP [A-Z ]+-----/.test(message);
};

/** Generate a key and store it in the browser, if one doesn't already exist. */
const initPgpKey = async(fqn: string) => {
  const item = await KVStore.getItem(`pgp:${fqn}`);

  if (item) {
    return item;
  } else {
    const key = generateKey({ userIDs: [{ name: fqn }] });
    return await KVStore.setItem(`pgp:${fqn}`, key);
  }
};

export {
  isPgpMessage,
  initPgpKey,
};
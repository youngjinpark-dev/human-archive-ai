import CryptoJS from "crypto-js";

const KEY_PREFIX = "ha_";

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  // 32바이트 랜덤 hex
  const randomPart = CryptoJS.lib.WordArray.random(32).toString(
    CryptoJS.enc.Hex
  );
  const raw = `${KEY_PREFIX}${randomPart}`;
  const hash = CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex);
  const prefix = raw.slice(0, 10);

  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex);
}

import CryptoJS from "crypto-js";
import { config } from "../config/env";

const ENC_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || config.jwtSecret;

export function encryptConfig(obj: Record<string, any>): string {
  const json = JSON.stringify(obj);
  return CryptoJS.AES.encrypt(json, ENC_KEY).toString();
}

export function decryptConfig(encrypted: string): Record<string, any> {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENC_KEY);
  const json = bytes.toString(CryptoJS.enc.Utf8);
  if (!json) return {};
  return JSON.parse(json);
}

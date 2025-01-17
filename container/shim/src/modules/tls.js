import fsPromises from "node:fs/promises";
import fetch from "node-fetch";

import { debug as Debug } from "../utils/logging.js";
import { ORCHESTRATOR_URL } from "../config.js";

const debug = Debug.extend("tls");

export const SSL_PATH = "/usr/src/app/shared/ssl";
export const CERT_PATH = `${SSL_PATH}/node.crt`;
export const KEY_PATH = `${SSL_PATH}/node.key`;
export const BACKUP_CERT_PATH = `${SSL_PATH}/node.backup.crt`;
export const BACKUP_KEY_PATH = `${SSL_PATH}/node.backup.key`;

export const certExists = await fsPromises.stat(CERT_PATH).catch((_) => false);
export const backupCertExists = await fsPromises.stat(BACKUP_CERT_PATH).catch((_) => false);

export async function getNewTLSCert(registerOptions) {
  debug("Requesting new TLS cert from orchestrator (this could take up to 60 mins)");

  const response = await fetch(`${ORCHESTRATOR_URL}/register`, registerOptions);

  if (!response.ok) {
    debug("Received status %d with body: %o", response.status, await response.text());
    throw new Error("Failed to register with the orchestrator");
  }

  const body = await response.json();
  const { cert, key, backupCert, backupKey } = body;

  if (!cert || !key) {
    debug("Received empty body: %o", body);
    throw new Error(body?.error || "Empty cert or key received");
  }

  debug("TLS certificate and key received, persisting to shared volume...");

  await saveCertAndKey(cert, key);
  if (backupCert && backupKey) {
    await saveBackupCertAndKey(backupCert, backupKey);
  }
}

async function saveCertAndKey(cert, key) {
  debug("Saving cert and key");
  return await Promise.all([fsPromises.writeFile(CERT_PATH, cert), fsPromises.writeFile(KEY_PATH, key)]);
}

async function saveBackupCertAndKey(backupCert, backupKey) {
  debug("Saving cert and key");
  return await Promise.all([
    fsPromises.writeFile(BACKUP_CERT_PATH, backupCert),
    fsPromises.writeFile(BACKUP_KEY_PATH, backupKey),
  ]);
}

export async function swapCerts() {
  debug("Swapping revoked cert");

  return await Promise.all([
    fsPromises.copyFile(BACKUP_CERT_PATH, CERT_PATH),
    fsPromises.copyFile(BACKUP_KEY_PATH, KEY_PATH),
  ]);
}

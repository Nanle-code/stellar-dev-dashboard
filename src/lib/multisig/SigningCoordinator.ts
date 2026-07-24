import { importSessionJson, addSignatureToSession, addRawSignatureToXdr } from '../multisig';

export class SigningCoordinator {
  /**
   * Parses and merges an external co-signer's exported JSON session.
   */
  static async importAndMergeSession(jsonString: string) {
    return await importSessionJson(jsonString);
  }

  /**
   * Orchestrates appending a raw signature hex array to an active session without a direct JSON import.
   */
  static async submitRawSignature(sessionId: string, txXdr: string, publicKey: string, signatureHex: string, network: string = 'testnet') {
    const newXdr = addRawSignatureToXdr(txXdr, publicKey, signatureHex, network);
    return await addSignatureToSession(sessionId, publicKey, newXdr);
  }
}
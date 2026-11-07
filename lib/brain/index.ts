/**
 * lib/brain/index.ts — the ONLY file other agents may import from lib/brain.
 * Owner: Agent A. Signatures here are part of the contract (see shared/CONTRACTS.md).
 *
 * Rule: lib/brain must NOT import lib/world (avoids circular imports). World data comes in
 * as arguments; orchestration lives in app/api/brain/*.
 */
export { scanImage } from "./vision";
export { planActions, decideOffline } from "./agent";
export { quoteSpecial } from "./pricing";

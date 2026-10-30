// Pure join-code helpers, safe to import from client code (tokens.ts uses node:crypto).

/** No 0/O or 1/I/L, so a code read aloud or copied by hand can't be mistyped. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;

/** "ABCD2345" → "ABCD-2345" */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

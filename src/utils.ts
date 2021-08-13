import { SAFE_DEV } from "./settings";

export function makeId(length: number): string {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
  }
  return result;
}

// wrap run or update functions
// not to get colony wide blackout cause i missed something in some master
export function safeWrap(cycle: () => void, context: string): void {
  if (SAFE_DEV) {
    try { cycle(); }
    catch (e) { console.log("ERROR in:", context, Game.time, "\n", e); }
  } else
    cycle();
}

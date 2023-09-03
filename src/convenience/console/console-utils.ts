import { roomStates } from "static/enums";

import type { CustomConsole } from "./console";

export function snapOldPlans(this: CustomConsole) {
  for (const ref of Object.keys(Memory.cache.roomPlanner)) {
    const state = Apiary.intel.getRoomState(ref);
    if (
      state !== roomStates.ownedByMe &&
      state !== roomStates.reservedByMe &&
      !_.filter(Apiary.hives, (h) => h.annexNames.includes(ref)).length // most important prob
    ) {
      delete Memory.cache.roomPlanner[ref];
      console.log(`REMOVED OLD ROOMPLANS @${this.formatRoom(ref)}`);
    }
  }
}

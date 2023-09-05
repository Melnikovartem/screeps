import type { CustomConsole } from "./console";

export function snapOldPlans(this: CustomConsole) {
  for (const hiveName of Object.keys(Memory.longterm.roomPlanner)) {
    const hive = Apiary.hives[hiveName];
    if (!hive) {
      delete Memory.longterm.roomPlanner[hiveName];
      console.log(`REMOVED OLD PLANS FOR HIVE @${this.formatRoom(hiveName)}`);
      continue;
    }
    const hivePlans = Memory.longterm.roomPlanner[hiveName];
    for (const roomName in hivePlans.rooms)
      if (!hive.annexNames.includes(roomName)) {
        delete hivePlans.rooms[roomName];
        console.log(
          `REMOVED OLD PLANS FOR ANNEX @${this.formatRoom(
            roomName
          )} OF HIVE @${this.formatRoom(hiveName)}`
        );
      }
  }
}

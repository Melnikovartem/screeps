import type { Hive } from "hive/hive";

import type { Visuals } from "./visuals";
import { SPACING } from "./visuals-constants";

export function statsNetwork(this: Visuals, hive: Hive) {
  const negative: string[][] = [["deficiency"], ["💱", "📉"]];

  for (const res in hive.resState) {
    const amount = hive.resState[res as ResourceConstant];
    if (amount && amount < 0) {
      let str = " " + -amount;
      if (amount < -1000) str = " " + -Math.round(amount / 100) / 10 + "K";
      negative.push([res, str]);
    }
  }
  const [x, y] = [this.anchor.x, this.anchor.y];
  let yNew = this.anchor.y;
  if (negative.length > 2) {
    this.objectNew({ x: x + SPACING, y: 1 });
    yNew = this.table(negative, this.anchor, undefined).y;
  }
  this.objectNew({ x: 1, y: Math.max(y, yNew) + SPACING });

  const aid = Apiary.network.aid[hive.roomName];
  if (aid) this.label(`💸 ${aid.to} -> ${aid.res} ${aid.amount}`, this.anchor);
}

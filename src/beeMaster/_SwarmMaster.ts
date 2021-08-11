// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { Hive } from "../Hive";
import { Master } from "./_Master";

export abstract class SwarmMaster extends Master {

  order: Flag
  destroyTime: number;

  constructor(hive: Hive, order: Flag) {
    super(hive, "Swarm_" + order.name);

    this.destroyTime = Game.time + 2000;
    this.order = order;
  }
}

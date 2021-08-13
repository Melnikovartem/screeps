// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { Hive } from "../Hive";
import { Master } from "./_Master";

import { Order } from "../order";

export abstract class SwarmMaster extends Master {

  order: Order;

  constructor(hive: Hive, order: Order) {
    super(hive, "Swarm_" + order.ref);

    this.order = order;
  }
}

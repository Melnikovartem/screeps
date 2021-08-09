// new fancy war ai master
// so i can check instanceof SwarmMaster aka my army

import type { Hive } from "../Hive";
import { Master } from "./_Master";

export abstract class SwarmMaster extends Master {
  constructor(hive: Hive, ref: string) {
    super(hive, ref);
  }
}

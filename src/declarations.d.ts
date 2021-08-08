import { Hive } from "./Hive";
import { Master } from "./beeMaster/_Master";
import { Bee } from "./bee";

// Syntax for adding proprties to `global` (ex "global.log")

declare global {
  namespace NodeJS {
    interface Global {
      hives: { [id: string]: Hive };
      masters: { [id: string]: Master };
      bees: { [id: string]: Bee };
    }
  }

  interface Memory {
    masters: { [id: string]: any };
  }

  interface CreepMemory {
    refMaster: string;
  }
}

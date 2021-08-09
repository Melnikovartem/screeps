import { Master } from "./beeMaster/_Master";
import { Bee } from "./bee";
import { _Apiary } from "./Apiary";

// Syntax for adding proprties to `global` (ex "global.log")

declare global {

  namespace NodeJS {
    interface Global {
      masters: { [id: string]: Master };
      bees: { [id: string]: Bee };
      Apiary: _Apiary;
    }
  }

  interface Memory {
    log: {
      reset?: number,
    },
    masters: { [id: string]: any };
  }

  interface CreepMemory {
    refMaster: string;
  }
}

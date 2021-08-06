import { Hive } from "./Hive"
import { Master } from "./beeMaster/_Master"

// Syntax for adding proprties to `global` (ex "global.log")

declare global {
  namespace NodeJS {
    interface Global {
      hives: Hive[];
      masters: Master[];
    }

    interface Memory {
      masters: Master[];
    }
  }
}

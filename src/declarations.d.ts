interface Memory {
  uuid: number;
  log: any;
}

interface CreepMemory {
  role: string;
  room: string;
  working: boolean;
}

// Syntax for adding proprties to `global` (ex "global.log")
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}

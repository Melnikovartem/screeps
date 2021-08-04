import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "storageCell");

    this.storage = storage;
  }

  update() { }

  run() { }
}

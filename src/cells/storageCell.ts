import { Cell } from "./_Cell";
import { Hive } from "../Hive";

export class storageCell extends Cell {

  storage: StructureStorage;
  link: StructureLink | undefined;


  constructor(hive: Hive, storage: StructureStorage) {
    super(hive, "storageCell_" + hive.room.name);

    this.storage = storage;

    let link = _.filter(this.storage.pos.findInRange(FIND_MY_STRUCTURES, 2), (structure) => structure.structureType == STRUCTURE_LINK);
    if (link instanceof StructureLink) {
      this.link = link;
    }
  }

  update() { }

  run() { }
}

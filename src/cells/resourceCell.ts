import { Cell } from "./_Cell";
import { Hive } from "../Hive";

// cell that will extract energy or minerals? from ground
export class resourceCell extends Cell {

  source: Source;
  link: StructureLink | undefined;
  container: StructureContainer | undefined;


  constructor(hive: Hive, source: Source) {
    super(hive, "resourceCell for " + source.id.slice(-3));

    this.source = source;
  }

  update() {
    if (this.container && this.container.store.getUsedCapacity() >= 200) {

    }
  }

  run() {
    if (this.link && this.link.store) {

    }
  }
}

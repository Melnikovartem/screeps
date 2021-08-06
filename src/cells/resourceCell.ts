import { Cell } from "./_Cell";
import { Hive } from "../Hive";

import { minerMaster } from "../beeMaster/miner"

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
    if (!this.master) {
      this.master = new minerMaster(this);
    }
    if (this.container && this.container.store.getUsedCapacity() >= 200) {

    }
  }

  run() {
    if (this.link && this.link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.link.store.getCapacity(RESOURCE_ENERGY) * 0.5
      && this.link.cooldown == 0 && this.hive.cells.storageCell && this.hive.cells.storageCell.link) {
      this.link.transferEnergy(this.hive.cells.storageCell.link);
    }
  }
}

// refills the respawnCell
import { excavationCell } from "../../cells/excavationCell";

import { Setups } from "../../creepSetups";
import { SpawnOrder } from "../../Hive";
import { Master } from "../_Master";

export class haulerMaster extends Master {

  cell: excavationCell;
  targetMap: { [id: string]: string } = {}; // "" is base value

  constructor(excavationCell: excavationCell) {
    super(excavationCell.hive, "master_" + excavationCell.ref);

    this.cell = excavationCell;

    this.targetBeeCount = 0;
    _.forEach(this.cell.resourceCells, (cell) => {
      let beeForSource = 0;
      if (cell.container) {
        this.targetMap[cell.container.id] = "";
        if (this.hive.stage == 2)
          beeForSource += 0.38;
        else
          beeForSource += 0.55;
      }
      if (cell.link)
        beeForSource = 0;
      this.targetBeeCount += beeForSource;
    });

    this.targetBeeCount = Math.ceil(this.targetBeeCount);
  }

  update() {
    super.update();

    for (let key in this.targetMap) {
      if (!global.bees[this.targetMap[key]])
        this.targetMap[key] = "";
    }

    if (this.checkBees()) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.hauler,
        amount: Math.max(1, this.targetBeeCount - this.beesAmount),
        priority: 4,
      };

      if (this.hive.stage < 2)
        order.setup.bodySetup.patternLimit = 10;

      this.wish(order);
    }
  }

  run() {
    // for future might be good to find closest bee for container and not the other way around
    if (this.hive.cells.storageCell) {
      let target = this.hive.cells.storageCell.storage;
      _.forEach(this.bees, (bee) => {
        let ans;

        if (bee.creep.store.getUsedCapacity() == 0) {
          let suckerTarget = _.filter(this.cell.quitefullContainers,
            (container) => this.targetMap[container.id] == bee.ref)[0];

          if (!suckerTarget)
            suckerTarget = <StructureContainer>_.filter(this.cell.quitefullContainers,
              (container) => this.targetMap[container.id] == "")[0];

          if (suckerTarget) {
            ans = bee.withdraw(suckerTarget, <ResourceConstant>Object.keys(suckerTarget.store)[0])
            if (ans == OK)
              this.targetMap[suckerTarget.id] = "";
            else
              this.targetMap[suckerTarget.id] = bee.ref;
          }
        }

        if (bee.creep.store.getUsedCapacity() > 0 || ans == OK) {
          bee.transfer(target, <ResourceConstant>Object.keys(bee.store)[0]);
        }
      });
    }
  }
}

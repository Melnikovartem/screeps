import { Setups } from "../../creepSetups";
import { SpawnOrder, Hive } from "../../Hive";
import { Master, states } from "../_Master";
import { profile } from "../../profiler/decorator";

@profile
export class builderMaster extends Master {

  constructor(hive: Hive) {
    super(hive, "BuilderHive_" + hive.room.name);
  }

  update() {
    super.update();

    //let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    let constLen = this.hive.structuresConst.length;
    let constSum = this.hive.sumCost;
    if (constSum === 0 && constLen === 0)
      this.targetBeeCount = 0;
    else
      this.targetBeeCount = 1;
    /*
    else if ((constLen < 20 && repSum < 20000 && repLen < 100)
      || (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) < 200000))
      this.targetBeeCount = 2;
    else
      this.targetBeeCount = 3;
    */

    if (this.checkBees()) {
      let order: SpawnOrder = {

        setup: Setups.builder,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 8,
      };

      this.wish(order);
    }
  }

  run() {
    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    if (storage)
      _.forEach(this.bees, (bee) => {
        if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
          bee.state = states.refill;
        else
          bee.state = states.work;

        if (bee.state === states.refill && bee.withdraw(storage, RESOURCE_ENERGY) === OK) {
          bee.target = null;
          if (Apiary.logger)
            Apiary.logger.resourceTransfer(this.hive.roomName, "build", storage!.store, bee.store);
          bee.state = states.work;
        }
        if (bee.state === states.work) {
          let target: Structure | ConstructionSite | null = null;
          if (bee.target) {
            target = Game.getObjectById(bee.target);
            if (target instanceof Structure && target.hits === target.hitsMax) {
              this.hive.shouldRecalc = true;
              target = null;
            }
          }

          if (!target) {
            let pos = bee.pos.findClosest(this.hive.structuresConst);
            if (pos) {
              target = pos.lookFor(LOOK_CONSTRUCTION_SITES)[0];
              if (!target)
                target = _.filter(pos.lookFor(LOOK_STRUCTURES), (s) => s.hits < s.hitsMax)[0];
            }
          }

          if (target) {
            let ans;
            if (target instanceof ConstructionSite)
              ans = bee.build(target);
            else if (target instanceof Structure)
              ans = bee.repair(target);
            bee.target = target.id;
            bee.repairRoadOnMove(ans);
          } else {
            bee.target = null;
            bee.state = states.fflush;
          }
        }

        if (bee.state === states.fflush)
          if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            let ans = bee.transfer(storage, RESOURCE_ENERGY);
            if (ans === OK && Apiary.logger)
              Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, storage!.store, RESOURCE_ENERGY, 1);
            bee.repairRoadOnMove(ans);
          } else
            bee.state = states.chill;

        if (bee.state === states.chill)
          bee.goRest(this.hive.pos);
      });
  }
}

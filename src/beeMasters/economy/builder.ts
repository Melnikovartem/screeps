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

    let storage = this.hive.cells.storage && this.hive.cells.storage.storage;
    let constLen = this.hive.structuresConst.length;
    let constSum = this.hive.sumCost;
    if (!storage || constSum === 0 && constLen === 0 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 10000)
      this.targetBeeCount = 0;
    else if (constSum < 13000 && constLen < 10 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000)
      this.targetBeeCount = 1;
    else if (constSum < 22000 && constLen < 20 || storage.store.getUsedCapacity(RESOURCE_ENERGY) < 300000)
      this.targetBeeCount = 2;
    else
      this.targetBeeCount = 3;

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
        switch (bee.state) {
          case states.refill:
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
              bee.state = states.work;
            else if (bee.withdraw(storage, RESOURCE_ENERGY) === OK) {
              bee.state = states.work;
              bee.target = null;
              if (Apiary.logger)
                Apiary.logger.resourceTransfer(this.hive.roomName, "build", storage!.store, bee.store);
              let target = bee.pos.findClosest(this.hive.structuresConst);
              if (target && target.getRangeTo(bee.pos) > 3)
                bee.goTo(target);
            }
            break;
          case states.work:
            if (bee.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)
              bee.state = states.refill;
            else {
              let target: Structure | ConstructionSite | null = null;
              if (bee.target) {
                target = Game.getObjectById(bee.target);
                if (target instanceof Structure && target.hits >= Apiary.planner.getCase(target).heal) {
                  this.hive.shouldRecalc = 1;
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
                bee.state = states.chill;
              }
            }
            if (bee.state !== states.chill)
              break;
          case states.chill:
            if (this.hive.sumCost)
              bee.state = states.work;
            else if (bee.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
              let ans = bee.transfer(storage, RESOURCE_ENERGY);
              if (ans === OK && Apiary.logger)
                Apiary.logger.resourceTransfer(this.hive.roomName, "build", bee.store, storage!.store, RESOURCE_ENERGY, 1);
              bee.repairRoadOnMove(ans);
            } else
              bee.goRest(this.hive.pos);
            break;
        }
      });
  }
}

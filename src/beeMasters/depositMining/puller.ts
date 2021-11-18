import { Master } from "../_Master";

import { beeStates, prefix } from "../../enums";
import { setups } from "../../bees/creepsetups";

import { profile } from "../../profiler/decorator";
import type { DepositMaster } from "./deposit";

@profile
export class DepositPullerMaster extends Master {
  movePriority = <4>4;
  parent: DepositMaster;

  constructor(parent: DepositMaster) {
    super(parent.hive, parent.ref + prefix.puller);
    this.parent = parent;
  }

  update() {
    super.update();

    if (this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime)
      && this.parent.miners.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime)
      && this.parent.operational)
      this.wish({
        setup: setups.puller,
        priority: 8,
      });
  }

  run() {
    _.forEach(this.activeBees, bee => {
      switch (bee.state) {
        case beeStates.chill:
          let newTarget = _.filter(this.parent.miners.bees, b => b.state !== beeStates.work
            && !this.activeBees.filter(b1 => b1.target === b.ref && b1.state === beeStates.work && b1.ticksToLive > this.parent.roadTime - 10).length)[0];
          if (!newTarget) {
            bee.goRest(this.hive.rest);
            break;
          } else {
            bee.target = newTarget.ref;
            bee.state = beeStates.work;
          }
        case beeStates.work:
          let beeToPull = bee.target && this.parent.miners.bees[bee.target];
          if (!beeToPull || beeToPull.pos.isNearTo(this.parent)) {
            bee.target = undefined;
            bee.state = beeStates.chill;
            bee.goRest(this.hive.rest);
            break;
          }
          if (beeToPull.creep.spawning)
            bee.goRest(beeToPull.pos);
          else if (beeToPull.pos.isNearTo(bee)) {
            let pos = this.parent.pos;
            if (bee.pos.roomName === pos.roomName)
              pos = pos.isNearTo(bee) ? beeToPull.pos : (this.parent.pos.getOpenPositions(false)[0] || this.parent.pos);
            bee.goTo(pos, { range: 0 });
            bee.creep.pull(beeToPull.creep);
            beeToPull.creep.move(bee.creep);
            beeToPull.targetPosition = bee.pos;
            if (bee.targetPosition && bee.targetPosition.roomName !== bee.pos.roomName && bee.pos.getEnteranceToRoom()) {
              let anotherExit = bee.pos.getOpenPositions(true).filter(p => p.getRangeTo(bee) === 1 && p.getEnteranceToRoom())[0];
              if (anotherExit)
                bee.targetPosition = anotherExit;
            }
          } else if (!(beeToPull.pos.getEnteranceToRoom() && beeToPull.pos.getEnteranceToRoom()!.roomName === bee.pos.roomName))
            bee.goTo(beeToPull);
          this.checkFlee(bee, this.parent);
      }
    });
  }
}

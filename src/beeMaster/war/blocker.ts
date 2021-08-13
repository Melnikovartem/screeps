import { Bee } from "../../bee"

import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";

// lowlevel harass
export class blockerMaster extends SwarmMaster {
  targetMap: { [id: number]: { [id: number]: string } } = {};
  freeBees: Bee[] = [];
  runToDeath: boolean = false;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    let positions = order.pos.getWalkablePositions()
    _.forEach(positions, (pos) => {
      if (!this.targetMap[pos.x])
        this.targetMap[pos.x] = {};
      this.targetMap[pos.x][pos.y] = "";
    });

    this.targetBeeCount = positions.length;

    let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

    // sad cause safeMode saves from this shit
    if (roomInfo.safeModeEndTime > Game.time)
      this.destroyTime = Game.time;
    if (!this.runToDeath && !roomInfo.safePlace)
      this.destroyTime = Game.time;
    else
      this.destroyTime = Game.time + 2000;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    this.freeBees.push(bee);
  }

  update() {
    super.update();

    if (Game.time % 50 == 0) {
      let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

      // this stupid tatic was countered
      if (!roomInfo.safePlace)
        this.destroyTime = Game.time;
    }

    for (let keyX in this.targetMap)
      for (let keyY in this.targetMap[keyX])
        if (!global.bees[this.targetMap[keyX][keyY]] || this.targetMap[keyX][keyY] == "") {
          if (this.freeBees.length)
            this.targetMap[keyX][keyY] = this.freeBees.pop()!.ref;
        }

    if (this.checkBees() && this.destroyTime > Game.time + 200) {
      let order: SpawnOrder = {
        master: this.ref,
        setup: Setups.puppet,
        amount: this.targetBeeCount - this.beesAmount,
        priority: 5,
      };

      this.wish(order);
    }
  }

  run() {
    for (let keyX in this.targetMap)
      for (let keyY in this.targetMap[keyX]) {
        if (global.bees[this.targetMap[keyX][keyY]]) {
          global.bees[this.targetMap[keyX][keyY]].goTo(
            new RoomPosition(parseInt(keyX), parseInt(keyY), this.order.pos.roomName));
        }
      }

    _.forEach(this.freeBees, (bee) => {
      if (!bee.pos.isNearTo(this.order.pos))
        bee.goTo(this.order.pos);
    });
  }
}

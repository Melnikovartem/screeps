import { Bee } from "../../bee";
import { Setups, CreepSetup } from "../../creepSetups";
import type { SpawnOrder } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";
import { states } from "../_Master";

import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class dupletMaster extends SwarmMaster {
  healer: Bee | undefined;
  knight: Bee | undefined;
  spawned: boolean = false;
  meetingPoint: RoomPosition;

  constructor(order: Order) {
    super(order.hive, order);
    // sad cause safeMode saves from this shit
    this.order.destroyTime = Game.time + CREEP_LIFE_TIME;
    this.targetBeeCount = 2;
    this.meetingPoint = this.hive.pos;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyparts(HEAL))
      this.healer = bee;
    else
      this.knight = bee;
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
  }

  update() {
    super.update();

    if (this.knight && !Apiary.bees[this.knight.ref]) {
      delete this.knight;
      if (Memory.settings.framerate && this.healer)
        this.healer.creep.say("😢");
    }

    if (this.healer && !Apiary.bees[this.healer.ref]) {
      delete this.healer;
      if (Memory.settings.framerate && this.knight)
        this.knight.creep.say("😢");
    }

    if (!this.spawned) {
      this.spawned = true;
      if (!this.knight) {
        let knightOrder: SpawnOrder = {
          setup: new CreepSetup(Setups.knight.name, { ...Setups.knight.bodySetup }),
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        knightOrder.setup.bodySetup.patternLimit = 10;
        this.wish(knightOrder, this.ref + "_knight");
      }
      if (!this.healer) {
        let healerOrder: SpawnOrder = {
          setup: new CreepSetup(Setups.healer.name, { ...Setups.healer.bodySetup }),
          amount: 1,
          priority: 4,
          master: this.ref,
        };
        healerOrder.setup.bodySetup.patternLimit = 2;
        this.wish(healerOrder, this.ref + "_healer");
      }
    }

    if (!this.waitingForBees && (!this.knight || !this.knight))
      this.order.destroyTime = Game.time;
  }

  run() {
    let knight = this.knight;
    let healer = this.healer;
    if (knight && knight.state == states.chill)
      knight.goRest(this.meetingPoint);
    if (knight && knight.state == states.chill)
      knight.goRest(this.meetingPoint);

    if (knight && healer) {
      knight.state = states.work;
      healer.state = states.work;

      if (!healer.pos.isNearTo(knight))
        healer.goTo(knight.pos, { movingTarget: true });
      else if (knight.creep.hits < knight.creep.hitsMax)
        healer.heal(knight);


      let roomInfo = Apiary.intel.getInfo(knight.pos.roomName);
      let target: Structure | Creep = <Structure | Creep>knight.pos.findClosest(roomInfo.enemies);
      let ans;
      if (target)
        ans = knight.attack(target);
      else
        ans = knight.goRest(this.order.pos);

      if (ans == ERR_NOT_IN_RANGE)
        healer.creep.move(healer.pos.getDirectionTo(knight.pos));
    }
  }
}

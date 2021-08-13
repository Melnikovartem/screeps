import { Bee } from "../../bee"

import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { SwarmMaster } from "../_SwarmMaster";

import { VISUALS_ON } from "../../settings"

// my first tandem
export class drainerMaster extends SwarmMaster {
  healer: Bee | undefined;
  tank: Bee | undefined;
  phase: "spawning" | "meeting" | "draining" = "spawning";

  // for last stage
  exit: RoomPosition | null = null;
  target: string | undefined;
  healing: boolean = false;

  constructor(hive: Hive, order: Flag) {
    super(hive, order);

    // sad cause safeMode saves from this shit
    this.destroyTime = Game.time + CREEP_LIFE_TIME;
    this.targetBeeCount = 2;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyparts(HEAL))
      this.healer = bee;
    else
      this.tank = bee;
    this.destroyTime = Math.max(this.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME);
  }

  update() {
    super.update();

    if (Game.time % 50 == 0) {
      let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

      // this stupid tatic was countered
      if (!roomInfo.safePlace)
        this.destroyTime = Game.time;
    }

    if (this.phase == "spawning") {
      this.phase = "meeting";
      if (!this.tank && !this.healer) {
        let tankOrder: SpawnOrder = {
          master: this.ref,
          setup: Setups.tank,
          amount: 1,
          priority: 1,
        };
        this.wish(tankOrder);
        let healerOrder: SpawnOrder = {
          master: this.ref,
          setup: Setups.healer,
          amount: 1,
          priority: 1,
        };
        this.wish(healerOrder);
      }
    }
  }

  run() {
    if (this.tank && this.healer)
      if (this.phase == "meeting") {
        this.tank.goTo(this.order.pos);
        this.healer.goTo(this.tank.pos);
        if (this.healer.pos.isNearTo(this.order.pos)) {
          if (VISUALS_ON) {
            this.tank.creep.say("⚡");
            this.healer.creep.say("⚡");
          }
          this.phase = "draining";
        }
      } else if (this.phase = "draining") {
        if (!this.exit)
          this.exit = this.tank.pos.findClosest(this.tank.creep.room.find(FIND_EXIT));
        if (!this.target && this.tank.creep.room.name != this.order.pos.roomName)
          this.target = this.tank.creep.room.name;

        if (this.tank.creep.hits <= this.tank.creep.hitsMax * 0.6 || this.healing) {
          if (VISUALS_ON && !this.healing) {
            this.tank.creep.say("🏥");
            this.healer.creep.say("🏥");
          }
          this.healing = true;
          if (!this.tank.pos.isNearTo(this.healer))
            this.tank.goTo(this.healer.pos);
          if (this.tank.creep.hits == this.tank.creep.hitsMax) {
            if (VISUALS_ON) {
              this.tank.creep.say("⚡");
              this.healer.creep.say("⚡");
            }
            this.healing = false;
          }

          if (this.healer.pos.isNearTo(this.tank))
            this.healer.heal(this.tank);
          else if (this.healer.pos.getRangeTo(this.tank) <= 3)
            this.healer.rangedHeal(this.tank);
        }

        if (!this.healing) {
          if (this.target)
            this.tank.goToRoom(this.target);
          else if (this.exit)
            this.tank.goTo(this.exit);
        }
      }
  }
}

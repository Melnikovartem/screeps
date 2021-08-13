import { Bee } from "../../bee"
import { Setups } from "../../creepSetups"
import type { SpawnOrder, Hive } from "../../Hive";
import { Order } from "../../order";
import { SwarmMaster } from "../_SwarmMaster";

import { VISUALS_ON } from "../../settings"
import { profile } from "../../profiler/decorator";

//first tandem btw
@profile
export class drainerMaster extends SwarmMaster {
  healer: Bee | undefined;
  tank: Bee | undefined;
  phase: "spawning" | "meeting" | "draining" = "spawning";

  // for last stage
  meetingPoint: RoomPosition;
  exit: RoomPosition | undefined;
  target: string | undefined;
  healing: boolean = false;

  constructor(hive: Hive, order: Order) {
    super(hive, order);

    this.meetingPoint = order.pos;
    // sad cause safeMode saves from this shit
    this.order.destroyTime = Game.time + CREEP_LIFE_TIME;
    this.targetBeeCount = 2;
  }

  newBee(bee: Bee) {
    super.newBee(bee);
    if (bee.creep.getBodyparts(HEAL))
      this.healer = bee;
    else
      this.tank = bee;
    this.order.destroyTime = Math.max(this.order.destroyTime, this.lastSpawns[0] + CREEP_LIFE_TIME + 150);
  }

  update() {
    super.update();

    if (this.phase == "draining" && (!this.tank || !this.healer))
      this.order.destroyTime = Game.time;

    if (this.meetingPoint != this.order.pos) {
      this.phase = "meeting";
      this.exit = undefined;
      this.healing = false;
      this.target = undefined;
      if (this.tank && this.healer && VISUALS_ON) {
        this.tank.creep.say("➡️");
        this.healer.creep.say("➡️");
      }
    }

    if (Game.time % 50 == 0) {
      let roomInfo = global.Apiary.intel.getInfo(this.order.pos.roomName);

      // this stupid tatic was countered
      if (!roomInfo.safePlace)
        this.order.destroyTime = Game.time;
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
        this.tank.goTo(this.meetingPoint);
        this.healer.goTo(this.meetingPoint);
        if (this.healer.pos.isNearTo(this.meetingPoint) && this.tank.pos.isNearTo(this.meetingPoint)) {
          if (VISUALS_ON) {
            this.tank.creep.say("⚡");
            this.healer.creep.say("⚡");
          }
          this.phase = "draining";
        }
      } else if (this.phase == "draining") {
        if (!this.exit)
          this.exit = <RoomPosition>this.tank.pos.findClosest(this.tank.creep.room.find(FIND_EXIT));
        if (!this.target && this.tank.creep.room.name != this.order.pos.roomName)
          this.target = this.tank.creep.room.name;

        if (this.tank.creep.hits <= this.tank.creep.hitsMax * 0.65 || this.healing) {
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
          if (this.target) {
            if (this.tank.pos.roomName != this.target)
              this.tank.goToRoom(this.target);
            else {
              let roomInfo = global.Apiary.intel.getInfo(this.target);

              if (roomInfo.enemies.length)
                this.tank.attack(this.tank.pos.findClosest(roomInfo.enemies)!);
            }
          }
          else if (this.exit)
            this.tank.goTo(this.exit);
        }
      }
  }
}

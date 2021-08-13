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

    if (this.tank && !global.bees[this.tank.ref])
      delete this.tank;

    if (this.healer && !global.bees[this.healer.ref])
      delete this.tank;

    if (this.phase != "spawning" && (!this.tank || !this.healer))
      this.order.destroyTime = Game.time;

    if (this.meetingPoint.x != this.order.pos.x || this.meetingPoint.y != this.order.pos.y) {
      this.meetingPoint = this.order.pos;
      this.phase = "meeting";
      this.exit = undefined;
      this.healing = false;
      this.target = undefined;
      if (this.tank && this.healer && VISUALS_ON) {
        this.tank.creep.say("➡️");
        this.healer.creep.say("➡️");
      }
    }

    if (this.phase == "spawning") {
      this.phase = "meeting";
      if (!this.tank) {
        let tankOrder: SpawnOrder = {
          master: this.ref,
          setup: Setups.tank,
          amount: 1,
          priority: 1,
        };
        this.wish(tankOrder);
      }
      if (!this.healer) {
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
        this.healer.goTo(this.meetingPoint);
        this.tank.goTo(this.meetingPoint.getOpenPositions()[0]);
        if (this.healer.pos.x == this.meetingPoint.x && this.healer.pos.y == this.meetingPoint.y
          && this.tank.pos.isNearTo(this.meetingPoint)) {
          this.phase = "draining";
          if (VISUALS_ON) {
            this.tank.creep.say("⚡");
            this.healer.creep.say("⚡");
          }
        }
      } else if (this.phase == "draining") {
        if (!this.exit)
          this.exit = <RoomPosition>this.tank.pos.findClosest(this.tank.creep.room.find(FIND_EXIT));
        if (!this.target && this.tank.creep.room.name != this.order.pos.roomName)
          this.target = this.tank.creep.room.name;

        if (this.tank.creep.hits <= this.tank.creep.hitsMax * 0.5 || this.healing) {
          if (VISUALS_ON && !this.healing) {
            this.tank.creep.say("🏥");
            this.healer.creep.say("🏥");
          }
          this.healing = true;
          if (!this.tank.pos.isNearTo(this.healer))
            this.tank.goTo(this.healer.pos);
          if (this.tank.creep.hits == this.tank.creep.hitsMax) {
            this.healing = false;
            if (VISUALS_ON) {
              this.tank.creep.say("⚡");
              this.healer.creep.say("⚡");
            }
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

              // not sure what to do if there will be smart towers
              if (roomInfo.enemies.length)
                if (roomInfo.enemies[0] instanceof StructureTower && roomInfo.enemies[0].store[RESOURCE_ENERGY] > 0) {
                  if (this.tank.pos.x == 0 || this.tank.pos.x == 49 || this.tank.pos.y == 0 || this.tank.pos.y == 49)
                    this.tank.goToRoom(this.target);
                } else
                  this.tank.attack(this.tank.pos.findClosest(roomInfo.enemies)!)
            }
          }
          else if (this.exit)
            this.tank.goTo(this.exit);
        }
      }
  }
}

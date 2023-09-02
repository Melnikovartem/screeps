import { setups } from "../../bees/creepSetups";
import type { FlagOrder } from "../../orders/order";
import { profile } from "../../profiler/decorator";
import { signText } from "../../static/enums";
import { SwarmMaster } from "../_SwarmMaster";

@profile
export class DowngradeMaster extends SwarmMaster {
  // #region Properties (1)

  public lastAttacked: number = Game.time - CONTROLLER_ATTACK_BLOCKED_UPGRADE;

  // #endregion Properties (1)

  // #region Constructors (1)

  public constructor(order: FlagOrder) {
    super(order);
    this.maxSpawns = 100;
  }

  // #endregion Constructors (1)

  // #region Public Accessors (2)

  public get oldestSpawn() {
    return this.order.memory.extraInfo as number;
  }

  public set oldestSpawn(value) {
    if (this.order) this.order.memory.extraInfo = value;
  }

  // #endregion Public Accessors (2)

  // #region Public Methods (2)

  public run() {
    _.forEach(this.activeBees, (bee) => {
      if (
        this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE >
          Game.time + bee.ticksToLive &&
        bee.pos.roomName === this.pos.roomName
      ) {
        const room = Game.rooms[bee.pos.roomName];
        const cc = bee.pos.findClosest(
          room.find(FIND_HOSTILE_CONSTRUCTION_SITES).filter((c) => c.progress)
        );
        if (cc) bee.goTo(cc);
      } else if (!bee.pos.isNearTo(this.pos)) bee.goTo(this.pos);
      else if (
        Game.time >=
        this.lastAttacked + CONTROLLER_ATTACK_BLOCKED_UPGRADE
      ) {
        const room = Game.rooms[this.pos.roomName];
        if (room && room.controller) {
          const ans = bee.attackController(room.controller);
          if (ans === OK) {
            bee.creep.signController(room.controller, signText.other);
            bee.creep.say("💥");
          }
        }
      }
      this.checkFlee(bee, { pos: this.pos }, undefined, false);
    });
  }

  public update() {
    super.update();

    const roomInfo = Apiary.intel.getInfo(this.pos.roomName, Infinity);
    if (!roomInfo.currentOwner || roomInfo.currentOwner === Apiary.username) {
      this.order.delete();
      return;
    }

    const room = Game.rooms[this.pos.roomName];
    if (room && room.controller) {
      this.lastAttacked =
        Game.time -
        CONTROLLER_ATTACK_BLOCKED_UPGRADE +
        (room.controller.upgradeBlocked || 0);
      if (!room.controller.owner) {
        this.order.delete();
        return;
      }
      if (Game.time % 25 === 0)
        this.hive.cells.defense.checkAndDefend(this.pos.roomName);
    }

    if (
      this.checkBees(false, CONTROLLER_ATTACK_BLOCKED_UPGRADE - 50) &&
      this.hive.resState[RESOURCE_ENERGY] > 0 &&
      Game.time + CREEP_CLAIM_LIFE_TIME > roomInfo.safeModeEndTime &&
      !roomInfo.towers.length
    )
      this.wish({
        setup: setups.downgrader,
        priority: 9,
      });
  }

  // #endregion Public Methods (2)
}

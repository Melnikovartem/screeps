import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";

@profile
export class DepositPickupMaster extends Master {
  public movePriority = 4 as const;
  private parent: DepositMaster;

  public constructor(parent: DepositMaster) {
    super(parent.hive, parent.order.ref + "_" + prefix.pickup);
    this.parent = parent;
  }

  private get setup() {
    const setup = setups.pickup.copy();
    if (this.parent.decay)
      setup.patternLimit = Math.ceil(
        10 *
          Math.max(
            1,
            (this.parent.rate * this.parent.roadTime * 2) / CARRY_CAPACITY / 10,
            (this.parent.positions.length * this.parent.workAmount * 3) /
              CARRY_CAPACITY /
              10
          )
      );
    else setup.patternLimit = 15;
    return setup;
  }

  private recalculateTargetBee() {
    const body = this.setup.getBody(
      this.hive.room.energyCapacityAvailable
    ).body;
    const carry = body.filter((b) => b === CARRY).length * CARRY_CAPACITY;
    this.targetBeeCount = Math.max(
      1,
      Math.round((this.parent.rate * this.parent.roadTime) / carry)
    );
  }

  public checkBees = () => {
    const check = () =>
      super.checkBees(true, CREEP_LIFE_TIME - this.parent.roadTime * 2);
    if (this.targetBeeCount && !check()) return false;
    this.recalculateTargetBee();
    return (
      check() &&
      !!this.parent.miners.beesAmount &&
      (this.parent.shouldSpawn ||
        !!_.filter(
          this.parent.miners.bees,
          (b) => b.ticksToLive > CREEP_LIFE_TIME / 2
        ).length)
    );
  };

  public update() {
    super.update();
    if (this.checkBees())
      this.wish({
        setup: this.setup,
        priority: 6,
      });
  }

  public run() {
    let pickingup = false;
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill:
          if (bee.pos.roomName !== this.parent.pos.roomName) {
            bee.goTo(this.parent.rest, { offRoad: true });
            if (bee.ticksToLive < this.parent.roadTime)
              bee.state = bee.store.getUsedCapacity()
                ? beeStates.work
                : beeStates.fflush;
            break;
          }
          if (!bee.store.getFreeCapacity()) {
            bee.state = beeStates.work;
            bee.goTo(this.hive.cells.storage!);
            break;
          }
          if (pickingup) {
            bee.goTo(this.parent.rest, {
              offRoad: true,
              obstacles: this.parent.positions,
            });
            break;
          }
          pickingup = true;
          let overproduction: undefined | Resource;
          _.some(this.parent.positions, (p) => {
            overproduction = p.pos
              .lookFor(LOOK_RESOURCES)
              .filter((r) => r.resourceType !== RESOURCE_ENERGY)[0];
            return overproduction;
          });
          if (overproduction) {
            bee.pickup(overproduction);
            break;
          }
          let tomb: undefined | Tombstone;
          _.some(this.parent.positions, (p) => {
            tomb = p.pos
              .lookFor(LOOK_TOMBSTONES)
              .filter(
                (t) =>
                  t.store.getUsedCapacity() >
                  t.store.getUsedCapacity(RESOURCE_ENERGY)
              )[0];
            return tomb;
          });
          if (tomb) {
            bee.withdraw(
              tomb,
              Object.keys(tomb.store).filter(
                (r) => r !== RESOURCE_ENERGY
              )[0] as ResourceConstant
            );
            break;
          }
          const beeToPickUp = this.parent.miners.activeBees.filter(
            (b) => b.store.getUsedCapacity() > 0
          )[0];
          if (beeToPickUp) {
            if (bee.pos.isNearTo(beeToPickUp))
              beeToPickUp.creep.transfer(
                bee.creep,
                findOptimalResource(beeToPickUp.store)
              );
            else
              bee.goTo(beeToPickUp, {
                ignoreRoads: true,
                obstacles: this.parent.positions,
              });
            break;
          }
          bee.goTo(this.parent.rest, {
            offRoad: true,
            obstacles: this.parent.positions,
          });
          if (
            bee.ticksToLive < this.parent.roadTime + 50 ||
            bee.store.getFreeCapacity() <
              this.parent.positions.length * this.parent.workAmount
          )
            bee.state = bee.store.getUsedCapacity()
              ? beeStates.work
              : beeStates.fflush;
          break;
        case beeStates.work:
          if (
            this.hive.cells.defense.timeToLand < 50 &&
            bee.ticksToLive > 50 &&
            bee.pos.getRoomRangeTo(this.hive) === 1
          ) {
            bee.fleeRoom(this.roomName);
            break;
          }
          if (
            !bee.store.getUsedCapacity() ||
            (bee.transfer(
              this.hive.cells.storage!.storage,
              findOptimalResource(bee.store)
            ) === OK &&
              Object.keys(bee.store).length < 2)
          ) {
            bee.state = beeStates.chill;
            bee.goTo(this.parent.rest, {
              offRoad: true,
              obstacles: this.parent.positions,
            });
          }
          break;
        case beeStates.fflush:
          this.removeBee(bee);
          break;
      }
      this.checkFlee(bee, undefined, undefined, false);
    });
  }
}

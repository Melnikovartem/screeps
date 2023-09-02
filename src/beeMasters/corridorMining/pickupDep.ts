import { setups } from "bees/creepSetups";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";
import { findOptimalResource } from "static/utils";

import { Master } from "../_Master";
import type { DepositMaster } from "./deposit";

@profile
export class DepositPickupMaster extends Master<DepositMaster> {
  // #region Properties (4)

  private carryAmount: number;
  private rest: RoomPosition;

  public movePriority = 4 as const;

  // #endregion Properties (4)

  // #region Constructors (1)

  public constructor(parent: DepositMaster) {
    super(parent, prefix.pickupDep + parent.parent.ref);
    const body = this.setup.getBody(
      this.hive.room.energyCapacityAvailable
    ).body;
    this.carryAmount = body.filter((b) => b === CARRY).length * CARRY_CAPACITY;

    // where to wait for pickup
    this.rest = new RoomPosition(25, 25, this.pos.roomName).findClosest(
      this.pos.getOpenPositions(true, 2).filter((p) => p.getRangeTo(this) > 1)
    )!;
  }

  // #endregion Constructors (1)

  // #region Private Accessors (1)

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

  // #endregion Private Accessors (1)

  // #region Public Methods (2)

  public run() {
    // pikcup overproduction
    let overproduction: undefined | Resource;
    // look for battle signs and pickup loot for killed harvesters
    let tomb: undefined | Tombstone;
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill: {
          if (bee.pos.roomName !== this.roomName) {
            bee.goTo(this.rest, { offRoad: true });
            if (bee.ticksToLive < this.parent.roadTime + 10)
              bee.state = bee.store.getUsedCapacity()
                ? beeStates.work
                : beeStates.fflush;
            break;
          }

          if (!bee.store.getFreeCapacity()) {
            // go home
            bee.state = beeStates.work;
            bee.goTo(this.hive.cells.storage!);
            break;
          }

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

          // withdraw from miner
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

          // wait for resources
          bee.goTo(this.rest, {
            offRoad: true,
            obstacles: this.parent.positions,
          });

          // send home early
          if (
            bee.ticksToLive < this.parent.roadTime + 50 ||
            bee.store.getFreeCapacity() <
              this.parent.positions.length * this.parent.workAmount
          )
            bee.state = bee.store.getUsedCapacity()
              ? beeStates.work
              : beeStates.fflush;
          break;
        }
        case beeStates.work: {
          if (
            this.hive.cells.defense.timeToLand < 50 &&
            bee.ticksToLive > 50 &&
            bee.pos.getRoomRangeTo(this.hive) === 1
          ) {
            bee.fleeRoom(this.hiveName);
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
            // emptied storage can go back
            bee.state = beeStates.chill;
            bee.goTo(this.rest, {
              offRoad: true,
              obstacles: this.parent.positions,
            });
          }
          break;
        }
        case beeStates.fflush:
          this.recycleBee(bee);
          break;
      }
      this.checkFlee(bee, undefined, undefined, false);
    });
  }

  public override update() {
    super.update();
    if (!this.checkBees(false, CREEP_LIFE_TIME - this.parent.roadTime * 2))
      return;
    if (!this.parent.miners.beesAmount) return;

    const minersReady = _.filter(
      this.parent.miners.bees,
      (b) => b.ticksToLive > CREEP_LIFE_TIME / 2
    ).length;
    if (!this.parent.shouldSpawn && !minersReady) return;
    this.wish({
      setup: this.setup,
      priority: 6,
    });
  }

  // #endregion Public Methods (2)

  // #region Private Methods (1)

  public override get targetBeeCount(): number {
    return Math.max(
      1,
      Math.round((this.parent.rate * this.parent.roadTime) / this.carryAmount)
    );
  }

  // #endregion Private Methods (1)
}

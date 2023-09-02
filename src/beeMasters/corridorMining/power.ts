import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { beeStates } from "static/enums";
import { makeId } from "static/utils";

import { SwarmMaster } from "../_SwarmMaster";

interface PowerInfo {
  roadTime: number;
  hits: number;
  decay: number;
  power: number;
}

// first tandem btw
@profile
export class PowerMaster extends SwarmMaster<PowerInfo> {
  // constructor
  public constructor(order: SwarmOrder<PowerInfo>) {
    super(order);
    this.corridorMining?.powerSites.push(this);
    this.positions = this.pos.getOpenPositions(true).map((p) => {
      return { pos: p };
    });
    if (this.pos.roomName in Game.rooms) this.updateTarget();
  }
  // implementation block
  public movePriority = 1 as const;
  public get targetBeeCount() {
    return this.positions.length * 2;
  }
  public get maxSpawns() {
    return this.info.hits >= 0 ? Infinity : 0;
  }
  public defaultInfo() {
    return {
      roadTime: this.pos.getTimeForPath(this.hive),
      hits: 0,
      decay: Game.time,
      power: 0,
    };
  }

  // extra overload block
  public checkBees = () => {
    return (
      this.shouldSpawn &&
      super.checkBees(true, CREEP_LIFE_TIME - this.info.roadTime - 30)
    );
  };
  public newBee = (bee: Bee) => {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL)) this.healers.push(bee);
    else this.knights.push(bee);
  };
  public deleteBee = (ref: string) => {
    super.deleteBee(ref);
    for (let i = 0; i < this.healers.length; ++i)
      if (this.healers[i].ref === ref) {
        this.healers.splice(i, 1);
        --i;
      }
    for (let i = 0; i < this.knights.length; ++i)
      if (this.knights[i].ref === ref) {
        this.knights.splice(i, 1);
        --i;
      }
  };
  public delete() {
    super.delete();
    if (this.corridorMining) {
      const index = this.corridorMining.powerSites.indexOf(this);
      if (index !== -1) this.corridorMining.powerSites.splice(index, 1);
    }
  }

  // methods/attributes to help with logic
  private duplets: [Bee | undefined, Bee | undefined][] = [];
  private healers: Bee[] = [];
  private knights: Bee[] = [];
  private target: StructurePowerBank | undefined;
  private positions: { pos: RoomPosition }[];

  private get corridorMining() {
    return this.hive.puller;
  }

  public get pickupTime() {
    // spawn time (halfed + roadTime)
    return (
      Math.ceil(
        (this.info.power / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)) * 0.5
      ) *
        MAX_CREEP_SIZE *
        CREEP_SPAWN_TIME +
      this.info.roadTime
    );
  }

  public get shouldSpawn() {
    // already mined out
    if (this.info.hits < 0) return false;
    // decision gods said no!
    if (!this.corridorMining?.sitesON.includes(this)) return false;

    const dmgFuture =
      ATTACK_POWER *
      20 *
      _.sum(this.duplets, (dd) =>
        !dd[0]
          ? 0
          : Math.min(
              this.info.decay,
              dd[0].ticksToLive -
                (dd[0].pos.isNearTo(this) ? 0 : this.info.roadTime)
            )
      );
    // already enough dmg to mine out
    if (this.info.hits - dmgFuture <= 0) return false;
    // wont be in time for decay
    if (
      this.info.decay <
      this.info.roadTime + MAX_CREEP_SIZE * CREEP_SPAWN_TIME
    )
      return false;
    const dmgPerSecond = ATTACK_POWER * 20 * this.positions.length;
    // do i have enough dmg to kill in time?
    return (
      this.info.hits / dmgPerSecond <=
      this.info.decay - (this.activeBees.length ? 0 : this.info.roadTime)
    );
  }

  public updateTarget() {
    this.target = this.pos
      .lookFor(LOOK_STRUCTURES)
      .filter((s) => s.structureType === STRUCTURE_POWER_BANK)[0] as
      | StructurePowerBank
      | undefined;
    if (this.target) {
      this.info.hits = this.target.hits;
      this.info.decay = this.target.ticksToDecay;
      this.info.power = this.target.power;

      const dmgCurrent =
        _.sum(this.duplets, (dd) =>
          dd[0] && dd[0].pos.isNearTo(this) ? 1 : 0
        ) *
        ATTACK_POWER *
        20;
      if (this.info.hits / dmgCurrent <= this.pickupTime) this.callPickUp();
      return;
    }

    const res = this.pos.lookFor(LOOK_RESOURCES)[0];
    if (res) {
      this.info.power = res.amount;
      this.callPickUp();
    }
    this.info.hits = -1;
    if (!this.pos.isFree(true))
      this.parent.pos = new RoomPosition(
        Math.floor(Math.random() * 50),
        Math.floor(Math.random() * 50),
        this.roomName
      );
  }

  public createDuplet(knight: Bee) {
    let goodHealers;
    if (knight.target) goodHealers = [this.bees[knight.target]];
    else
      goodHealers = this.healers.filter(
        (h) =>
          Math.abs(h.ticksToLive - knight.ticksToLive) <
            Math.min(CREEP_LIFE_TIME / 2, this.info.roadTime * 3) &&
          (!h.target || !this.bees[h.target])
      );
    const healer = knight.pos.findClosest(goodHealers) as Bee | undefined;
    if (healer || knight.ticksToLive < this.info.roadTime || knight.target) {
      knight.target = "None";
      if (healer) {
        healer.target = knight.ref;
        knight.target = healer.ref;
        const healerIndex = this.healers.indexOf(healer);
        this.healers.splice(healerIndex, 1);
      }
      const knightIndex = this.knights.indexOf(knight);
      this.knights.splice(knightIndex, 1);
      this.duplets.push([knight, healer]);
      return true;
    }
    return false;
  }

  private callPickUp() {
    if (
      this.pos
        .lookFor(LOOK_FLAGS)
        .filter(
          (f) => f.color === COLOR_ORANGE && f.secondaryColor === COLOR_GREEN
        ).length
    )
      return;
    const name = this.pos.createFlag(
      Math.ceil(this.info.power / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)) +
        "_pickup_" +
        makeId(4),
      COLOR_ORANGE,
      COLOR_GREEN
    );
    if (typeof name === "string") Game.flags[name].memory.hive = this.hiveName;
  }

  // update - run
  public update() {
    super.update();

    for (let i = 0; i < this.knights.length; ++i)
      if (this.createDuplet(this.knights[i])) --i;

    for (const dup of this.duplets) {
      const [knight, healer] = dup;
      if (knight) dup[0] = this.bees[knight.ref];
      if (healer) dup[1] = this.bees[healer.ref];
    }

    if (this.pos.roomName in Game.rooms) this.updateTarget();
    else {
      this.target = undefined;
      if (this.info.hits <= 0 && this.hive.cells.observe)
        Apiary.requestSight(this.pos.roomName);
    }

    if (this.info.decay < -100) {
      this.parent.delete();
      return;
    }

    if (this.checkBees()) {
      const balance =
        this.healers.filter((b) => b.ticksToLive > this.info.roadTime * 2)
          .length -
        this.knights.filter((b) => b.ticksToLive > this.info.roadTime * 2)
          .length;
      if (balance <= 0)
        this.wish({
          setup: setups.miner.powerhealer,
          priority: 7,
        });
      if (balance >= 0)
        this.wish({
          setup: setups.miner.power,
          priority: 7,
        });
    }
  }

  public run() {
    _.forEach(this.activeBees, (bee) => {
      switch (bee.state) {
        case beeStates.chill:
          if (!bee.target) bee.goRest(this.hive.rest);
          break;
      }
    });

    _.forEach(this.duplets, (couple) => {
      const [knight, healer] = couple;

      if (
        knight &&
        healer &&
        (knight.state !== beeStates.work || healer.state !== beeStates.work)
      ) {
        if (
          (knight.pos.isNearTo(healer) ||
            (knight.pos.enteranceToRoom &&
              knight.pos.enteranceToRoom.isNearTo(healer))) &&
          !knight.creep.spawning &&
          !healer.creep.spawning
        ) {
          knight.state = beeStates.work;
          healer.state = beeStates.work;
        } else {
          knight.goTo(healer.pos, { range: 1 });
          healer.goTo(knight.pos, { range: 1 });
          return;
        }
      }

      let chill = false;
      if (knight && knight.state === beeStates.work) {
        let target: Creep | PowerCreep | Structure | undefined;
        if (knight.pos.roomName === this.pos.roomName && this.target)
          target = this.target;
        const enemy = Apiary.intel.getEnemy(knight.pos, 20);
        if (
          (enemy && knight.pos.getRangeTo(enemy) < 3) ||
          (knight.pos.roomName === this.pos.roomName && !target)
        )
          target = enemy;
        if (target) {
          if (target instanceof StructurePowerBank) {
            if (
              !healer ||
              healer.pos.isNearTo(knight) ||
              knight.pos.x <= 1 ||
              knight.pos.x >= 48 ||
              knight.pos.y <= 1 ||
              knight.pos.y >= 48
            )
              if (healer && !knight.pos.isNearTo(this)) {
                const pos =
                  knight.pos.getRangeTo(this.pos) > 5
                    ? this.pos
                    : this.positions.filter(
                        (p) =>
                          !this.activeBees.filter(
                            (b) =>
                              b.pos.equal(p) && b.getActiveBodyParts(ATTACK)
                          ).length
                      )[0];
                if (pos)
                  knight.goTo(pos, {
                    useFindRoute: true,
                    obstacles: this.positions.filter((p) => !p.pos.equal(pos)),
                  });
                else {
                  knight.goTo(this.pos, { range: 3 });
                  chill = true;
                }
              } else if (knight.hits > knight.hitsMax * 0.5)
                knight.attack(target);
              else if (!healer && !this.pos.getOpenPositions(false).length)
                if (knight.getActiveBodyParts(ATTACK)) knight.attack(target);
                else knight.creep.suicide();
          } else knight.attack(target);
        } else if (knight.hits === knight.hitsMax)
          knight.goRest(this.pos, { useFindRoute: true });
      }

      if (healer && healer.state === beeStates.work) {
        if (healer.hits < healer.hitsMax) healer.heal(healer);
        if (knight) {
          if (knight.hits < knight.hitsMax || knight.pos.isNearTo(this))
            if (healer.pos.isNearTo(knight)) healer.heal(knight);
            else healer.rangedHeal(knight);
        } else {
          const healingTarget = healer.pos.findClosest(
            _.filter(
              healer.pos.findInRange(FIND_MY_CREEPS, 3),
              (bee) => bee.hits < bee.hitsMax
            )
          );
          if (healingTarget) {
            if (healer.pos.isNearTo(healingTarget)) healer.heal(healingTarget);
            else healer.rangedHeal(healingTarget);
          }
        }
        if (!healer.targetPosition)
          if (knight) {
            if (!healer.pos.isNearTo(knight))
              healer.goTo(knight.pos, { movingTarget: true });
            else if (knight.pos.isNearTo(this)) {
              let poss;
              if (healer.pos.isNearTo(this))
                poss = knight.pos.getOpenPositions(true);
              if (poss && poss.length)
                healer.goTo(
                  poss.reduce((prev, curr) =>
                    curr.getRangeTo(this) > prev.getRangeTo(this) ? curr : prev
                  ),
                  { obstacles: this.positions }
                );
              else healer.goRest(knight.pos);
            } else if (!chill) healer.goTo(knight.pos);
          } else healer.goRest(this.pos, { range: 3 });
      }
    });
  }
}

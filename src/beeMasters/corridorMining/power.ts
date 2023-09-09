import type { PickupInfo } from "beeMasters/civil/pickup";
import type { Bee } from "bees/bee";
import { setups } from "bees/creepSetups";
import { SWARM_MASTER } from "orders/swarm-nums";
import type { SwarmOrder } from "orders/swarmOrder";
import { profile } from "profiler/decorator";
import { beeStates, prefix } from "static/enums";

import { SwarmMaster } from "../_SwarmMaster";

interface PowerInfo {
  // #region Properties (4)

  dc: number;
  // decay
  ht: number;
  // hits left
  pw: number;
  // power amount
  rt: number;

  // #endregion Properties (4)
  // roadTime
}

// first tandem btw
@profile
export class PowerMiningMaster extends SwarmMaster<PowerInfo> {
  // #region Properties (9)

  private duplets: [Bee | undefined, Bee | undefined][] = [];
  private healers: Bee[] = [];
  private knights: Bee[] = [];
  private positions: { pos: RoomPosition }[];
  private target: StructurePowerBank | undefined;

  public override checkBees = () => {
    return (
      this.shouldSpawn &&
      super.checkBees(true, CREEP_LIFE_TIME - this.roadTime - 30)
    );
  };
  public override deleteBee = (ref: string) => {
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
  public movePriority = 1 as const;
  public override newBee = (bee: Bee) => {
    super.newBee(bee);
    if (bee.creep.getBodyParts(HEAL)) this.healers.push(bee);
    else this.knights.push(bee);
  };

  // #endregion Properties (9)

  // #region Constructors (1)

  public constructor(order: SwarmOrder<PowerInfo>) {
    super(order);
    this.sitesAll.push(this);
    this.positions = this.pos.getOpenPositions().map((p) => {
      return { pos: p };
    });
    this.updateTarget();
  }

  // #endregion Constructors (1)

  // #region Public Accessors (6)

  public get decay() {
    return this.info.dc;
  }

  public get hits() {
    return this.info.ht;
  }

  public get maxSpawns() {
    return this.hits >= 0 ? Infinity : 0;
  }

  public get roadTime() {
    return this.info.rt;
  }

  public get shouldSpawn() {
    // already mined out
    if (this.hits < 0) return false;
    // decision gods said no!
    if (!this.sitesOn.includes(this)) return false;
    return this.canMineInTime();
  }

  public get targetBeeCount() {
    return this.positions.length * 2;
  }

  // #endregion Public Accessors (6)

  // #region Private Accessors (2)

  private get sitesAll() {
    // JS gods said i can push/splice this :/ and original will change
    return this.hive.cells.corridorMining?.powerSites || [];
  }

  private get sitesOn() {
    return this.hive.cells.corridorMining?.powerOn || [];
  }

  // #endregion Private Accessors (2)

  // #region Public Methods (7)

  public canMineInTime() {
    const dmgFuture =
      ATTACK_POWER *
      20 *
      _.sum(this.duplets, (dd) =>
        !dd[0]
          ? 0
          : Math.min(
              this.decay,
              dd[0].ticksToLive - (dd[0].pos.isNearTo(this) ? 0 : this.roadTime)
            )
      );
    // already enough dmg to mine out
    if (this.hits - dmgFuture <= 0) return false;
    // wont be in time for decay
    if (this.decay < this.roadTime + MAX_CREEP_SIZE * CREEP_SPAWN_TIME)
      return false;
    const dmgPerSecond = ATTACK_POWER * 20 * this.positions.length;
    // do i have enough dmg to kill in time?
    return (
      this.hits / dmgPerSecond <=
      this.decay - (this.activeBees.length ? 0 : this.roadTime)
    );
  }

  public createDuplet(knight: Bee) {
    let goodHealers;
    if (knight.target) goodHealers = [this.bees[knight.target]];
    else
      goodHealers = this.healers.filter(
        (h) =>
          Math.abs(h.ticksToLive - knight.ticksToLive) <
            Math.min(CREEP_LIFE_TIME / 2, this.roadTime * 3) &&
          (!h.target || !this.bees[h.target])
      );
    const healer = knight.pos.findClosest(goodHealers) as Bee | undefined;
    if (healer || knight.ticksToLive < this.roadTime || knight.target) {
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

  public defaultInfo() {
    return {
      rt: this.pos.getTimeForPath(this.hive),
      ht: 0,
      dc: Game.time,
      pw: 0,
    };
  }

  public override delete() {
    super.delete();
    const index = this.sitesAll.indexOf(this);
    if (index && index !== -1) this.sitesAll.splice(index, 1);
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
        if (knight.pos.roomName === this.roomName && this.target)
          target = this.target;
        const enemy = Apiary.intel.getEnemy(knight.pos, 20);
        if (
          (enemy && knight.pos.getRangeTo(enemy) < 3) ||
          (knight.pos.roomName === this.roomName && !target)
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
              else if (!healer && !this.pos.getOpenPositions(true).length)
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
                poss = knight.pos.getOpenPositions();
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

  // update - run
  public override update() {
    super.update();

    for (let i = 0; i < this.knights.length; ++i)
      if (this.createDuplet(this.knights[i])) --i;

    for (const dup of this.duplets) {
      const [knight, healer] = dup;
      if (knight) dup[0] = this.bees[knight.ref];
      if (healer) dup[1] = this.bees[healer.ref];
    }

    this.updateTarget();

    if (this.decay < -100) {
      this.parent.delete();
      return;
    }

    if (this.checkBees()) {
      const balance =
        this.healers.filter((b) => b.ticksToLive > this.roadTime * 2).length -
        this.knights.filter((b) => b.ticksToLive > this.roadTime * 2).length;
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

  public updateTarget() {
    if (!(this.roomName in Game.rooms)) {
      this.target = undefined;
      if (this.hits <= 0 && this.hive.cells.observe)
        Apiary.oracle.requestSight(this.roomName);
      return;
    }

    this.target = this.pos
      .lookFor(LOOK_STRUCTURES)
      .filter((s) => s.structureType === STRUCTURE_POWER_BANK)[0] as
      | StructurePowerBank
      | undefined;
    if (this.target) {
      this.info.ht = this.target.hits;
      this.info.dc = this.target.ticksToDecay;
      this.info.pw = this.target.power;

      const dmgCurrent =
        _.sum(this.duplets, (dd) =>
          dd[0] && dd[0].pos.isNearTo(this) ? 1 : 0
        ) *
        ATTACK_POWER *
        20;
      if (this.target.hits / dmgCurrent <= this.pickupTime()) this.callPickUp();
      return;
    }

    const res = this.pos.lookFor(LOOK_RESOURCES)[0];
    if (res) {
      this.info.pw = res.amount;
      this.callPickUp();
    }
    this.info.ht = -1;
    if (!this.pos.isFree())
      this.parent.setPosition(
        new RoomPosition(
          Math.floor(Math.random() * 50),
          Math.floor(Math.random() * 50),
          this.roomName
        )
      );
  }

  // #endregion Public Methods (7)

  // #region Private Methods (2)

  private callPickUp() {
    const ref = prefix.pickup + this.ref;
    if (Apiary.orders[ref]) return;
    // carry all power in one go
    this.hive.createSwarm<PickupInfo>(ref, this.pos, SWARM_MASTER.pickup, {
      tc: Math.ceil(this.info.pw / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)),
    });
  }

  private pickupTime() {
    // spawn time (halfed + roadTime)
    return (
      Math.ceil(
        (this.info.pw / ((MAX_CREEP_SIZE * CARRY_CAPACITY) / 2)) * 0.5
      ) *
        MAX_CREEP_SIZE *
        CREEP_SPAWN_TIME +
      this.roadTime
    );
  }

  // #endregion Private Methods (2)
}

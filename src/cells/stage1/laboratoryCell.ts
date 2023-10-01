import type { Bee } from "bees/bee";
import type { Hive } from "hive/hive";
import { profile } from "profiler/decorator";
import type { ApiaryReturnCode } from "static/constants";
import { ERR_COOLDOWN, ERR_INVALID_ACTION } from "static/constants";
import { hiveStates, prefix } from "static/enums";

import { CellWithTarget, PRODUCTION_COOLDOWNS } from "./cellWithTarget";

export type ReactionConstant =
  | "G"
  | "OH"
  | "ZK"
  | "UL"
  | "LH"
  | "ZH"
  | "GH"
  | "KH"
  | "UH"
  | "LO"
  | "ZO"
  | "KO"
  | "UO"
  | "GO"
  | "LH2O"
  | "KH2O"
  | "ZH2O"
  | "UH2O"
  | "GH2O"
  | "LHO2"
  | "UHO2"
  | "KHO2"
  | "ZHO2"
  | "GHO2"
  | "XUH2O"
  | "XUHO2"
  | "XKH2O"
  | "XKHO2"
  | "XLH2O"
  | "XLHO2"
  | "XZH2O"
  | "XZHO2"
  | "XGH2O"
  | "XGHO2";
export type BoostType =
  | "harvest"
  | "build"
  | "dismantle"
  | "upgrade"
  | "attack"
  | "rangedAttack"
  | "heal"
  | "capacity"
  | "fatigue"
  | "damage";

export const BOOST_MINERAL: {
  [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant];
} = {
  attack: ["UH", "UH2O", "XUH2O"],
  harvest: ["UO", "UHO2", "XUHO2"],
  capacity: ["KH", "KH2O", "XKH2O"],
  rangedAttack: ["KO", "KHO2", "XKHO2"],
  build: ["LH", "LH2O", "XLH2O"],
  heal: ["LO", "LHO2", "XLHO2"],
  dismantle: ["ZH", "ZH2O", "XZH2O"],
  fatigue: ["ZO", "ZHO2", "XZHO2"],
  upgrade: ["GH", "GH2O", "XGH2O"],
  damage: ["GO", "GHO2", "XGHO2"],
};
export const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = {
  harvest: WORK,
  build: WORK,
  dismantle: WORK,
  upgrade: WORK,
  attack: ATTACK,
  rangedAttack: RANGED_ATTACK,
  heal: HEAL,
  capacity: CARRY,
  fatigue: MOVE,
  damage: TOUGH,
};

const MIN_LAB_PROD_AMOUNT = 15;

// in comments + x_000 are from HIVE_MINERAL in hive.resTarget
export const USEFUL_MINERAL_STOCKPILE: { [key in ReactionConstant]?: number } =
  {
    [BOOST_MINERAL.attack[2]]: 25_000, // + 5_000
    [BOOST_MINERAL.harvest[2]]: 2_500,
    [BOOST_MINERAL.capacity[2]]: 2_500,
    [BOOST_MINERAL.rangedAttack[2]]: 25_000, // + 5_000
    [BOOST_MINERAL.build[2]]: 20_000, // + 20_000
    [BOOST_MINERAL.heal[2]]: 35_000, // + 5_000
    [BOOST_MINERAL.dismantle[2]]: 20_000,
    [BOOST_MINERAL.fatigue[2]]: 20_000, // + 10_000
    [BOOST_MINERAL.upgrade[2]]: 20_000,
    [BOOST_MINERAL.damage[2]]: 20_000, // + 10_000
  };
export const PROFITABLE_MINERAL_STOCKPILE = 5_000;

export const BASE_MINERAL_STOCKPILE = {
  sellOff: 70_000,
  stopMining: 100_000,
};

const PRODUCE_PER_BATCH = 2500;

export const BASE_MINERALS: ResourceConstant[] = [
  "H",
  "O",
  "X",
  "K",
  "L",
  "U",
  "Z",
];

export const REACTION_MAP: {
  [key in ReactionConstant | MineralConstant]?: {
    res1: ReactionConstant | MineralConstant;
    res2: ReactionConstant | MineralConstant;
  };
} = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[REACTIONS[res1][res2] as ReactionConstant | MineralConstant] =
      {
        res1: res1 as ReactionConstant | MineralConstant,
        res2: res2 as ReactionConstant | MineralConstant,
      };
}

// reaction map done

interface SynthesizeRequest {
  // #region Properties (5)

  cooldown: number;
  plan: number;
  res: ReactionConstant;
  res1: ReactionConstant | MineralConstant;
  res2: ReactionConstant | MineralConstant;

  // #endregion Properties (5)
}

export interface BoostRequest {
  // #region Properties (3)

  amount?: number;
  lvl: 0 | 1 | 2;
  type: BoostType;

  // #endregion Properties (3)
}
export interface BoostInfo {
  // #region Properties (4)

  amount: number;
  lvl: 0 | 1 | 2;
  res: ReactionConstant;
  type: BoostType;

  // #endregion Properties (4)
}
type LabState =
  | "idle"
  | "production"
  | "source"
  | "waitingUnboost"
  | "unboosted"
  | ReactionConstant;

@profile
export class LaboratoryCell extends CellWithTarget {
  // #region Properties (8)

  private positions: RoomPosition[] = [];
  private prodCooldown = 0;
  /** if nothing to create we take a break for COOLDOWN_TARGET_LAB ticks */
  private usedBoost: string[] = [];

  public laboratories: { [id: string]: StructureLab } = {};
  public poss: Pos = this.cache("poss") || {
    x: 25,
    y: 25,
  };
  public prod: (SynthesizeRequest & { lab1: string; lab2: string }) | undefined;
  public prodWithoutLabs: SynthesizeRequest | undefined;
  public resTarget: { [key in ResourceConstant]?: number } = {};

  // #endregion Properties (8)

  // #region Constructors (1)

  public constructor(hive: Hive) {
    super(hive, prefix.laboratoryCell);
  }

  // #endregion Constructors (1)

  // #region Public Accessors (6)

  public get boostLabs(): { [key in ResourceConstant]?: string } {
    const cached = this.cache("boostLabs");
    if (!cached) return this.cache("boostLabs", {});
    return cached;
  }

  public get boostRequests(): {
    [id: string]: { info: BoostInfo[]; lastUpdated: number };
  } {
    const cached = this.cache("boostRequests");
    if (!cached) return this.cache("boostRequests", {});
    return cached;
  }

  public get labStates(): { [id: string]: LabState } {
    const cached = this.cache("labStates");
    if (!cached) return this.cache("labStates", {});
    return cached;
  }

  public override get pos(): RoomPosition {
    return new RoomPosition(this.poss.x, this.poss.y, this.hiveName);
  }

  public get synthesizeTarget(): {
    res: ReactionConstant;
    amount: number;
  } | null {
    return this.cache("synthesizeTarget");
  }

  public set synthesizeTarget(value) {
    this.cache("synthesizeTarget", value);
  }

  // #endregion Public Accessors (6)

  // #region Protected Accessors (3)

  protected get cooldownProd() {
    return PRODUCTION_COOLDOWNS.prod.lab;
  }

  protected get cooldownTarget() {
    return PRODUCTION_COOLDOWNS.target.lab;
  }

  protected get shouldProduce() {
    return !!this.hive.mode.lab;
  }

  // #endregion Protected Accessors (3)

  // #region Public Methods (6)

  public bakeMap() {
    this.positions = [];
    _.forEach(this.laboratories, (l) => {
      _.forEach(l.pos.getOpenPositions(), (p) => {
        if (!this.positions.filter((pp) => pp.x === p.x && pp.y === p.y).length)
          this.positions.push(p);
      });
    });
  }

  public boostBee(bee: Bee, requests?: BoostRequest[]) {
    let rCode: ScreepsReturnCode = OK;

    // do not boost old guys lmao
    if (bee.ticksToLive < 400) return rCode;

    if (!requests) {
      requests = bee.master && bee.master.boosts;
      if (!requests || !requests.length) return rCode;
    }

    if (
      !this.boostRequests[bee.ref] ||
      Game.time >= this.boostRequests[bee.ref].lastUpdated + 25
    ) {
      this.boostRequests[bee.ref] = { info: [], lastUpdated: Game.time };
      for (const r of requests) {
        const sameType = _.sum(
          this.boostRequests[bee.ref].info.filter((br) => br.type === r.type),
          (br) => br.amount
        );
        const ans = this.getBoostInfo(r, bee, sameType);
        if (ans) this.boostRequests[bee.ref].info.push(ans);
      }
    }

    for (const r of this.boostRequests[bee.ref].info) {
      let lab: StructureLab | undefined;

      if (!r.res || !r.amount) continue;

      const boostLabId = this.boostLabs[r.res];
      if (boostLabId) {
        if (this.labStates[boostLabId] !== r.res)
          this.boostLabs[r.res] = undefined;
        else lab = this.laboratories[boostLabId];
      }

      if (!lab) {
        const getLab = (state?: LabState, sameMineral = true) => {
          const labs = _.filter(this.laboratories, (l) => {
            const currState = this.labStates[l.id];
            return (
              (!sameMineral || l.mineralType === r.res) &&
              ((!state && currState !== "source") || currState === state)
            );
          });
          if (labs.length)
            return labs.reduce((prev, curr) =>
              curr.pos.getRangeTo(this.sCell) < prev.pos.getRangeTo(this.sCell)
                ? curr
                : prev
            );
          return undefined;
        };
        if (this.prod)
          switch (r.res) {
            case this.prod.res1:
              lab = this.laboratories[this.prod.lab1];
              break;
            case this.prod.res2:
              lab = this.laboratories[this.prod.lab2];
              break;
            case this.prod.res:
              lab = getLab("production", false);
              break;
          }
        if (!lab) lab = getLab(); // any lab same mineral
        if (!lab) lab = getLab("production", false);
        if (!lab) lab = getLab("idle", false);
        if (!lab) lab = getLab("unboosted", false);
        if (!lab) lab = getLab("source", false);
        if (lab) {
          this.boostLabs[r.res] = lab.id;
          this.labStates[lab.id] = r.res;
        }
      }

      if (!lab) {
        if (rCode === OK && Object.keys(this.laboratories).length)
          rCode = ERR_TIRED;
        continue;
      }

      if (bee.creep.spawning) {
        rCode = ERR_BUSY;
        continue;
      }

      if (
        lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL &&
        lab.store.getUsedCapacity(RESOURCE_ENERGY) >=
          r.amount * LAB_BOOST_ENERGY &&
        !this.usedBoost.includes(lab.id)
      ) {
        const pos = lab.pos.getOpenPositions()[0];
        if (bee.pos.isNearTo(lab)) {
          const ans = lab.boostCreep(bee.creep, r.amount);
          this.usedBoost.push(lab.id);
          if (ans === OK) {
            bee.boosted = true;
            Apiary.logger.reportResourceUsage(
              this.hiveName,
              "boosts",
              -r.amount * LAB_BOOST_MINERAL,
              r.res
            );
            Apiary.logger.reportResourceUsage(
              this.hiveName,
              "boosts",
              -r.amount * LAB_BOOST_ENERGY,
              RESOURCE_ENERGY
            );
            r.amount = 0;
          }
        } else if (rCode !== ERR_NOT_IN_RANGE) {
          bee.goTo(pos);
          rCode = ERR_NOT_IN_RANGE;
        }
      } else if (this.hive.state === hiveStates.lowenergy) continue; // help is not coming
      if (rCode !== ERR_NOT_IN_RANGE) rCode = ERR_TIRED;
      continue;
    }

    if (rCode === ERR_TIRED) bee.goRest(this.pos);
    else if (rCode === OK) delete this.boostRequests[bee.ref];
    return rCode;
  }

  public getBoostInfo(
    r: BoostRequest,
    bee?: Bee,
    boostedSameType?: number
  ): BoostInfo | void {
    const res = BOOST_MINERAL[r.type][r.lvl];
    const amountInHive: number = this.hive.getUsedCapacity(res);
    let amount = r.amount || Infinity;

    amount = Math.min(amount, Math.floor(amountInHive / LAB_BOOST_MINERAL));
    if (bee) {
      if (!boostedSameType) boostedSameType = 0;
      amount =
        Math.min(
          amount - bee.getBodyParts(BOOST_PARTS[r.type], 1),
          bee.getBodyParts(BOOST_PARTS[r.type], -1)
        ) - boostedSameType;
    }
    if (amount <= 0) return;
    return { type: r.type, res, amount, lvl: r.lvl };
  }

  public run() {
    --this.prodCooldown;
    if (this.prodCooldown > 0) return;
    if (!this.prod || this.prod.plan <= 0) return;

    const lab1 = this.laboratories[this.prod.lab1];
    const lab2 = this.laboratories[this.prod.lab2];
    const amount = Math.min(
      lab1.store[this.prod.res1],
      lab2.store[this.prod.res2]
    );
    if (amount < MIN_LAB_PROD_AMOUNT) return;

    const resource = this.prod.res;
    const labs = _.filter(
      this.laboratories,
      (lab) =>
        lab.store.getFreeCapacity(resource) >= 5 &&
        !lab.cooldown &&
        (this.labStates[lab.id] === "production" ||
          this.labStates[lab.id] === resource)
    );
    if (!labs.length) {
      this.prodWaitingToStart();
      return;
    }
    let cc = 0;
    for (let k = 0; k < labs.length && amount >= cc; ++k) {
      const lab = labs[k];
      const ans = lab.runReaction(lab1, lab2);
      if (ans !== OK) continue;

      let produced = 5;
      const powerup =
        lab.effects &&
        (lab.effects.filter(
          (p) => p.effect === PWR_OPERATE_LAB
        )[0] as PowerEffect);
      if (powerup) produced += powerup.level * 2;
      cc += produced;
    }
    if (cc) this.prodCooldown = this.prod.cooldown;
    if (this.synthesizeTarget && resource === this.synthesizeTarget.res)
      this.synthesizeTarget.amount -= cc;
    this.prod.plan -= cc;

    Apiary.logger.reportResourceUsage(this.hiveName, "labs", cc, this.prod.res);
    Apiary.logger.reportResourceUsage(
      this.hiveName,
      "labs",
      -cc,
      this.prod.res1
    );
    Apiary.logger.reportResourceUsage(
      this.hiveName,
      "labs",
      -cc,
      this.prod.res2
    );
  }

  /** move bee to lab and unboost it
   *
   * OK - no boosts left on bee
   *
   * ERR_NOT_FOUND - no lab found
   *
   * ERR_BUSY - lab cooldown
   *
   * ERR_NOT_IN_RANGE - going to lab
   *
   * or unboostCreep return code
   */
  public unboostBee(bee: Bee, opt?: TravelToOptions): ApiaryReturnCode {
    if (this.hive.mode.unboost === 0) return ERR_INVALID_ACTION;
    if (!bee.boosted) return OK;
    // used to unboost also enemy creeps
    // it was not useful
    // but it WAS funny
    // @ todo do we care about lab states?
    const labs = _.filter(
      this.laboratories,
      (l) => l.cooldown < bee.ticksToLive
    );
    if (!labs.length) return ERR_NOT_FOUND;
    const lab = _.find(labs, (l) => !l.cooldown);
    // need just to get close
    opt = { range: 1, ...opt };
    if (!lab || lab.cooldown) {
      bee.goRest(this.pos, opt);
      // do not use the cooldown
      if (lab) this.labStates[lab.id] = "waitingUnboost";
      return ERR_BUSY;
    }
    if (lab.pos.isNearTo(bee)) {
      bee.goTo(lab, opt);
      // do not use the cooldown
      this.labStates[lab.id] = "waitingUnboost";
      return ERR_NOT_IN_RANGE;
    }
    // unboost the creep
    const ans = lab.unboostCreep(bee.creep);
    if (ans === OK) {
      bee.boosted = false;
      this.labStates[lab.id] = "unboosted";
      // @todo Apiary.logger
      // not sure how to log this cause resources could as well just decay
      if (ans === OK)
        _.forEach(bee.body, (b) => {
          if (b.boost)
            Apiary.logger.reportResourceUsage(
              this.hiveName,
              "unboosting",
              LAB_BOOST_MINERAL * 0.5 * 0.9, // LAB_UNBOOST_MINERAL was undefined in .ts
              b.boost as ReactionConstant
            );
        });
    }
    return ans;
  }

  public override update() {
    this.updateObjects(["laboratories"]);
    if (!Object.keys(this.laboratories).length) return;

    let priority = 5 as 2 | 5;
    this.sCell.requestFromStorage(
      _.filter(this.laboratories, (l) => {
        if (
          l.store.getUsedCapacity(RESOURCE_ENERGY) <
          LAB_ENERGY_CAPACITY * 0.5
        )
          priority = 2;
        return l.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }),
      priority,
      RESOURCE_ENERGY,
      LAB_ENERGY_CAPACITY,
      true
    );

    for (const id in this.laboratories) {
      this.updateLabState(this.laboratories[id]);
    }

    this.usedBoost = [];

    let prev;
    for (const id in this.laboratories) {
      const curr = this.sCell.requests[id];
      if (curr && this.sCell.storage && curr.to.id === this.sCell.storage.id) {
        curr.nextup = prev;
        prev = curr;
      }
    }

    const needNewProd =
      !this.prod && // we have no prod FIND new one
      Object.keys(this.laboratories).length > 3 && // no need to find prod if no labs
      _.filter(this.laboratories, (l) => !l.cooldown).length > 1 && // no need to target prod if all labs busy
      this.prodFindLabs() === ERR_NOT_FOUND; // getting new prod // if no prod then target

    if (needNewProd) {
      this.stepToTarget();
      this.prodFindLabs();
    }

    if (this.prod) {
      const fact = Math.min(
        this.prod.plan,
        this.hive.getUsedCapacity(this.prod.res1),
        this.hive.getUsedCapacity(this.prod.res2)
      );
      this.CanProduceNow(fact, MIN_LAB_PROD_AMOUNT);
    }

    for (const ref in this.boostRequests)
      if (this.boostRequests[ref].lastUpdated + 25 < Game.time)
        delete this.boostRequests[ref];
  }

  // #endregion Public Methods (6)

  // #region Protected Methods (1)

  public invalidateTarget() {
    this.prod = undefined;
    this.prodWithoutLabs = undefined;
    this.synthesizeTarget = null;
    this.emptyResTarget();
  }

  // #endregion Protected Methods (1)

  // #region Private Methods (7)

  private emptyResTarget() {
    this.resTarget = {};
  }

  private getCreateQue(
    res: ReactionConstant,
    amount: number
  ): [ReactionConstant[], MineralConstant[]] {
    // prob should precal for each resource
    const ingredients: MineralConstant[] = [];
    const createQue: ReactionConstant[] = [];

    const dfs = (resource: ReactionConstant) => {
      const recipe = REACTION_MAP[resource];
      if (!recipe) {
        if (
          this.hive.getUsedCapacity(resource) < amount &&
          ingredients.indexOf(resource as MineralConstant) === -1
        )
          ingredients.push(resource as MineralConstant);
        return;
      }
      const needed =
        resource === res
          ? amount
          : amount - this.hive.getUsedCapacity(resource);
      if (needed > 0) {
        if (
          createQue.indexOf(resource) === -1 &&
          this.hive.getUsedCapacity(recipe.res1) >=
            Math.min(needed, LAB_MINERAL_CAPACITY / 3) &&
          this.hive.getUsedCapacity(recipe.res2) >=
            Math.min(needed, LAB_MINERAL_CAPACITY / 3)
        )
          createQue.push(resource);
        dfs(recipe.res1 as ReactionConstant);
        dfs(recipe.res2 as ReactionConstant);
      }
    };

    dfs(res);

    return [createQue, ingredients];
  }

  private getNewTarget() {
    if (this.synthesizeTarget) return OK;
    if (!this.shouldFindTarget) return ERR_COOLDOWN;

    let targets: { res: ReactionConstant; amount: number }[] = [];
    for (const r in this.hive.resState) {
      const res = r as ReactionConstant;
      const toCreate = -this.hive.getResState(res);
      if (toCreate > 0 && res in REACTION_MAP)
        targets.push({ res, amount: toCreate });
    }
    // create the ones i can first
    const canCreate = targets.filter(
      (t) => this.getCreateQue(t.res, t.amount)[0].length
    );
    if (canCreate.length) targets = canCreate;

    // if nothing to create use mode to choose next target
    if (!targets.length) {
      if (this.hive.mode.lab === 1) {
        this.notFoundTarget();
        return ERR_NOT_FOUND;
      }
      // not ever gonna try to create mid ones (not profitable)
      let usefulR: ReactionConstant[] = [];

      for (const comp of Object.keys(USEFUL_MINERAL_STOCKPILE)) {
        const compound = comp as keyof typeof USEFUL_MINERAL_STOCKPILE;
        if (
          USEFUL_MINERAL_STOCKPILE[compound]! > this.hive.getResState(compound)
        )
          usefulR.push(compound);
      }
      if (!usefulR.length)
        usefulR = Apiary.broker.profitableCompounds.filter(
          (c) =>
            PROFITABLE_MINERAL_STOCKPILE + (USEFUL_MINERAL_STOCKPILE[c] || 0) >
            this.hive.getResState(c)
        );
      if (!usefulR.length) {
        this.notFoundTarget();
        return ERR_NOT_FOUND;
      }
      // @todo check if can produce without market?
      targets = [
        {
          res: usefulR.reduce((prev, curr) =>
            Apiary.network.getResState(curr) < Apiary.network.getResState(prev)
              ? curr
              : prev
          ),
          amount: PRODUCE_PER_BATCH,
        },
      ];
      // targets = [{ res: usefulM[Math.floor(Math.random() * usefulM.length)], amount: 2048 }];
    }

    targets.sort((a, b) => b.amount - a.amount);
    this.synthesizeTarget = targets[0];
    // produce form 1/3 lab to 2 full labs of mineral (6_000 to 1_000)
    this.synthesizeTarget.amount = Math.max(
      Math.min(this.synthesizeTarget.amount, LAB_MINERAL_CAPACITY * 2),
      LAB_MINERAL_CAPACITY / 3
    );
    this.foundTarget();
    return OK;
  }

  private newSynthesize(
    resource: ReactionConstant,
    amount: number = Infinity
  ): number {
    if (!(resource in REACTION_TIME)) return 0;
    const res1Amount = this.hive.getUsedCapacity(REACTION_MAP[resource]!.res1);
    const res2Amount = this.hive.getUsedCapacity(REACTION_MAP[resource]!.res2);
    amount = Math.min(amount, res1Amount, res2Amount);
    if (amount > 0)
      this.prodWithoutLabs = {
        plan: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      };
    return amount;
  }

  /** new production towards the final target */
  private prodFindLabs(): ERR_NOT_FOUND | OK {
    if (!this.prodWithoutLabs) return ERR_NOT_FOUND;

    const res1 = this.prodWithoutLabs.res1;
    const res2 = this.prodWithoutLabs.res2;

    const prodAmount: { [id: string]: number } = {};
    for (const id in this.laboratories)
      prodAmount[id] = _.filter(
        this.laboratories,
        (l) => this.laboratories[id].pos.getRangeTo(l) <= 2
      ).length;
    const comp = (
      prev: StructureLab,
      curr: StructureLab,
      res: MineralConstant | ReactionConstant
    ) => {
      let cond = prodAmount[prev.id] - prodAmount[curr.id];
      if (cond === 0)
        cond =
          prev.store.getUsedCapacity(res) - curr.store.getUsedCapacity(res);
      if (cond === 0)
        cond =
          curr.pos.getRangeApprox(this.sCell) -
          prev.pos.getRangeApprox(this.sCell);
      return cond < 0 ? curr : prev;
    };

    const lab1 = _.map(this.laboratories, (l) => l).reduce((prev, curr) =>
      comp(prev, curr, res1)
    );
    let lab2: StructureLab | undefined;
    if (lab1)
      lab2 = _.filter(this.laboratories, (l) => l.id !== lab1.id).reduce(
        (prev, curr) => comp(prev, curr, res2)
      );
    const cooldown = this.prodWithoutLabs.cooldown;
    if (!lab1 || !lab2) {
      this.prodWaitingToStart();
      return OK;
    }
    const anyLab = _.filter(
      this.laboratories,
      (l) => l.id !== lab1.id && l.id !== lab2!.id && l.cooldown <= cooldown
    ).length;
    if (!anyLab) {
      this.prodWaitingToStart();
      return OK;
    }

    this.prod = { ...this.prodWithoutLabs, lab1: lab1.id, lab2: lab2.id };
    this.prodCooldown = 0;
    this.labStates[lab1.id] = "source";
    this.updateLabState(lab1, 1);
    this.labStates[lab2.id] = "source";
    this.updateLabState(lab2, 1);
    this.prodWithoutLabs = undefined;
    return OK;
  }

  private stepToTarget() {
    this.emptyResTarget();
    if (this.getNewTarget() !== OK || !this.synthesizeTarget) return;

    const [createQue, ingredients] = this.getCreateQue(
      this.synthesizeTarget.res,
      this.synthesizeTarget.amount
    );

    const targetAmount = this.synthesizeTarget.amount;
    _.forEach(
      ingredients,
      (resource) => (this.resTarget[resource] = targetAmount)
    );
    const amount =
      createQue.length &&
      this.newSynthesize(
        createQue.reduce((prev, curr) =>
          this.hive.getUsedCapacity(curr) < this.hive.getUsedCapacity(prev)
            ? curr
            : prev
        ),
        this.synthesizeTarget.amount
      );
    this.prodPatienceCheck(amount);
  }

  private updateLabState(l: StructureLab, rec = 0) {
    switch (rec) {
      // max recursion = 2 just to be safe i count
      default:
        return;
      case 1:
        delete this.sCell.requests[l.id];
        break;
      case 0:
        break;
    }
    const state = this.labStates[l.id];
    switch (state) {
      case "waitingUnboost":
        this.labStates[l.id] = "idle";
        break;
      case "unboosted": {
        const resources = l.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
        this.sCell.requestToStorage(resources, 2, undefined);

        _.forEach(resources, (r) =>
          Apiary.logger.reportResourceUsage(
            this.hiveName,
            "unboost",
            r.amount,
            r.resourceType
          )
        );
        // falls through
      }
      case undefined:
        this.labStates[l.id] = "idle";
      // falls through
      case "idle":
        if (this.prod) {
          if (l.id === this.prod.lab1 || l.id === this.prod.lab2) {
            this.labStates[l.id] = "source";
            this.updateLabState(l, rec + 1);
          } else if (
            l.cooldown <= this.prod.cooldown &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2 &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2
          ) {
            this.labStates[l.id] = "production";
            this.updateLabState(l, rec + 1);
          } else if (l.mineralType)
            this.sCell.requestToStorage([l], 5, l.mineralType);
        } else if (l.mineralType)
          this.sCell.requestToStorage([l], 5, l.mineralType);
        break;
      case "source": {
        if (!this.prod) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        let r: ReactionConstant | MineralConstant;
        if (l.id === this.prod.lab1) {
          r = this.prod.res1;
        } else if (l.id === this.prod.lab2) {
          r = this.prod.res2;
        } else {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        }
        const freeCap = l.store.getFreeCapacity(r);
        if (l.mineralType && l.mineralType !== r)
          this.sCell.requestToStorage([l], 3, l.mineralType);
        else if (
          (freeCap > LAB_MINERAL_CAPACITY / 2 ||
            this.prod.plan <= LAB_MINERAL_CAPACITY) &&
          l.store.getUsedCapacity(r) < this.prod.plan
        )
          this.sCell.requestFromStorage([l], 3, r, this.prod.plan);
        break;
      }
      case "production": {
        const res = l.mineralType;
        if (!this.prod || l.cooldown > this.prod.cooldown * 2) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        } else if (
          res &&
          (res !== this.prod.res ||
            l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2)
        )
          this.sCell.requestToStorage(
            [l],
            4,
            res,
            l.store.getUsedCapacity(res)
          );
        break;
      }
      default: {
        // boosting lab : state === resource
        const toBoostMinerals = _.sum(this.boostRequests, (br) => {
          const sameType = br.info.filter(
            (r) => r.res === this.labStates[l.id]
          );
          return _.sum(sameType, (r) => r.amount * LAB_BOOST_MINERAL);
        });
        if (!toBoostMinerals) {
          this.labStates[l.id] = "idle";
          if (this.boostLabs[state] === l.id) this.boostLabs[state] = undefined;
          this.updateLabState(l, rec + 1);
          return;
        }
        if (l.mineralType && l.mineralType !== state)
          this.sCell.requestToStorage([l], 1, l.mineralType);
        else if (l.store.getUsedCapacity(state) < toBoostMinerals)
          this.sCell.requestFromStorage(
            [l],
            1,
            state,
            toBoostMinerals - l.store.getUsedCapacity(state),
            true
          );
        break;
      }
    }
  }

  // #endregion Private Methods (7)
}

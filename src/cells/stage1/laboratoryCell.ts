import { Cell } from "../_Cell";

import { prefix, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Hive } from "../../Hive";
import type { StorageCell } from "./storageCell";

export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";
export type BoostType = "harvest" | "build" | "dismantle" | "upgrade" | "attack" | "rangedAttack" | "heal" | "capacity" | "fatigue" | "damage";

export const BOOST_MINERAL: { [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant] } = { "harvest": ["UO", "UHO2", "XUHO2"], "build": ["LH", "LH2O", "XLH2O"], "dismantle": ["ZH", "ZH2O", "XZH2O"], "upgrade": ["GH", "GH2O", "XGH2O"], "attack": ["UH", "UH2O", "XUH2O"], "rangedAttack": ["KO", "KHO2", "XKHO2"], "heal": ["LO", "LHO2", "XLHO2"], "capacity": ["KH", "KH2O", "XKH2O"], "fatigue": ["ZO", "ZHO2", "XZHO2"], "damage": ["GO", "GHO2", "XGHO2"] };
export const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = { "harvest": WORK, "build": WORK, "dismantle": WORK, "upgrade": WORK, "attack": ATTACK, "rangedAttack": RANGED_ATTACK, "heal": HEAL, "capacity": CARRY, "fatigue": MOVE, "damage": TOUGH };

export const BASE_MINERALS: ResourceConstant[] = ["H", "K", "L", "U", "X", "O", "Z"];
export const REACTION_MAP: { [key in ReactionConstant | MineralConstant]?: { res1: ReactionConstant | MineralConstant, res2: ReactionConstant | MineralConstant } } = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[<ReactionConstant | MineralConstant>REACTIONS[res1][res2]] = {
      res1: <ReactionConstant | MineralConstant>res1,
      res2: <ReactionConstant | MineralConstant>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  plan: number,
  res: ReactionConstant,
  res1: ReactionConstant | MineralConstant,
  res2: ReactionConstant | MineralConstant,
  cooldown: number,
}

export type BoostRequest = { type: BoostType, amount?: number, lvl: 0 | 1 | 2 }
export type BoostInfo = { type: BoostType, res: ReactionConstant, amount: number, lvl: 0 | 1 | 2 };
type LabState = "idle" | "production" | "source" | "unboosted" | ReactionConstant;
@profile
export class LaboratoryCell extends Cell {
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  master: undefined;
  sCell: StorageCell;

  synthesizeRes: SynthesizeRequest | undefined;
  resTarget: { [key in ResourceConstant]?: number } = {};
  prod?: SynthesizeRequest & { lab1: string, lab2: string };
  patience: number = 0;
  patienceProd: number = 0;
  prodCooldown = 0;
  usedBoost: string[] = [];

  positions: RoomPosition[] = [];

  constructor(hive: Hive, sCell: StorageCell) {
    super(hive, prefix.laboratoryCell + "_" + hive.room.name);
    this.sCell = sCell;

    this.setCahe("labStates", {});
    this.setCahe("boostLabs", {});
    this.setCahe("boostRequests", {});
    this.setCahe("poss", { x: 25, y: 25 });
  }

  get poss(): { x: number, y: number } {
    return this.fromCache("poss");
  }

  get pos(): RoomPosition {
    let pos = this.fromCache("poss");
    return new RoomPosition(pos.x, pos.y, this.hive.roomName);
  }

  bakeMap() {
    this.positions = [];
    _.forEach(this.laboratories, l => {
      _.forEach(l.pos.getOpenPositions(true), p => {
        if (!this.positions.filter(pp => pp.x === p.x && pp.y === p.y).length)
          this.positions.push(p);
      });
    });
  }

  get labStates(): { [id: string]: LabState } {
    return this.fromCache("labStates");
  }

  set labStates(value) {
    this.toCache("labStates", value);
  }

  get boostLabs(): { [key in ResourceConstant]?: string } {
    return this.fromCache("boostLabs");
  }

  set boostLabs(value) {
    this.toCache("boostLabs", value);
  }

  get boostRequests(): { [id: string]: { info: BoostInfo[], lastUpdated: number } } {
    return this.fromCache("boostRequests");
  }

  set boostRequests(value) {
    this.toCache("boostRequests", value);
  }

  get synthesizeTarget(): undefined | { res: ReactionConstant, amount: number } {
    return this.fromCache("synthesizeTarget");
  }

  set synthesizeTarget(value) {
    this.toCache("synthesizeTarget", value);
  }

  newSynthesize(resource: ReactionConstant, amount: number = Infinity): number {
    if (!(resource in REACTION_TIME))
      return 0;
    let res1Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res1);
    let res2Amount = this.sCell.getUsedCapacity(REACTION_MAP[resource]!.res2);
    amount = Math.min(amount, res1Amount, res2Amount);
    if (amount > 0)
      this.synthesizeRes = {
        plan: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      };
    return amount;
  }

  stepToTarget() {
    this.resTarget = {};
    if (!this.synthesizeTarget) {
      let mode = this.hive.shouldDo("lab");
      if (!mode)
        return;
      let targets: { res: ReactionConstant, amount: number }[] = [];
      for (const r in this.hive.resState) {
        let res = <ReactionConstant>r; // atually ResourceConstant
        let toCreate = -this.hive.resState[res]!;
        if (toCreate > 0 && res in REACTION_MAP)
          targets.push({ res: res, amount: toCreate });
      }
      let canCreate = targets.filter(t => {
        let [createQue,] = this.getCreateQue(t.res, t.amount);
        return createQue.length;
      });
      if (canCreate.length)
        targets = canCreate;
      if (!targets.length) {
        if (mode === 1)
          return;
        let usefulM: ReactionConstant[] = ["XGH2O", "XGHO2", "XLH2O", "XLHO2", "XZHO2", "XKHO2", "XUH2O", "XZH2O"];
        let usefulR = usefulM.reduce((prev, curr) => (Apiary.network.resState[curr] || 0) < (Apiary.network.resState[prev] || 0) ? curr : prev);
        targets = [{ res: usefulR, amount: 2048 }];
        // targets = [{ res: usefulM[Math.floor(Math.random() * usefulM.length)], amount: 2048 }];
      }
      this.patience = 0;
      targets.sort((a, b) => b.amount - a.amount);
      this.synthesizeTarget = targets[0];
      this.synthesizeTarget.amount = Math.max(Math.min(this.synthesizeTarget.amount, LAB_MINERAL_CAPACITY * 2), LAB_MINERAL_CAPACITY / 3);
    }

    let [createQue, ingredients] = this.getCreateQue(this.synthesizeTarget.res, this.synthesizeTarget.amount);

    _.forEach(ingredients, resource => this.resTarget[resource] = this.synthesizeTarget!.amount);
    let amount = createQue.length && this.newSynthesize(createQue.reduce(
      (prev, curr) => this.sCell.getUsedCapacity(curr) < this.sCell.getUsedCapacity(prev) ? curr : prev), this.synthesizeTarget.amount);
    if (amount)
      this.patience = 0;
    else
      ++this.patience;

    if (this.patience >= 100) {
      this.patience = 0;
      this.synthesizeTarget = undefined;
    }
  }

  getCreateQue(res: ReactionConstant, amount: number): [ReactionConstant[], MineralConstant[]] {
    // prob should precal for each resource
    let ingredients: MineralConstant[] = [];
    let createQue: ReactionConstant[] = [];

    let dfs = (resource: ReactionConstant) => {
      let recipe = REACTION_MAP[resource];
      if (!recipe) {
        if (this.sCell.getUsedCapacity(resource) < amount && ingredients.indexOf(<MineralConstant>resource) === -1)
          ingredients.push(<MineralConstant>resource);
        return;
      }
      let needed = resource === res ? amount : amount - this.sCell.getUsedCapacity(resource);
      if (needed > 0) {
        if (createQue.indexOf(resource) === -1
          && this.sCell.getUsedCapacity(recipe.res1) >= Math.min(needed, LAB_MINERAL_CAPACITY / 3)
          && this.sCell.getUsedCapacity(recipe.res2) >= Math.min(needed, LAB_MINERAL_CAPACITY / 3))
          createQue.push(resource);
        dfs(<ReactionConstant>recipe.res1);
        dfs(<ReactionConstant>recipe.res2);
      }
    }

    dfs(res);

    return [createQue, ingredients]
  }

  newProd() {
    if (Object.keys(this.laboratories).length < 3 || _.filter(this.laboratories, l => !l.cooldown).length < 1)
      return true;
    if (!this.synthesizeRes)
      return false;

    let res1 = this.synthesizeRes.res1;
    let res2 = this.synthesizeRes.res2;

    let prodAmount: { [id: string]: number } = {}
    for (let id in this.laboratories)
      prodAmount[id] = _.filter(this.laboratories, l => this.laboratories[id].pos.getRangeTo(l) <= 2).length;
    let comp = (prev: StructureLab, curr: StructureLab, res: MineralConstant | ReactionConstant) => {
      let cond = prodAmount[prev.id] - prodAmount[curr.id];
      if (cond === 0)
        cond = prev.store.getUsedCapacity(res) - curr.store.getUsedCapacity(res);
      if (cond === 0)
        cond = curr.pos.getTimeForPath(this.sCell!) - prev.pos.getTimeForPath(this.sCell!);
      return cond < 0 ? curr : prev;
    }

    let lab1 = _.map(this.laboratories, l => l).reduce((prev, curr) => comp(prev, curr, res1));
    let lab2: StructureLab | undefined;
    if (lab1)
      lab2 = _.filter(this.laboratories, l => l.id !== lab1.id).reduce((prev, curr) => comp(prev, curr, res2));
    if (lab1 && lab2 && _.filter(this.laboratories, l => l.id !== lab1.id && l.id !== lab2!.id && l.cooldown <= this.synthesizeRes!.cooldown).length) {
      this.prod = { ...this.synthesizeRes, lab1: lab1.id, lab2: lab2.id };
      this.prodCooldown = 0;
      this.labStates[lab1.id] = "source";
      this.updateLabState(lab1, 1);
      this.labStates[lab2.id] = "source";
      this.updateLabState(lab2, 1);
      this.synthesizeRes = undefined;
    }
    return true;
  }

  getBoostInfo(r: BoostRequest, bee?: Bee, boostedSameType?: number): BoostInfo | void {
    let res = BOOST_MINERAL[r.type][r.lvl];
    let sum = this.sCell.getUsedCapacity(res);
    if (bee && this.prod && res === this.prod.res) {
      sum = this.sCell.storage.store.getUsedCapacity(res);
      let inBees = _.sum(this.sCell.master.activeBees, b => b.store.getUsedCapacity(res));
      if (inBees)
        sum += inBees;
      let boostLab = this.boostLabs[res];
      if (boostLab)
        sum += this.laboratories[boostLab].store.getUsedCapacity(res);
    }
    let amount = r.amount || Infinity;
    amount = Math.min(amount, Math.floor(sum / LAB_BOOST_MINERAL));
    if (bee) {
      if (!boostedSameType)
        boostedSameType = 0;
      amount = Math.min(amount - bee.getBodyParts(BOOST_PARTS[r.type], 1), bee.getBodyParts(BOOST_PARTS[r.type], -1)) - boostedSameType;
    }
    if (amount <= 0)
      return;
    return { type: r.type, res: res, amount: amount, lvl: r.lvl };
  }

  // lowLvl : 0 - tier 3 , 1 - tier 2+, 2 - tier 1+
  askForBoost(bee: Bee, requests?: BoostRequest[]) {
    let rCode: ScreepsReturnCode = OK;

    if (bee.ticksToLive < 1000)
      // || bee.pos.roomName !== this.pos.roomName)
      return rCode;

    if (!requests) {
      requests = bee.master && bee.master.boosts;
      if (!requests)
        return rCode;
    }

    if (!this.boostRequests[bee.ref] || Game.time >= this.boostRequests[bee.ref].lastUpdated + 25) {
      this.boostRequests[bee.ref] = { info: [], lastUpdated: Game.time };
      for (let k = 0; k < requests.length; ++k) {
        let r = requests[k];
        let sameType = _.sum(this.boostRequests[bee.ref].info.filter(br => br.type === r.type), br => br.amount);
        let ans = this.getBoostInfo(r, bee, sameType);
        if (ans)
          this.boostRequests[bee.ref].info.push(ans);
      }
    }

    for (let k = 0; k < this.boostRequests[bee.ref].info.length; ++k) {
      let r = this.boostRequests[bee.ref].info[k];
      let lab: StructureLab | undefined;

      if (!r.res || !r.amount)
        continue;

      let boostLabId = this.boostLabs[r.res];
      if (boostLabId) {
        if (this.labStates[boostLabId] !== r.res)
          this.boostLabs[r.res] = undefined;
        else
          lab = this.laboratories[boostLabId];
      }

      if (!lab) {
        let getLab = (state?: LabState, sameMineral = true) => {
          let labs = _.filter(this.laboratories, l => {
            let currState = this.labStates[l.id]
            return (!sameMineral || l.mineralType === r.res)
              && ((!state && currState !== "source") || currState === state);
          });
          if (labs.length)
            return labs.reduce((prev, curr) => curr.pos.getRangeTo(this.sCell) < prev.pos.getRangeTo(this.sCell) ? curr : prev);
          return undefined;
        }
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
        if (!lab)
          lab = getLab(); //any lab same mineral
        if (!lab)
          lab = getLab("production", false);
        if (!lab)
          lab = getLab("idle", false);
        if (!lab)
          lab = getLab("unboosted", false);
        if (!lab)
          lab = getLab("source", false);
        if (lab) {
          this.boostLabs[r.res!] = lab.id;
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

      if (lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL
        && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= r.amount * LAB_BOOST_ENERGY && !this.usedBoost.includes(lab.id)) {
        let pos = lab.pos.getOpenPositions(true)[0];
        if (bee.pos.isNearTo(lab)) {
          let ans = lab.boostCreep(bee.creep, r.amount);
          this.usedBoost.push(lab.id);
          if (ans === OK) {
            bee.boosted = true;
            r.amount = 0;
            if (Apiary.logger) {
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_MINERAL, r.res);
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_ENERGY, RESOURCE_ENERGY);
            }
          }
        } else if (rCode !== ERR_NOT_IN_RANGE) {
          bee.goTo(pos);
          rCode = ERR_NOT_IN_RANGE;
        }
      } else if (this.hive.state === hiveStates.lowenergy)
        continue; // help is not coming
      if (rCode !== ERR_NOT_IN_RANGE)
        rCode = ERR_TIRED;
      continue;
    }

    // console .log(rCode, JSON.stringify(this.boostRequests[bee.ref]), _.map(this.boostRequests[bee.ref], d => `${bee.getBodyParts(BOOST_PARTS[d.type], 1)} ${d.res}`))
    if (rCode === ERR_TIRED)
      bee.goRest(this.pos);
    else if (rCode === OK)
      delete this.boostRequests[bee.ref];
    return rCode;
  }

  updateLabState(l: StructureLab, rec = 0) {
    switch (rec) {
      // max recursion = 2 just to be safe i count
      default:
        return;
      case 1:
        delete this.sCell.requests[l.id]
        break;
      case 0:
        break;
    }
    let state = this.labStates[l.id];
    switch (state) {
      case "unboosted":
        let resources = l.pos.findInRange(FIND_DROPPED_RESOURCES, 1);
        this.sCell.requestToStorage(resources, 2, undefined);
        if (Apiary.logger)
          _.forEach(resources, r => Apiary.logger!.addResourceStat(this.hive.roomName, "unboost", r.amount, r.resourceType));
      case undefined:
        this.labStates[l.id] = "idle";
      case "idle":
        if (this.prod) {
          if (l.id === this.prod.lab1 || l.id === this.prod.lab2) {
            this.labStates[l.id] = "source";
            this.updateLabState(l, rec + 1);
          } else if (l.cooldown <= this.prod.cooldown &&
            l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2 && l.pos.getRangeTo(this.laboratories[this.prod.lab1]) <= 2) {
            this.labStates[l.id] = "production";
            this.updateLabState(l, rec + 1);
          } else if (l.mineralType)
            this.sCell.requestToStorage([l], 5, l.mineralType);
        } else if (l.mineralType)
          this.sCell.requestToStorage([l], 5, l.mineralType);
        break;
      case "source":
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
        let freeCap = l.store.getFreeCapacity(r);
        if (l.mineralType && l.mineralType !== r)
          this.sCell.requestToStorage([l], 3, l.mineralType);
        else if ((freeCap > LAB_MINERAL_CAPACITY / 2 || this.prod.plan <= LAB_MINERAL_CAPACITY) && l.store.getUsedCapacity(r) < this.prod.plan)
          this.sCell.requestFromStorage([l], 3, r, this.prod.plan);
        break;
      case "production":
        let res = l.mineralType;
        if (!this.prod || l.cooldown > this.prod.cooldown * 2) {
          this.labStates[l.id] = "idle";
          this.updateLabState(l, rec + 1);
          break;
        } else if (res && (res !== this.prod.res || l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2))
          this.sCell.requestToStorage([l], 4, res, l.store.getUsedCapacity(res));
        break;
      default: // boosting lab : state === resource
        let toBoostMinerals = _.sum(this.boostRequests, br => {
          let sameType = br.info.filter(r => r.res == this.labStates[l.id])
          return _.sum(sameType, r => r.amount * LAB_BOOST_MINERAL);
        });
        if (!toBoostMinerals) {
          this.labStates[l.id] = "idle";
          if (this.boostLabs[state] === l.id)
            this.boostLabs[state] = undefined;
          this.updateLabState(l, rec + 1);
          return;
        }
        if (l.mineralType && l.mineralType !== state)
          this.sCell.requestToStorage([l], 1, l.mineralType);
        else if (l.store.getUsedCapacity(state) < toBoostMinerals)
          this.sCell.requestFromStorage([l], 1, state, toBoostMinerals - l.store.getUsedCapacity(state), true);
        break;
    }
  }

  update() {
    super.update(["laboratories"]);
    if (!Object.keys(this.laboratories).length)
      return;

    let priority = <2 | 5>5;
    this.sCell.requestFromStorage(_.filter(this.laboratories,
      l => {
        if (l.store.getUsedCapacity(RESOURCE_ENERGY) < LAB_ENERGY_CAPACITY * 0.5)
          priority = 2;
        return l.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }), priority, RESOURCE_ENERGY, LAB_ENERGY_CAPACITY, true);

    for (let id in this.laboratories)
      this.updateLabState(this.laboratories[id]);
    this.usedBoost = [];

    let prev;
    for (let id in this.laboratories) {
      let curr = this.sCell.requests[id];
      if (curr && curr.to.id === this.sCell.storage.id) {
        curr.nextup = prev;
        prev = curr;
      }
    }

    if (!this.prod && !this.newProd()) {
      this.stepToTarget();
      this.newProd();
    }

    if (this.prod) {
      let fact = Math.min(this.prod.plan,
        this.sCell.getUsedCapacity(this.prod.res1),
        this.sCell.getUsedCapacity(this.prod.res2));
      if (fact < this.prod.plan) {
        if (this.patienceProd <= 10)
          ++this.patienceProd;
        else {
          this.prod.plan = fact;
          this.patienceProd = 0;
        }
      }
      if (this.synthesizeTarget && this.synthesizeTarget.amount < 15)
        this.synthesizeTarget = undefined;
      if (this.prod.plan < 15 || !this.synthesizeTarget)
        this.prod = undefined;
    }

    for (const ref in this.boostRequests)
      if (this.boostRequests[ref].lastUpdated + 25 < Game.time)
        delete this.boostRequests[ref];
  }

  getUnboostLab(ticksToLive: number) {
    if (!this.hive.shouldDo("unboost"))
      return undefined;
    let lab: StructureLab | undefined;
    _.some(this.laboratories, l => {
      if (l.cooldown > ticksToLive)
        return false;
      lab = l;
      return true;
    });
    return lab;
  }

  run() {
    if (this.hive.shouldDo("unboost")) {
      let creepsToUnboost: Creep[] = [];
      let time = Math.max(20, this.prod && this.prod.cooldown * 2 || 0)
      _.forEach(this.positions, p => {
        let creep = p.lookFor(LOOK_CREEPS).filter(c => c.ticksToLive && c.ticksToLive < time
          && c.body.filter(b => b.boost).length)[0];
        if (creep)
          creepsToUnboost.push(creep);
      });
      _.forEach(creepsToUnboost, creep => {
        let lab = _.filter(this.laboratories, l => !l.cooldown && l.pos.getRangeTo(creep) <= 1 && this.labStates[l.id] !== "unboosted")[0];
        if (lab && lab.unboostCreep(creep) === OK) {
          this.labStates[lab.id] = "unboosted";
          let bee = <Bee>Apiary.bees[creep.name];
          if (bee)
            bee.boosted = false;
        }
      });
    }

    --this.prodCooldown;
    if (this.prod && this.prodCooldown <= 0 && this.prod.plan > 0) {
      let lab1 = this.laboratories[this.prod.lab1];
      let lab2 = this.laboratories[this.prod.lab2];
      let amount = Math.min(lab1.store[this.prod.res1], lab2.store[this.prod.res2])
      if (amount >= 15) {
        let labs = _.filter(this.laboratories, lab => lab.store.getFreeCapacity(this.prod!.res) >= 5 && !lab.cooldown &&
          (this.labStates[lab.id] === "production" || this.labStates[lab.id] === this.prod!.res));
        let cc = 0;
        for (let k = 0; k < labs.length && amount >= cc; ++k) {
          let lab = labs[k];
          let ans = lab.runReaction(lab1, lab2);
          if (ans === OK) {
            let produced = 5;
            let powerup = lab.effects && <PowerEffect>lab.effects.filter(p => p.effect === PWR_OPERATE_LAB)[0];
            if (powerup)
              produced += powerup.level * 2;
            cc += produced;
          }
        }
        if (cc)
          this.prodCooldown = this.prod.cooldown;
        if (this.synthesizeTarget && this.prod.res === this.synthesizeTarget.res)
          this.synthesizeTarget.amount -= cc;
        this.prod.plan -= cc;
        if (Apiary.logger) {
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", cc, this.prod.res);
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", -cc, this.prod.res1);
          Apiary.logger.addResourceStat(this.hive.roomName, "labs", -cc, this.prod.res2);
        }
        if (!labs.length && !_.filter(this.laboratories, l => l.id !== lab1.id && l.id !== lab2.id && l.cooldown <= this.prod!.cooldown * 2).length)
          this.prod = undefined;
      }
    }
  }
}


/*
// i rly don't like to type in all the reactions;
let s: string[] = []; REACTION_TIME
for (let key in REACTIONS)
  if (!s.includes(key))
    s.push(key);
for (let key in REACTION_TIME) {
  if (!s.includes(key))
    s.push(key);
}
let ss = "";
for (let key in s)
  ss += " | " + '"' + s[key] + '"';
console. log(""ss);
===========================================
let s: { [action: string]: string[] } = {};
for (let key in BOOSTS)
  for (let reaction in BOOSTS[key])
    for (let action in BOOSTS[key][reaction]) {
      if (!s[action]) {
        s[action] = [];
      }
      s[action].push(reaction);
    }

let ss = "";
for (let action in s) {
  ss += action + ", ";
  s[action].reverse();
}
console. log(`{${ss}}`);
console. log(JSON.stringify(s));
*/

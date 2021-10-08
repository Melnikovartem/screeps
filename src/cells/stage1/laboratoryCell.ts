import { Cell } from "../_Cell";

import { prefix, hiveStates } from "../../enums";

import { profile } from "../../profiler/decorator";
import type { Bee } from "../../bees/bee";
import type { Hive } from "../../Hive";

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

type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X";
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";
type BoostType = "harvest" | "build" | "dismantle" | "upgrade" | "attack" | "rangedAttack" | "heal" | "capacity" | "fatigue" | "damage";

const BOOST_MINERAL: { [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant] } = { "harvest": ["XUHO2", "UHO2", "UO"], "build": ["XLH2O", "LH2O", "LH"], "dismantle": ["XZH2O", "ZH2O", "ZH"], "upgrade": ["XGH2O", "GH2O", "GH"], "attack": ["XUH2O", "UH2O", "UH"], "rangedAttack": ["XKHO2", "KHO2", "KO"], "heal": ["XLHO2", "LHO2", "LO"], "capacity": ["XKH2O", "KH2O", "KH"], "fatigue": ["XZHO2", "ZHO2", "ZO"], "damage": ["XGHO2", "GHO2", "GO"] };
const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = { "harvest": WORK, "build": WORK, "dismantle": WORK, "upgrade": WORK, "attack": ATTACK, "rangedAttack": RANGED_ATTACK, "heal": HEAL, "capacity": CARRY, "fatigue": MOVE, "damage": TOUGH };


export const REACTION_MAP: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
for (const res1 in REACTIONS) {
  for (const res2 in REACTIONS[res1])
    REACTION_MAP[<ReactionConstant | BaseMineral>REACTIONS[res1][res2]] = {
      res1: <ReactionConstant | BaseMineral>res1,
      res2: <ReactionConstant | BaseMineral>res2,
    };
}

//reaction map done

interface SynthesizeRequest {
  plan: number,
  res: ReactionConstant,
  res1: ReactionConstant | BaseMineral,
  res2: ReactionConstant | BaseMineral,
  cooldown: number,
};

type BoostRequest = { type: BoostType, res?: ReactionConstant, amount?: number, lowLvl?: 0 | 1 | 2 }

@profile
export class LaboratoryCell extends Cell {
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  boostLabs: { [key in ResourceConstant]?: string } = {};
  boostRequests: { [id: string]: BoostRequest[] } = {};
  labsStates: { [id: string]: "idle" | "production" | "source" | ReactionConstant } = {}
  synthesizeRequests: SynthesizeRequest[] = [];
  currentProduction?: SynthesizeRequest;
  sourceLabs: [string, string] | undefined;
  master: undefined;

  constructor(hive: Hive) {
    super(hive, prefix.laboratoryCell + hive.room.name);
    this.pos = this.hive.getPos("lab");
  }

  updateProductionLabs() {
    if (this.currentProduction && this.sourceLabs) {
      let ans: StructureLab[] = [];
      _.forEach(this.laboratories, l => {
        if (this.labsStates[l.id] === "idle" && (!l.mineralType || l.mineralType === this.currentProduction!.res)
          && l.pos.getRangeTo(this.laboratories[this.sourceLabs![0]]) <= 2
          && l.pos.getRangeTo(this.laboratories[this.sourceLabs![1]]) <= 2) {
          this.labsStates[l.id] = "production";
          let storageCell = this.hive.cells.storage;
          if (storageCell)
            delete storageCell.requests["lab_" + l.id];
          ans.push(l);
        }
      });
    }
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!(resource in REACTION_TIME))
      return 0;
    if (!amount) {
      amount = 0;
      let res1Amount = this.getMineralSum(REACTION_MAP[resource]!.res1, true);
      let res2Amount = this.getMineralSum(REACTION_MAP[resource]!.res2, true);
      amount = Math.min(res1Amount, res2Amount);
    }
    amount -= amount % 5;
    if (coef)
      amount *= coef;
    if (amount > 0)
      this.synthesizeRequests.push({
        plan: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      });
    return amount;
  }

  getMineralSum(res: ReactionConstant | MineralConstant, source: boolean = false) {
    let sum = 0;
    let storageCell = this.hive.cells.storage;
    if (storageCell) {
      sum += storageCell.storage.store.getUsedCapacity(res);
      sum += _.sum(storageCell.master.activeBees, b => b.store.getUsedCapacity(res));
    }
    let inLabMax;
    if (source)
      inLabMax = Math.max(..._.map(_.filter(this.laboratories, l => this.labsStates[l.id] === "idle"
        || this.labsStates[l.id] === "production" || this.labsStates[l.id] === "source"), l => l.store.getUsedCapacity(res)));
    else
      if (this.boostLabs[res])
        inLabMax = this.laboratories[this.boostLabs[res]!].store.getUsedCapacity(res);
      else {
        inLabMax = Math.max(..._.map(_.filter(this.laboratories, l => this.labsStates[l.id] === "idle"), l => l.store.getUsedCapacity(res)));
        if (!inLabMax)
          inLabMax = Math.max(..._.map(_.filter(this.laboratories, l => this.labsStates[l.id] === "production"), l => l.store.getUsedCapacity(res)));
      }
    sum += Math.max(inLabMax, 0);
    return sum;
  }

  getBoostInfo(r: BoostRequest) {
    let storageCell = this.hive.cells.storage;
    if (storageCell && storageCell.master.activeBees.length)
      _.some(BOOST_MINERAL[r.type], (resIter, k) => {
        let sum = this.getMineralSum(resIter);
        if (sum > LAB_BOOST_MINERAL) {
          r.res = resIter;
          if (r.amount)
            r.amount = Math.min(r.amount, Math.floor(sum / LAB_BOOST_MINERAL));
        }
        if ((r.lowLvl ? r.lowLvl : 0) - k <= 0)
          return true;
        return r.res;
      });
    else
      r.amount = 0;
    return r;
  }

  // lowLvl : 0 - tier 3 , 1 - tier 2+, 2 - tier 1+
  askForBoost(bee: Bee, requests: BoostRequest[]) {
    let storageCell = this.hive.cells.storage;
    if (Game.time - bee.memory.born > 600
      || !storageCell || !storageCell.master.activeBees.length
      || !bee.master || !bee.master.boost)
      return OK;

    if (!this.boostRequests[bee.ref] || Game.time % 25 === 0) {
      this.boostRequests[bee.ref] = requests;
      for (let k = 0; k < this.boostRequests[bee.ref].length; ++k) {
        let r = this.boostRequests[bee.ref][k];
        if (!r.amount)
          r.amount = bee.getBodyParts(BOOST_PARTS[r.type], -1);

        this.boostRequests[bee.ref][k] = this.getBoostInfo(r);
      }
    }

    for (let k = 0; k < this.boostRequests[bee.ref].length; ++k) {
      let r = this.boostRequests[bee.ref][k];
      let lab: StructureLab | undefined;

      if (!r.res || !r.amount)
        continue;
      r.amount = Math.min(r.amount, bee.getBodyParts(BOOST_PARTS[r.type], -1));
      if (!r.amount)
        continue;

      if (this.boostLabs[r.res])
        lab = this.laboratories[this.boostLabs[r.res]!];
      else {
        _.some(this.laboratories, l => {
          if (this.labsStates[l.id] === "idle" && l.mineralType === r.res)
            lab = l;
          return lab;
        });
        if (!lab)
          _.some(this.laboratories, l => {
            if (this.labsStates[l.id] === "idle")
              lab = l;
            return lab;
          });
        if (!lab)
          _.some(this.laboratories, l => {
            if (this.labsStates[l.id] === "production" && l.mineralType === r.res)
              lab = l;
            return lab;
          });
        if (!lab)
          _.some(this.laboratories, l => {
            if (this.labsStates[l.id] === "production")
              lab = l;
            return lab;
          });
        if (!lab)
          _.some(this.laboratories, l => {
            if (!_.sum(this.boostRequests, br => br.filter(r => r.res == this.labsStates[l.id]).length))
              lab = l;
            return lab;
          });
        if (lab) {
          this.boostLabs[r.res!] = lab.id;
          this.labsStates[lab.id] = r.res!;
          delete storageCell.requests["lab_" + lab.id];
        }
      }

      if (!lab)
        continue;

      if (bee.creep.spawning)
        return ERR_BUSY;

      if (lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL
        && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= r.amount * LAB_BOOST_ENERGY) {
        let pos = lab.pos.getOpenPositions(true)[0];
        if (bee.pos.x === pos.x, bee.pos.y === pos.y) {
          let ans = lab.boostCreep(bee.creep, r.amount);
          if (ans === OK) {
            // bad things if 2 creeps want to be boosted at same time
            r.amount = 0;
            if (Apiary.logger) {
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_MINERAL, r.res);
              Apiary.logger.addResourceStat(this.hive.roomName, "boosts", r.amount * LAB_BOOST_ENERGY, RESOURCE_ENERGY);
            }
          }
        } else {
          bee.goRest(pos);
          return ERR_NOT_IN_RANGE;
        }
      }
      if (this.hive.state === hiveStates.lowenergy && lab.store.getUsedCapacity(RESOURCE_ENERGY) < r.amount * LAB_BOOST_ENERGY)
        continue; // help is not coming
      bee.goRest(this.pos);
      return ERR_TIRED;
    }

    delete this.boostRequests[bee.ref];
    return OK;
  }

  update() {
    super.update(["laboratories"]);
    let storageCell = this.hive.cells.storage;
    if (storageCell && Object.keys(this.laboratories).length) {
      for (let id in this.laboratories) {
        let l = this.laboratories[id];
        let state = this.labsStates[id];
        switch (state) {
          case undefined:
            this.labsStates[id] = "idle";
          case "idle":
            if (l.mineralType)
              storageCell.requestToStorage([l], 5, l.mineralType);
            break;
          case "source":
            break;
          case "production":
            let res = l.mineralType;
            if (res && !storageCell.requests[id] && (!this.currentProduction || res !== this.currentProduction.res
              || l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2))
              storageCell.requestToStorage([l], 3, res, l.store.getUsedCapacity(res));
            break;
          default: // boosting lab : state == resource
            if (l.mineralType && l.mineralType !== state)
              storageCell.requestToStorage([l], 1, l.mineralType);
            else if (!storageCell.requests[id] && l.store.getUsedCapacity(state) < LAB_MINERAL_CAPACITY / 2)
              storageCell.requestFromStorage([l], 1, state);

            if (!Object.keys(this.boostRequests).length && this.currentProduction) {
              this.labsStates[id] = "idle";
              delete this.boostLabs[state];
              if (l.mineralType)
                storageCell.requestToStorage([l], 3, l.mineralType);
            }
            break;
        }
      }

      if (this.currentProduction && this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];

        let updateSourceLab = (l: StructureLab, r: BaseMineral | ReactionConstant) => {
          let freeCap = l.store.getFreeCapacity(r);
          if ((freeCap > LAB_MINERAL_CAPACITY / 2 || this.currentProduction!.plan <= LAB_MINERAL_CAPACITY)
            && l.store.getUsedCapacity(r) < this.currentProduction!.plan)
            storageCell!.requestFromStorage([l], 3, r, Math.min(this.currentProduction!.plan, freeCap));
        };

        updateSourceLab(lab1, this.currentProduction.res1);
        updateSourceLab(lab2, this.currentProduction.res2);

        if (Game.time % 500 === 0)
          this.currentProduction.plan = Math.min(this.getMineralSum(this.currentProduction.res1), this.getMineralSum(this.currentProduction.res2));

        if (this.currentProduction.plan < 5) {
          this.labsStates[lab1.id] = "idle";
          this.labsStates[lab2.id] = "idle";
          this.currentProduction = undefined;
          this.sourceLabs = undefined;
          _.forEach(this.laboratories, l => {
            if (this.labsStates[l.id] === "production")
              this.labsStates[l.id] = "idle";
          });
        }
      } else {
        if (!this.currentProduction)
          this.currentProduction = this.synthesizeRequests.shift();

        if (!this.sourceLabs && this.currentProduction) {
          let res1 = this.currentProduction.res1;
          let res2 = this.currentProduction.res2;

          let check = (l: StructureLab, r: BaseMineral | ReactionConstant) =>
            this.labsStates[l.id] === "idle" && l.store.getFreeCapacity(r) + l.store.getUsedCapacity(r) >= 5;

          let maxDists: { [id: string]: number } = {}
          for (let id in this.laboratories)
            maxDists[id] = Math.max(..._.map(this.laboratories, l => this.laboratories[id].pos.getRangeTo(l)));
          let comp = (prev: StructureLab, curr: StructureLab, res: BaseMineral | ReactionConstant) => {
            let cond = maxDists[prev.id] - maxDists[curr.id];
            if (cond === 0)
              cond = curr.store.getUsedCapacity(res) - prev.store.getUsedCapacity(res);
            if (cond === 0)
              cond = prev.pos.getTimeForPath(storageCell!) - curr.pos.getTimeForPath(storageCell!);
            return cond > 0 ? curr : prev;
          }

          let lab1 = _.filter(this.laboratories, l => check(l, res1)).reduce((prev, curr) => comp(prev, curr, res1));
          let lab2;
          if (lab1)
            lab2 = _.filter(this.laboratories, l => check(l, res2) && l.id !== lab1.id).reduce((prev, curr) => comp(prev, curr, res2));

          if (lab1 && lab2) {
            this.labsStates[lab1.id] = "source";
            this.labsStates[lab2.id] = "source";
            delete storageCell.requests["lab_" + lab1.id];
            delete storageCell.requests["lab_" + lab2.id];
            this.sourceLabs = [lab1.id, lab2.id];
            this.updateProductionLabs();
          }
        }
      }

      let priority = <2 | 5>5;
      storageCell.requestFromStorage(_.filter(this.laboratories,
        l => {
          if (l.store.getUsedCapacity(RESOURCE_ENERGY) < LAB_ENERGY_CAPACITY / 4)
            priority = 2;
          return l.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }), priority, RESOURCE_ENERGY, LAB_ENERGY_CAPACITY, true);
    }
  }

  run() {
    if (this.currentProduction && Game.time % this.currentProduction.cooldown === 0 && this.currentProduction.plan >= 5) {
      if (this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        let amount = Math.min(lab1.store[this.currentProduction.res1], lab2.store[this.currentProduction.res2])
        if (amount >= 5) {
          if (Game.time % this.currentProduction.cooldown * 4 === 0)
            this.updateProductionLabs();
          let labs = _.filter(this.laboratories, lab => this.labsStates[lab.id] === "production"
            && !lab.cooldown && lab.store.getFreeCapacity(this.currentProduction!.res) >= 5);

          for (let k = 0; k < labs.length && amount >= 5; ++k) {
            let ans = labs[k].runReaction(lab1, lab2);
            if (ans === OK) {
              this.currentProduction.plan -= 5;
              amount -= 5;
              if (Apiary.logger) {
                Apiary.logger.addResourceStat(this.hive.roomName, "labs", 5, this.currentProduction.res);
                Apiary.logger.addResourceStat(this.hive.roomName, "labs", -5, this.currentProduction.res1);
                Apiary.logger.addResourceStat(this.hive.roomName, "labs", -5, this.currentProduction.res2);
              }
            }
          }
        }
      }
    }
  }
}

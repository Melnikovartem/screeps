import { Bee } from "../../bee";
import { Cell } from "../_Cell";
import { Hive } from "../../Hive";

import { profile } from "../../profiler/decorator";

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
console.log(ss);
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
for (let action in s)
  ss += action + ", ";
console.log(`{${ss}}`);
console.log(JSON.stringify(s));
*/



type BaseMineral = "H" | "O" | "Z" | "L" | "K" | "U" | "X";
export type ReactionConstant = "G" | "OH" | "ZK" | "UL" | "LH" | "ZH" | "GH" | "KH" | "UH" | "LO" | "ZO" | "KO" | "UO" | "GO" | "LH2O" | "KH2O" | "ZH2O" | "UH2O" | "GH2O" | "LHO2" | "UHO2" | "KHO2" | "ZHO2" | "GHO2" | "XUH2O" | "XUHO2" | "XKH2O" | "XKHO2" | "XLH2O" | "XLHO2" | "XZH2O" | "XZHO2" | "XGH2O" | "XGHO2";
type BoostType = "harvest" | "build" | "dismantle" | "upgrade" | "attack" | "rangedAttack" | "heal" | "capacity" | "fatigue" | "damage";

const BOOST_MINERAL: { [key in BoostType]: [ReactionConstant, ReactionConstant, ReactionConstant] } = { "harvest": ["UO", "UHO2", "XUHO2"], "build": ["LH", "LH2O", "XLH2O"], "dismantle": ["ZH", "ZH2O", "XZH2O"], "upgrade": ["GH", "GH2O", "XGH2O"], "attack": ["UH", "UH2O", "XUH2O"], "rangedAttack": ["KO", "KHO2", "XKHO2"], "heal": ["LO", "LHO2", "XLHO2"], "capacity": ["KH", "KH2O", "XKH2O"], "fatigue": ["ZO", "ZHO2", "XZHO2"], "damage": ["GO", "GHO2", "XGHO2"] };
const BOOST_PARTS: { [key in BoostType]: BodyPartConstant } = { "harvest": WORK, "build": WORK, "dismantle": WORK, "upgrade": WORK, "attack": ATTACK, "rangedAttack": RANGED_ATTACK, "heal": HEAL, "capacity": CARRY, "fatigue": MOVE, "damage": TOUGH };

const REACTION_MAP: { [key in ReactionConstant | BaseMineral]?: { res1: ReactionConstant | BaseMineral, res2: ReactionConstant | BaseMineral } } = {};
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
  current: number,
  res: ReactionConstant,
  res1: ReactionConstant | BaseMineral,
  res2: ReactionConstant | BaseMineral,
  cooldown: number,
};

@profile
export class laboratoryCell extends Cell {
  laboratories: { [id: string]: StructureLab } = {};
  // inLab check for delivery system
  boostLabs: { [key in ResourceConstant]?: string } = {};
  boostRequests: { [id: string]: { type: BoostType, res?: ReactionConstant, amount?: number }[] } = {};
  labsStates: { [id: string]: "idle" | "production" | "source" | ReactionConstant } = {}
  synthesizeRequests: SynthesizeRequest[] = [];
  currentRequest?: SynthesizeRequest;
  sourceLabs: [string, string] | undefined;

  constructor(hive: Hive) {
    super(hive, "LaboratoryCell_" + hive.room.name);
  }

  updateProductionLabs() {
    if (this.currentRequest) {
      let ans: StructureLab[] = [];
      _.forEach(this.laboratories, (l) => {
        if (this.labsStates[l.id] === "idle" && (!l.mineralType || l.mineralType === this.currentRequest!.res)) {
          this.labsStates[l.id] = "production";
          ans.push(l);
        }
      });
    }
  }

  newSynthesizeRequest(resource: ReactionConstant, amount?: number, coef?: number): number {
    if (!Object.keys(REACTION_TIME).includes(resource))
      return 0;
    if (!amount) {
      amount = 0;
      let mainStore = this.hive.cells.storage && this.hive.cells.storage.storage.store;
      if (mainStore) {
        let res1 = REACTION_MAP[resource]!.res1;
        let res2 = REACTION_MAP[resource]!.res2;
        let res1Amount = mainStore.getUsedCapacity(res1) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res1));
        let res2Amount = mainStore.getUsedCapacity(res2) + _.sum(this.laboratories, (lab) => lab.store.getUsedCapacity(res2));
        amount = Math.min(res1Amount, res2Amount);
      }
    }
    amount -= amount % 5;
    if (coef)
      amount *= coef;
    if (amount > 0)
      this.synthesizeRequests.push({
        plan: amount,
        current: amount,
        res: resource,
        res1: REACTION_MAP[resource]!.res1,
        res2: REACTION_MAP[resource]!.res2,
        cooldown: REACTION_TIME[resource],
      });
    return amount;
  }

  askForBoost(bee: Bee, requests: { type: BoostType, amount?: number }[]) {
    let storageCell = this.hive.cells.storage;
    if (storageCell && storageCell!.master.manager) {
      if (!this.boostRequests[bee.ref] || Game.time % 25 === 0) {
        this.boostRequests[bee.ref] = requests;
        for (let k in this.boostRequests[bee.ref]) {
          let r = this.boostRequests[bee.ref][k];
          if (!r.amount)
            r.amount = bee.getBodyParts(BOOST_PARTS[r.type], -1);
          _.some(BOOST_MINERAL[r.type], (resIter) => {
            if (this.boostLabs[resIter]) {
              r.res = resIter;
              return true;
            }
            let sum = storageCell!.storage.store.getUsedCapacity(resIter)
              + storageCell!.master.manager!.store.getUsedCapacity(resIter)
              + _.sum(this.laboratories, (l) => l.store.getUsedCapacity(resIter));
            if (sum > LAB_BOOST_MINERAL) {
              r.res = resIter;
              r.amount = Math.min(r.amount!, Math.floor(sum / LAB_BOOST_MINERAL));
            }
            return r.res;
          });
        }
      }
      for (let k in this.boostRequests[bee.ref]) {
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
          _.some(this.laboratories, (l) => {
            if (this.labsStates[l.id] === "idle" && l.mineralType === r.res) {
              lab = l;
              this.boostLabs[r.res] = l.id;
              this.labsStates[l.id] = r.res;
            }
            return lab;
          });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "idle") {
                lab = l;
                this.boostLabs[r.res!] = l.id;
                this.labsStates[l.id] = r.res!;
              }
              return lab;
            });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "production" && l.mineralType === r.res) {
                lab = l;
                this.boostLabs[r.res] = l.id;
                this.labsStates[l.id] = r.res;
              }
              return lab;
            });
          if (!lab)
            _.some(this.laboratories, (l) => {
              if (this.labsStates[l.id] === "production") {
                lab = l;
                this.boostLabs[r.res!] = l.id;
                this.labsStates[l.id] = r.res!;
              }
              return lab;
            });
        }

        if (lab)
          if (lab.store.getUsedCapacity(r.res) >= LAB_BOOST_MINERAL && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= LAB_BOOST_ENERGY) {
            if (lab.store.getUsedCapacity(r.res) >= r.amount * LAB_BOOST_MINERAL
              && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= r.amount * LAB_BOOST_ENERGY)
              if (bee.pos.isNearTo(lab)) {
                let ans = lab.boostCreep(bee.creep, r.amount);
                if (ans === OK && Apiary.logger) {
                  // bad things if 2 creeps want to be boosted at same time
                  Apiary.logger.addResourceStat(this.hive.roomName, "labs", r.amount * LAB_BOOST_MINERAL, r.res);
                  Apiary.logger.addResourceStat(this.hive.roomName, "labs", r.amount * LAB_BOOST_ENERGY, RESOURCE_ENERGY);
                }
              } else {
                let pos = lab.pos.getOpenPositions(true)[0];
                bee.goRest(pos);
                return ERR_NOT_IN_RANGE;
              }
          } else
            bee.goRest(this.pos);
        return ERR_TIRED;
      }
    }
    delete this.boostRequests[bee.ref];
    return OK;
  }

  update() {
    super.update(["laboratories"]);
    let storageCell = this.hive.cells.storage;
    if (storageCell && Object.keys(this.laboratories).length) {
      _.forEach(this.laboratories, (l) => {
        let state = this.labsStates[l.id];
        let res: MineralConstant | ReactionConstant | null;
        switch (state) {
          case undefined:
            this.labsStates[l.id] = "idle";
          case "idle":
            res = l.mineralType;
            if (res)
              storageCell!.requestToStorage(l.id, [l], 4, [res]);
            break;
          case "source":
            break;
          case "production":
            res = l.mineralType;
            if (res && !storageCell!.requests[l.id] && (!this.currentRequest || res !== this.currentRequest.res
              || l.store.getUsedCapacity(res) >= LAB_MINERAL_CAPACITY / 2))
              storageCell!.requestToStorage(l.id, [l], 3, [res]);
            break;
          default: // boosting lab
            // producing and dont need the boost TODO
            res = state;
            if (l.mineralType && l.mineralType !== res)
              storageCell!.requestToStorage(l.id, [l], 2, [l.mineralType]);
            if (!storageCell!.requests[l.id] && l.store.getUsedCapacity(res) < LAB_MINERAL_CAPACITY / 2)
              storageCell!.requestFromStorage(l.id, [l], 2, [res]);
            break;
        }
      });

      if (this.currentRequest && this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        let res1 = this.currentRequest.res1;
        let res2 = this.currentRequest.res2;

        if (lab1.store.getUsedCapacity(res1) < this.currentRequest.current && lab1.store.getFreeCapacity(res1) > LAB_MINERAL_CAPACITY / 2)
          storageCell.requestFromStorage("lab_" + lab1.id, [lab1], 3, [res1]);
        if (lab2.store.getUsedCapacity(res2) < this.currentRequest.current && lab2.store.getFreeCapacity(res2) > LAB_MINERAL_CAPACITY / 2)
          storageCell.requestFromStorage("lab_" + lab2.id, [lab2], 3, [res2]);

        if (this.currentRequest.plan - this.currentRequest.current > LAB_MINERAL_CAPACITY / 2) {
          this.currentRequest.plan -= this.currentRequest.current;
        } else if (this.currentRequest.current < 5) {
          this.labsStates[lab1.id] = "idle";
          this.labsStates[lab2.id] = "idle";
          this.currentRequest = undefined;
          this.sourceLabs = undefined;
          _.forEach(this.laboratories, (l) => {
            if (this.labsStates[l.id] === "production")
              this.labsStates[l.id] = "idle";
          });
        }
      } else {
        if (!this.currentRequest)
          this.currentRequest = this.synthesizeRequests.shift();

        if (!this.sourceLabs && this.currentRequest) {
          let lab1 = _.filter(this.laboratories, (l) => this.labsStates[l.id] === "idle"
            && (l.store.getFreeCapacity() === 0 || l.store.getUsedCapacity(this.currentRequest!.res1)))[0];
          let lab2;
          if (lab1)
            lab2 = _.filter(this.laboratories, (l) => this.labsStates[l.id] === "idle"
              && (l.store.getFreeCapacity() === 0 || l.store.getUsedCapacity(this.currentRequest!.res2))
              && l.id !== lab1.id)[0];

          if (lab1 && lab2) {
            this.labsStates[lab1.id] = "source";
            this.labsStates[lab2.id] = "source";
            this.sourceLabs = [lab1.id, lab2.id];
            this.updateProductionLabs();
          }
        }

        // bring to boost

        _.forEach(this.laboratories, (lab) => {
          if (lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 4)
            storageCell!.requestFromStorage("lab_" + lab.id, [lab], lab.store.getFreeCapacity(RESOURCE_ENERGY) > LAB_ENERGY_CAPACITY / 2 ? 2 : 5);
        });
      }
    }
  }

  run() {
    if (this.currentRequest && Game.time % this.currentRequest.cooldown === 0 && this.currentRequest.current > 0) {
      if (this.sourceLabs) {
        let lab1 = this.laboratories[this.sourceLabs[0]];
        let lab2 = this.laboratories[this.sourceLabs[1]];
        if (lab1.store[this.currentRequest.res1] >= 5 && lab2.store[this.currentRequest.res2] >= 5) {
          this.updateProductionLabs();
          let labs = _.filter(this.laboratories, (lab) => !lab.cooldown &&
            this.labsStates[lab.id] === "production" && lab.store.getFreeCapacity(this.currentRequest!.res) >= 5);
          for (const k in labs)
            if (labs[k].runReaction(lab1, lab2) === OK)
              this.currentRequest.current -= 5;
        }
      }
    }

    // here some boost logic
  }
}

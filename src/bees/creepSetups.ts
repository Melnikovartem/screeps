// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
import { profile } from "../profiler/decorator";

interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}

const partsImportance = [TOUGH, WORK, CARRY, CLAIM, MOVE, RANGED_ATTACK, ATTACK, HEAL];

@profile
export class CreepSetup {
  name: string;
  fixed: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit: number;
  moveMax: number | "best";

  constructor(setupName: string, bodySetup: BodySetup, moveMax: number | "best") {
    this.name = setupName;

    this.moveMax = moveMax;
    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit ? bodySetup.patternLimit : Infinity;
  }

  getBody(energy: number, moveMax: number = this.moveMax === "best" ? 25 : this.moveMax): { body: BodyPartConstant[], cost: number } {
    let body: BodyPartConstant[] = [];
    let nonMoveMax = MAX_CREEP_SIZE - moveMax;
    let nonMove = 0;

    let addPattern = (pattern: BodyPartConstant[]) => {
      if (nonMove + pattern.length <= nonMoveMax)
        _.forEach(pattern, (s) => {

          if (body.length >= MAX_CREEP_SIZE)
            return;

          if (nonMove < nonMoveMax) {
            body.push(s);
            if (s !== MOVE)
              ++nonMove;
          }

          if (Math.ceil(nonMove / nonMoveMax * moveMax - 0.0001) > body.length - nonMove && body.length < MAX_CREEP_SIZE)
            body.push(MOVE);
        });
    };

    energy = Math.floor(energy * (MAX_CREEP_SIZE - moveMax) / MAX_CREEP_SIZE);
    let fixedCosts = _.sum(this.fixed, s => BODYPART_COST[s]);
    if (fixedCosts <= energy)
      addPattern(this.fixed);
    else
      fixedCosts = 0;

    let segmentCost = _.sum(this.pattern, s => BODYPART_COST[s]);
    let maxSegment = Math.min(this.patternLimit, Math.floor(nonMoveMax - nonMove) / this.pattern.length, Math.floor((energy - fixedCosts) / segmentCost));
    _.times(maxSegment, () => {
      addPattern(this.pattern);
    });

    body.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));
    let index = body.indexOf(MOVE);
    if (index !== -1) {
      body.splice(index, 1);
      body.push(MOVE);
    }

    return {
      body: body,
      cost: fixedCosts + segmentCost * maxSegment,
    };
  }
}

export const SetupsNames = {
  // Civilian
  claimer: 'Bee drone',
  manager: 'Stingless bee',
  hauler: 'Bumblebee',
  miner: 'Andrena',
  upgrader: 'Honey bee',
  builder: 'Colletidae',
  scout: 'Stenotritidae',
  bootstrap: 'Bee larva',
  queen: 'Bee queen',
  // War
  knight: 'European hornet',
  tank: "Red paper wasp",
  dismantler: 'Dolichovespula arenaria',
  healer: 'Bald-faced hornet',
  defender: 'Vespa affinis',
}


export const Setups = {
  claimer: new CreepSetup(SetupsNames.claimer, {
    pattern: [CLAIM],
    patternLimit: 1,
  }, 25),
  queen: new CreepSetup(SetupsNames.queen, {
    pattern: [CARRY],
  }, 50 / 3),
  manager: new CreepSetup(SetupsNames.manager, {
    pattern: [CARRY],
    patternLimit: 14,
  }, 50 / 3),
  hauler: new CreepSetup(SetupsNames.hauler, {
    fixed: [WORK],
    pattern: [CARRY],
  }, 50 / 3),
  pickup: new CreepSetup(SetupsNames.hauler + " P", {
    pattern: [CARRY],
    patternLimit: 30,
  }, 50 / 3),
  miner: {
    energy: new CreepSetup(SetupsNames.miner, {
      fixed: [CARRY],
      pattern: [WORK],
      patternLimit: 6,
    }, 15),
    minerals: new CreepSetup(SetupsNames.miner + " M", {
      fixed: [CARRY],
      pattern: [WORK],
    }, 10),
    power: new CreepSetup(SetupsNames.miner + " P", {
      pattern: [ATTACK],
      patternLimit: 20,
    }, 25)
  },
  upgrader: {
    manual: new CreepSetup(SetupsNames.upgrader, {
      pattern: [WORK, CARRY],
      patternLimit: 10,
    }, 50 / 3),
    fast: new CreepSetup(SetupsNames.upgrader, {
      fixed: [CARRY],
      pattern: [WORK],
    }, 10),
  },
  builder: new CreepSetup(SetupsNames.builder, {
    pattern: [WORK, CARRY],
    patternLimit: 10, // not sure if you need anyone bigger than that
  }, 50 / 3),
  bootstrap: new CreepSetup(SetupsNames.bootstrap, {
    pattern: [WORK, CARRY],
    patternLimit: 6,
  }, 50 / 3),
  puppet: new CreepSetup(SetupsNames.scout, {
    pattern: [MOVE],
    patternLimit: 1,
  }, 25),
  defender: {
    normal: new CreepSetup(SetupsNames.defender, {
      fixed: [HEAL],
      pattern: [RANGED_ATTACK],
      patternLimit: 4,
    }, "best"),
    sk: new CreepSetup(SetupsNames.defender + " SK", {
      fixed: [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK],
      pattern: [RANGED_ATTACK, HEAL],
      patternLimit: 9,
    }, 25),
  },
  knight: new CreepSetup(SetupsNames.knight, {
    fixed: [TOUGH],
    pattern: [RANGED_ATTACK, RANGED_ATTACK, HEAL],
  }, "best"),
  dismantler: new CreepSetup(SetupsNames.dismantler, {
    pattern: [WORK, TOUGH],
  }, 50 / 3),
  healer: new CreepSetup(SetupsNames.healer, {
    pattern: [HEAL],
  }, "best"),
}

/*
let printSetup = (s: CreepSetup) => {
  let bbody = s.getBody(Infinity).body;
  console.log(s.name, ":", bbody.length, bbody.filter((s) => s != MOVE).length)
}

printSetup(Setups.claimer)
printSetup(Setups.queen)
printSetup(Setups.manager)
printSetup(Setups.hauler)
printSetup(Setups.pickup)
printSetup(Setups.miner.energy)
printSetup(Setups.miner.minerals)
printSetup(Setups.miner.power)
printSetup(Setups.upgrader.fast)
printSetup(Setups.upgrader.manual)
printSetup(Setups.builder)
printSetup(Setups.bootstrap)
printSetup(Setups.puppet)
printSetup(Setups.defender.normal)
printSetup(Setups.defender.sk)
printSetup(Setups.knight)
printSetup(Setups.dismantler)
printSetup(Setups.healer)
*/

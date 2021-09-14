// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
import { profile } from "../profiler/decorator";

interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}

const partsImportance = [TOUGH, WORK, CARRY, CLAIM, MOVE, RANGED_ATTACK, ATTACK, HEAL]

@profile
export class CreepSetup {
  name: string;
  fixed: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit: number;

  constructor(setupName: string, bodySetup: BodySetup) {
    this.name = setupName;

    this.fixed = bodySetup.fixed ? bodySetup.fixed : [];
    this.pattern = bodySetup.pattern;
    this.patternLimit = bodySetup.patternLimit ? bodySetup.patternLimit : Infinity;
  }

  getBody(energy: number): { body: BodyPartConstant[], cost: number } {
    let body: BodyPartConstant[] = [];

    _.forEach(this.fixed, (s) => body.push(s));
    let fixedCosts = _.sum(body, s => BODYPART_COST[s]);

    let segmentCost = _.sum(this.pattern, s => BODYPART_COST[s]);
    let maxSegment = Math.min(this.patternLimit, Math.floor((energy - fixedCosts) / segmentCost));
    _.times(maxSegment, () => {
      if (this.pattern.length + body.length <= 50)
        _.forEach(this.pattern, (s) => body.push(s))
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
  claimer: {
    normal: new CreepSetup(SetupsNames.claimer, {
      pattern: [CLAIM, MOVE],
      patternLimit: 1,
    }),
    double: new CreepSetup(SetupsNames.claimer, {
      pattern: [CLAIM, MOVE],
      patternLimit: 2,
    }),
    carapaced: new CreepSetup(SetupsNames.claimer, {
      fixed: [CLAIM, MOVE],
      pattern: [TOUGH, MOVE],
      patternLimit: 10,
    }),
  },
  queen: new CreepSetup(SetupsNames.queen, {
    pattern: [CARRY, CARRY, MOVE],
  }),
  manager: new CreepSetup(SetupsNames.manager, {
    pattern: [CARRY, CARRY, MOVE],
    patternLimit: 15,
  }),
  hauler: new CreepSetup(SetupsNames.hauler, {
    fixed: [WORK, CARRY, MOVE],
    pattern: [CARRY, CARRY, MOVE],
  }),
  pickup: new CreepSetup(SetupsNames.hauler, {
    pattern: [CARRY, CARRY, MOVE],
    patternLimit: 15,
  }),
  miner: {
    energy: new CreepSetup(SetupsNames.miner, {
      pattern: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      patternLimit: 1,
    }),
    minerals: new CreepSetup(SetupsNames.miner + " M", {
      fixed: [WORK, WORK, WORK, WORK, CARRY, MOVE],
      pattern: [WORK, WORK, WORK, WORK, WORK, MOVE],
    })
  },
  upgrader: {
    manual: new CreepSetup(SetupsNames.upgrader, {
      pattern: [WORK, CARRY, MOVE],
      patternLimit: 10,
    }),
    fast: new CreepSetup(SetupsNames.upgrader, {
      fixed: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE],
      pattern: [WORK, WORK, WORK, WORK, WORK, MOVE],
      patternLimit: 5,
    }),
  },
  builder: new CreepSetup(SetupsNames.builder, {
    pattern: [WORK, CARRY, MOVE],
    patternLimit: 10, // not sure if you need anyone bigger than that
  }),
  bootstrap: new CreepSetup(SetupsNames.bootstrap, {
    pattern: [WORK, CARRY, MOVE],
    patternLimit: 6,
  }),
  puppet: new CreepSetup(SetupsNames.scout, {
    pattern: [MOVE],
    patternLimit: 1,
  }),
  defender: new CreepSetup(SetupsNames.defender, {
    fixed: [HEAL, MOVE],
    pattern: [RANGED_ATTACK, MOVE],
    patternLimit: 4,
  }),
  knight: new CreepSetup(SetupsNames.knight, {
    fixed: [TOUGH, MOVE],
    pattern: [RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE, MOVE],
  }),
  tank: new CreepSetup(SetupsNames.tank, {
    fixed: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE],
    pattern: [ATTACK, MOVE],
  }),
  dismantler: new CreepSetup(SetupsNames.dismantler, {
    pattern: [WORK, TOUGH, MOVE],
  }),
  healer: new CreepSetup(SetupsNames.healer, {
    pattern: [HEAL, MOVE],
  }),
}

// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
interface BodySetup {
  fixed?: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit?: number;
}

const partsImportance = [TOUGH, MOVE, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL]

export class CreepSetup {
  name: string;
  bodySetup: BodySetup;

  constructor(setupName: string, bodySetup: BodySetup) {
    this.name = setupName;

    this.bodySetup = {
      fixed: [],
      pattern: [],
      patternLimit: Infinity,
    };

    this.bodySetup = bodySetup;
  }

  getBody(energy: number): BodyPartConstant[] {
    let body: BodyPartConstant[] = [];
    if (this.bodySetup.fixed)
      body = this.bodySetup.fixed;

    let fixedCosts = _.sum(body, s => BODYPART_COST[s]);

    let segmentCost = _.sum(this.bodySetup.pattern, s => BODYPART_COST[s]);

    let limitSegments = Infinity;
    if (this.bodySetup.patternLimit)
      limitSegments = this.bodySetup.patternLimit;

    let maxSegment = Math.min(limitSegments, Math.floor((energy - fixedCosts) / segmentCost));

    _.forEach(this.bodySetup.pattern, (s) => _.times(maxSegment, () => body.push(s)));

    return body.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));
  }


}

const SetupsNames = {
  // Civilian
  starter: 'Just a bee',
  claimer: 'Bee Drone',
  manager: 'Stingless bee',
  hauler: 'Bumblebee',
  miner: 'Andrena',
  upgrader: 'Honey bee',
  builder: 'Colletidae',
  scout: 'Stenotritidae',
}


export const Setups = {
  starter: new CreepSetup(SetupsNames.starter, {
    pattern: [WORK, CARRY, MOVE],
  }),
  claimer: new CreepSetup(SetupsNames.claimer, {
    pattern: [CLAIM, MOVE],
    patternLimit: 2,
  }),
  manager: new CreepSetup(SetupsNames.manager, {
    pattern: [CARRY, CARRY, MOVE],
    patternLimit: 6,
  }),
  hauler: new CreepSetup(SetupsNames.hauler, {
    pattern: [CARRY, CARRY, MOVE],
    patternLimit: 15,
  }),
  miner: {
    energy: new CreepSetup(SetupsNames.miner, {
      pattern: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      patternLimit: 1,
    })
  },
  upgrader: {
    manual: new CreepSetup(SetupsNames.upgrader, {
      pattern: [WORK, CARRY, MOVE],
      patternLimit: 11,
    }),
    fast: new CreepSetup(SetupsNames.upgrader, {
      fixed: [WORK, CARRY, MOVE],
      pattern: [WORK, WORK, MOVE],
      patternLimit: 5,
    }),
  },
  builder: new CreepSetup(SetupsNames.builder, {
    pattern: [WORK, CARRY, MOVE],
    patternLimit: 11, // not sure if you need anyone bigger than that
  }),
  puppet: new CreepSetup(SetupsNames.scout, {
    pattern: [MOVE],
    patternLimit: 1,
  }),
}

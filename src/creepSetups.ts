// body generating idea from overmind kinda
// i think i dont need custom ordered creeps
interface BodySetup {
  fixed: BodyPartConstant[];
  pattern: BodyPartConstant[];
  patternLimit: number;
}

const partsImportance = [TOUGH, MOVE, WORK, CARRY, CLAIM, RANGED_ATTACK, ATTACK, HEAL]

export class CreepSetup {
  name: string;
  bodySetup: BodySetup;

  constructor(setupName: string, bodySetup: {}) {
    this.name = setupName;

    this.bodySetup = {
      fixed: [],
      pattern: [],
      patternLimit: Infinity,
    };

    this.bodySetup = bodySetup as BodySetup;
    console.log(this.bodySetup.patternLimit);
  }

  getBody(energy: number): BodyPartConstant[] {
    let body: BodyPartConstant[] = this.bodySetup.fixed;

    let fixedCosts = _.sum(body, s => BODYPART_COST[s]);

    let segmentCost = _.sum(this.bodySetup.pattern, s => BODYPART_COST[s]);

    let maxSegment = Math.min(2, Math.floor((energy - fixedCosts) / segmentCost));

    _.forEach(this.bodySetup.pattern, (s) => _.times(maxSegment, () => body.push(s)));

    return body.sort((a, b) => partsImportance.indexOf(a) - partsImportance.indexOf(b));
  }


}


const SetupsNames = {
  // Civilian
  starter: 'Just a bee',
  claimer: 'Bee Drone',
  manager: 'Andrenidae',
  hauler: 'Bumblebee',
  miner: 'Andrena',
  upgrader: 'Honey bee',
  builder: 'Colletidae',
}


export const Setups = {
  starter: new CreepSetup(SetupsNames.starter, {
    pattern: [WORK, CARRY, MOVE],
  }),
  claimer: new CreepSetup(SetupsNames.claimer, {
    pattern: [CLAIM, MOVE],
    sizeLimit: 2,
  }),
  manager: new CreepSetup(SetupsNames.manager, {
    pattern: [CARRY, CARRY, MOVE],
    sizeLimit: 15,
  }),
  hauler: new CreepSetup(SetupsNames.hauler, {
    pattern: [CARRY, CARRY, MOVE],
    sizeLimit: 15,
  }),
  miner: {
    energy: new CreepSetup(SetupsNames.miner, {
      pattern: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      sizeLimit: 1,
    })
  },
  upgrader: new CreepSetup(SetupsNames.upgrader, {
    fixed: [WORK, CARRY, MOVE],
    pattern: [WORK, WORK, MOVE],
    sizeLimit: 6,
  }),
  builder: new CreepSetup(SetupsNames.builder, {
    pattern: [WORK, CARRY, MOVE],
  }),
}

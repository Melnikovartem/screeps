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

// this.cpuPrev = { real: Game.cpu.getUsed(), acc: 0 };
/* if (Game.time % 10 == 0) {
      let cpuNew = { real: Game.cpu.getUsed(), acc: _.sum(Memory.log.cpuUsage.update, c => c.cpu) + _.sum(Memory.log.cpuUsage.run, c => c.cpu) };
      console .log("1", cpuNew.real - this.cpuPrev.real, cpuNew.acc - this.cpuPrev.acc, (cpuNew.real - this.cpuPrev.real) - (cpuNew.acc - this.cpuPrev.acc));
      this.cpuPrev = cpuNew;
    } */

/*
let printSetup = (s: CreepSetup, energy = Infinity, moveMax?: number) => {
  let setup = s.getBody(energy, moveMax);
  let nonMoveLen = setup.body.filter(s => s != MOVE).length;
  console .log(`${s.name}: ${nonMoveLen}/${setup.body.length} aka ${Math.round(nonMoveLen / setup.body.length * 1000) / 10}% cost: ${setup.cost}/${energy}`);
  return setup.body;
}

printSetup(setups.defender.sk)

/*
printSetup(new CreepSetup("test bee", {
  pattern: [MOVE],
}, 50), 10000)

printSetup(setups.defender.destroyer, 650)
printSetup(setups.hauler, 3000)
printSetup(setups.defender.destroyer, 650)
printSetup(setups.bootstrap, 600)
printSetup(setups.queen)
printSetup(setups.claimer)
printSetup(setups.manager)
printSetup(setups.queen, 1000)
printSetup(setups.pickup)
printSetup(setups.miner.energy)
printSetup(setups.miner.minerals)
printSetup(setups.miner.power)
printSetup(setups.upgrader.fast)
printSetup(setups.upgrader.manual)
printSetup(setups.builder, 1300)
printSetup(setups.puppet)
printSetup(setups.defender.normal)
printSetup(setups.defender.sk)
printSetup(setups.archer, 975)
printSetup(setups.dismantler)
printSetup(setups.healer, 1300)
printSetup(setups.archer, undefined, 10);
printSetup(setups.healer, undefined, 10);
printSetup(setups.archer, undefined, 17);
*/

// console .log(rCode, JSON.stringify(this.boostRequests[bee.ref]), _.map(this.boostRequests[bee.ref], d => `${bee.getBodyParts(BOOST_PARTS[d.type], 1)} ${d.res}`))

/* finding overused cpu
let cpu = Game.cpu.getUsed();
let totalCpu = 0;
const testingCpu = Game.shard.name === "shard3" &&
  this.hive.room.name === "E39S19" && {
    it: (ref: string) => {
      const diff = Game.cpu.getUsed() - cpu;
      totalCpu += diff;
      console.log("after", ref, Math.round(diff * 1000) / 1000);
      cpu = Game.cpu.getUsed();
    },
    total: () => console.log("\ttotal cpu:", totalCpu),
  };
if (testingCpu) testingCpu.it("");
if (testingCpu) testingCpu.total();
*/

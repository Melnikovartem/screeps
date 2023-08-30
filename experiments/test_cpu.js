if (Game.shard.name === "shard3") return;
let cpu = Game.cpu.getUsed();
const id = "f82a56fcdd219d564e94a59f";
if (!global.res) {
  global.res = {};
  global.n = 1;
} else global.n += 1;

const cpu_metric = (ref, f) => {
  let cpu = Game.cpu.getUsed();
  f();
  const diff = Game.cpu.getUsed() - cpu;
  let mem = global.res;
  if (mem[ref] == undefined) mem[ref] = 0;
  mem[ref] += diff;
};

if (!Memory.test) Memory.test = {};

let max_ref = 0;
let num_ref = 0;
const measure = (
  ref,
  func,
  prefix_func = (i, r, a) => {},
  postfix_func = (b) => {},
  it = 100000
) => {
  if (ref.length > max_ref) max_ref = ref.length;
  const f = () => {
    let a = prefix_func();
    let b = {};
    let r;
    for (let i = 0; i < it; ++i) {
      let ans = func(i, r, a);
      if (ans != undefined) b[i] = ans;
    }
    postfix_func(b);
  };
  return () => cpu_metric(num_ref + ref, f);
  num_ref = Math.min(num_ref + 1, 9);
};

if (global.test == undefined) {
  console.log("____________________".repeat(5));
  global.test = {
    controller: Game.getObjectById(id),
    spaw: Game.getObjectById("61d324ab0725f75f37de40ba"),
  };
}

if (!Memory.test.controllers) Memory.test.controllers = {};

let controller = Game.getObjectById(id);

let metrics = [
  measure(
    "get before",
    (i, r, a) => {
      a[i];
    },
    () => Memory.test.controllers
  ),
  measure("get iteration", (i, r, a) => {
    Memory.test.controllers[i];
  }),
  measure("set iteration", (i, r, a) => {
    Memory.test.controllers[i] = controller;
  }),
  measure(
    "set after",
    (i, r, a) => controller,
    () => {},
    (b) => {
      Memory.test.controllers = b;
    }
  ),
  measure("_get big", () => Memory.cache),
];

for (let i = metrics.length - 1; i >= 0; i--) {
  const j = Math.floor(Math.random() * metrics.length);
  metrics[j]();
  metrics.splice(j, 1);
}

console.log();
for (const [reff, value] of Object.entries(global.res).sort(
  (a, b) => a[0] > b[0]
)) {
  let ref = reff.slice(1);
  const pad = " ".repeat(max_ref - ref.length);
  console.log(ref + pad, "\t", value / global.n);
}
if (global.cpuuu === undefined) global.cpuuu = 0;
global.cpuuu += Game.cpu.getUsed();
console.log("cpu", cpuuu / global.n);

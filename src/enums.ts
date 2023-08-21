export enum hiveStates {
  economy = 0,
  lowenergy = 1,
  nospawn = 2,
  nukealert = 6,
  battle = 7,
}

export enum enemyTypes {
  static = 0,
  moving = 1,
}

export enum roomStates {
  ownedByMe = 0,
  reservedByMe = 1,
  noOwner = 2,
  corridor = 3,
  SKcentral = 4,
  SKfrontier = 5,
  reservedByInvader = 6,
  reservedByEnemy = 7,
  ownedByEnemy = 8,
}

export enum beeStates {
  idle = 0,
  chill = 1,
  work = 2,
  fflush = 3,
  refill = 4,
  boosting = 5,
}

export enum prefix {
  // orders
  // upgrade = "polen",
  steal = "_borrow_",
  build = "wax",
  surrender = "FFF",
  boost = "boost_",
  defSwarm = "def_",
  puppet = "pup_",
  annex = "annex_",
  claim = "claim",
  mine = "mine_",
  clear = "clear_",
  // haltlab = "haltlab_",
  // nukes = "nukes_",
  // terminal = "terminal_",
  powerMining = "power_",
  depositMining = "deposit_",
  downgrade = "downgrade_",

  // deposit master
  miner = "_miner",
  pickup = "_pickup",

  // TODO shorten?

  // cells
  defenseCell = "def",
  respawnCell = "spawn",
  developmentCell = "dev",
  excavationCell = "excav",
  fastRefillCell = "fastRef",
  laboratoryCell = "lab",
  resourceCells = "res",
  storageCell = "storage",
  upgradeCell = "upgrade",
  observerCell = "observe",
  powerCell = "power",
  factoryCell = "factory",

  builder = "builder_",
  puller = "puller_",

  // game constants
  master = "master_",
  swarm = "swarm_",

  nkvd = "NKVD'shnik",
  kgb = "KGB'shnik",
}

export enum signText {
  my = "🐝✨❤️",
  annex = "🐝⛏️🔥",
  other = "🐝☠️🤖",
}

export enum setupsNames_old {
  // Civilian
  claimer = "Bee drone",
  manager = "Stingless bee",
  hauler = "Bumblebee",
  miner = "Andrena",
  upgrader = "Honey bee",
  builder = "Colletidae",
  scout = "Stenotritidae",
  bootstrap = "Bee larva",
  queen = "Bee queen",
  // War
  knight = "European hornet",
  tank = "Red paper wasp",
  dismantler = "Dolichovespula arenaria",
  healer = "Bald-faced hornet",
  defender = "Vespa affinis",
  skdefender = "Polybia occidentalis",
}

export enum setupsNames {
  // Civilian
  claimer = "Firefly",
  scout = "Butterfly",
  // Base
  bootstrap = "Larva",
  manager = "Carpenter bee",
  upgrader = "Honey bee",
  builder = "Mason bee",
  queen = "Queen bee",
  hauler = "Bumblebee",
  depositHauler = "Garden bumblebee",
  // Mining
  minerEnergy = "Scarabaeus sacer",
  minerMinerals = "Japanese beetle",
  depositMinerMiner = "Ground beetle",
  depositMinerPuller = "Dragonfly",
  powerMinerAttacker = "Hercules beetle",
  powerMinerHealer = "Atlas moth",
  // War
  downgrader = "Housefly",
  healer = "Luna moth",
  knight = "European hornet",
  tank = "Red paper wasp",
  dismantler = "Assasin bug",
  defender = "Walking stick",
  destroyer = "Leaf insect",
  skdefender = "Orchid Mantis",
}
// Lady bug / Carpenter ant / Earthworm / Black widow
// Nomadic ants (new update)

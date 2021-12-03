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
  upgrade = "polen",
  build = "wax",
  surrender = "FFF",
  boost = "boost_",
  def = "def_",
  puppet = "pup_",
  annex = "annex_",
  claim = "claim",
  mine = "mine_",
  haltlab = "haltlab_",
  nukes = "nukes_",
  terminal = "terminal_",
  power = "power_",
  deposit = "deposit_",
  downgrade = "downgrade_",

  // deposit master
  miner = "_miner",
  pickup = "_pickup",

  // TODO shorten?

  //cells
  defenseCell = "DefenseCell_",
  respawnCell = "RespawnCell_",
  developmentCell = "DevelopmentCell_",
  excavationCell = "ExcavationCell_",
  laboratoryCell = "LaboratoryCell_",
  resourceCells = "ResourceCell_",
  storageCell = "StorageCell_",
  upgradeCell = "UpgradeCell_",
  observerCell = "ObserveCell_",
  powerCell = "PowerCell_",
  factoryCell = "FactoryCell_",

  builder = "BuilderHive_",
  puller = "PullerDeposit_",

  // game constants
  master = "master",
  swarm = "Swarm_",

  nkvd = "NKVD'shnik",
  kgb = "KGB'shnik",
}

export enum signText {
  my = "🐝✨❤️",
  annex = "🐝⛏️🔥",
  other = "🐝☠️🤖",
}

export enum setupsNames {
  // Civilian
  claimer = 'Bee drone',
  manager = 'Stingless bee',
  hauler = 'Bumblebee',
  miner = 'Andrena',
  upgrader = 'Honey bee',
  builder = 'Colletidae',
  scout = 'Stenotritidae',
  bootstrap = 'Bee larva',
  queen = 'Bee queen',
  // War
  knight = 'European hornet',
  tank = "Red paper wasp",
  dismantler = 'Dolichovespula arenaria',
  healer = 'Bald-faced hornet',
  defender = 'Vespa affinis',
}

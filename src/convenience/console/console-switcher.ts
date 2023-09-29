import type { MemorySettings } from "abstract/declarations";
import type { HiveCache } from "abstract/hiveMemory";
import { BASE_MODE_HIVE, SETTINGS_DEFAULT } from "static/constants";

export function consoleGlobalSettings(
  modeInp: string = "",
  valueInp?: number | boolean
) {
  modeInp = modeInp.toLowerCase();
  let settingToChange: keyof MemorySettings | undefined;

  // Aliases for modes
  switch (modeInp) {
    case "miningdist":
    case "dist":
      settingToChange = "miningDist";
      break;
    case "framerate":
    case "fps":
      settingToChange = "framerate";
      break;
    case "loggingcycle":
    case "logcycle":
      settingToChange = "loggingCycle";
      break;
    case "reportcpu":
    case "cpureport":
      settingToChange = "reportCPU";
      break;
    case "richmovement":
    case "richmove":
      settingToChange = "richMovement";
      break;
    case "safewrap":
      settingToChange = "safeWrap";
      break;
    case "generatepixel":
    case "genpixel":
      settingToChange = "generatePixel";
      break;
    case "lifetimedrone":
    case "lifedrone":
      settingToChange = "lifetimeApiary";
      break;
    case "default":
    case "def":
      Memory.settings = SETTINGS_DEFAULT;
      break;
    default:
      // Handle invalid input or unrecognized aliases here
      break;
  }

  // Switch statement for numerical settings
  switch (settingToChange) {
    case "framerate":
    case "loggingCycle":
    case "miningDist":
    case "lifetimeApiary":
      if (typeof valueInp === "number") {
        // Valid numerical input
        Memory.settings[settingToChange] = valueInp;
      }
      break;
    case "reportCPU":
    case "richMovement":
    case "safeWrap":
    case "generatePixel":
      if (typeof valueInp === "boolean") {
        // Valid boolean input
        Memory.settings[settingToChange] = valueInp;
      }
      break;
    default:
      // Handle invalid settingToChange value here
      break;
  }

  const allSettings: (keyof MemorySettings)[] = [
    "framerate",
    "loggingCycle",
    "reportCPU",
    "richMovement",
    "safeWrap",
    "generatePixel",
    "miningDist",
    "lifetimeApiary",
  ];
  let ans = "";

  const maxLen = _.max(_.map(allSettings, (a) => a.length));
  _.forEach(settingToChange ? [settingToChange] : allSettings, (ref) => {
    const def = SETTINGS_DEFAULT[ref] === Memory.settings[ref] ? " " : "❗";
    const pad = Array(maxLen - ref.length)
      .fill(" ")
      .join("");
    ans += `${ref}${pad} : ${def}\t${Memory.settings[ref]}\n`;
  });
  return ans;
}

export function consoleHiveSettings<T extends keyof HiveCache["do"]>(
  modeInp = "",
  hiveName?: string,
  value?: HiveCache["do"][T]
) {
  modeInp = modeInp.toLowerCase();
  let hiveMode: (keyof HiveCache["do"])[] = [];
  const allSettings: (keyof HiveCache["do"])[] = [
    "buildBoost",
    "buyIn",
    "depositMining",
    "depositRefining",
    "lab",
    "powerMining",
    "upgrade",
    "sellOff",
    "war",
    "unboost",
    "saveCpu",
    "powerRefining",
  ];
  // aliases for modes
  switch (modeInp) {
    case "build":
    case "buildboost":
    case "b":
      hiveMode = ["buildBoost"];
      break;
    case "buy":
    case "buyin":
    case "bu":
      hiveMode = ["buyIn"];
      break;
    case "buyingstrategy":
    case "bs":
    case "broker":
    case "market":
      hiveMode = ["buyIn", "sellOff"];
      break;
    case "deposit":
    case "depositcycle":
    case "dep":
    case "d":
      hiveMode = ["depositMining", "depositRefining"];
      break;
    case "depositmining":
    case "dm":
      hiveMode = ["depositMining"];
      break;
    case "refining":
    case "depositrefining":
    case "dr":
      hiveMode = ["depositRefining"];
      break;
    case "lab":
    case "labstrat":
    case "l":
      hiveMode = ["lab"];
      break;
    case "power":
    case "powermining":
    case "pm":
      hiveMode = ["powerMining"];
      break;
    case "powerrefining":
    case "pr":
      hiveMode = ["powerRefining"];
      break;
    case "upgrade":
    case "upg":
    case "u":
      hiveMode = ["upgrade"];
      break;
    case "sell":
    case "selloff":
    case "so":
      hiveMode = ["sellOff"];
      break;
    case "war":
    case "w":
      hiveMode = ["war"];
      break;
    case "unboost":
    case "ub":
      hiveMode = ["unboost"];
      break;
    case "savecpu":
    case "sc":
      hiveMode = ["saveCpu"];
      break;
    case "hibernate":
    case "hib":
      hiveMode = ["saveCpu", "unboost"];
      value = value === undefined ? 1 : value;
      break;
    case "all":
    case "default":
    case "def":
      hiveMode = allSettings;
      break;
  }

  let ans = "";
  _.forEach(
    _.filter(Apiary.hives, (h) => !hiveName || hiveName.includes(h.roomName)),
    (h) => {
      const dd = Memory.cache.hives[h.roomName].do;
      _.forEach(hiveMode, (hm: T) => {
        dd[hm] = value === undefined ? BASE_MODE_HIVE[hm] : value;
      });

      const describePowerMiningMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No power mining";
          case 1:
            return "Power mining active";
          default:
            return "";
        }
      };

      const describePowerRefiningMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No power refining";
          case 1:
            return "Power refining active";
          default:
            return "";
        }
      };

      const describeDepositMiningMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No deposit mining";
          case 1:
            return "Deposit mining active";
          default:
            return "";
        }
      };

      const describeDepositRefiningMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No deposit refining";
          case 1:
            return "Deposit refining active";
          default:
            return "";
        }
      };

      const describeWarMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "Not spawning attack creeps";
          case 1:
            return "Spawning attack creeps";
          default:
            return "";
        }
      };

      const describeUnboostMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No unboosting";
          case 1:
            return "Unboosting active";
          default:
            return "";
        }
      };

      const describeSaveCpuMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "Saving CPU disabled";
          case 1:
            return "Saving CPU enabled";
          default:
            return "";
        }
      };

      const describeUpgradeMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No upgrades";
          case 1:
            return "Boost up to level 8";
          case 2:
            return "No boosted max energy after level 8";
          case 3:
            return "Boosted max energy after level 8";
          default:
            return "";
        }
      };

      const describeLabMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No lab strategy";
          case 1:
            return "Lab minerals only";
          case 2:
            return "Lab minerals + energy + ops";
          default:
            return "";
        }
      };

      const describeBuyInMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No buying strategy";
          case 1:
            return "Buy minerals";
          case 2:
            return "Buy minerals + ops";
          case 3:
            return "Buy minerals + ops + energy";
          case 4:
            return "Buy anything";
          default:
            return "";
        }
      };

      const describeSellOffMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No sell-off strategy";
          case 1:
            return "Sell-off for balancing";
          case 2:
            return "Sell-off for profit (schemes)";
          default:
            return "";
        }
      };

      const describeBuildBoostMode = (mode: number) => {
        switch (mode) {
          case 0:
            return "No building boosting";
          case 1:
            return "Building boost for war";
          case 2:
            return "Building boost in all cases";
          case 3:
            return "Building boost even in peaceful times";
          default:
            return "";
        }
      };

      const maxLen = _.max(_.map(Object.keys(dd), (a) => a.length));
      const addString = (hm: keyof HiveCache["do"], ref = hm) =>
        ref.toUpperCase() +
        ":" +
        Array(maxLen - ref.length)
          .fill(" ")
          .join("") +
        "\t:\t" +
        dd[hm] +
        (dd[hm] === BASE_MODE_HIVE[hm] ? " " : "❗") +
        "\t:\t";

      ans += `@ ${h.print}:\n`;
      ans += `${addString("depositMining")}${describeDepositMiningMode(
        h.mode.depositMining
      )}\n`;
      ans += `${addString("depositRefining")}${describeDepositRefiningMode(
        h.mode.depositRefining
      )}\n`;
      ans += `${addString("powerMining")}${describePowerMiningMode(
        h.mode.powerMining
      )}\n`;
      ans += `${addString("powerRefining")}${describePowerRefiningMode(
        h.mode.powerRefining
      )}\n`;
      ans += `${addString("war")}${describeWarMode(h.mode.war)}\n`;
      ans += `${addString("lab")}${describeLabMode(h.mode.lab)}\n`;
      ans += `${addString("sellOff")}${describeSellOffMode(h.mode.sellOff)}\n`;
      ans += `${addString("buyIn")}${describeBuyInMode(h.mode.buyIn)}\n`;
      ans += `${addString("saveCpu")}${describeSaveCpuMode(h.mode.saveCpu)}\n`;
      ans += `${addString("unboost")}${describeUnboostMode(h.mode.unboost)}\n`;
      ans += `${addString("buildBoost")}${describeBuildBoostMode(
        h.mode.buildBoost
      )}\n`;
      ans += `${addString("upgrade")}${describeUpgradeMode(h.mode.upgrade)}\n`;

      ans += _.compact(
        _.map(Object.keys(dd), (key: keyof HiveCache["do"]) =>
          !allSettings.includes(key) ? addString(key) : undefined
        )
      ).join("\n");

      ans += "\n\n";
    }
  );
  return ans;
}

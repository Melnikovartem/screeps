"use strict";

import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import clear from "rollup-plugin-clear";
import execute from "rollup-plugin-execute";
import screeps from "rollup-plugin-screeps";
import typescript from "rollup-plugin-typescript2";

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log(
    "No destination specified - code will be compiled but not uploaded"
  );
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: "build/main.js",
    format: "cjs",
    sourcemap: true,
  },

  plugins: [
    clear({ targets: ["build"] }),
    resolve({ rootDir: "src" }),
    commonjs({
      // namedExports: { 'node_modules/screeps-profiler/screeps-profiler.js': ['enable', 'wrap'] },
    }),
    typescript({ tsconfig: "./tsconfig.json" }),
    execute([
      "source ./screeps-tools/screeps-backup/env/bin/activate; python3 screeps-tools/screeps-backup/screepsbackup/backup.py screeps-tools/backups",
    ]),
    screeps({ config: cfg, dryRun: cfg == null }),
  ],
};

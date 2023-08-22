import ScreepsStatsd from "./src/ScreepsStatsd.js";

new ScreepsStatsd(
  process.env.SCREEPS_HOST,
  process.env.SCREEPS_EMAIL,
  process.env.SCREEPS_PASSWORD,
  process.env.SCREEPS_SHARD,
  process.env.GRAPHITE_PORT_8125_UDP_ADDR
).run();

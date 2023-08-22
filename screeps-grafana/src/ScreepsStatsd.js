/**
 * hopsoft\screeps-statsd
 *
 * Licensed under the MIT license
 * For full copyright and license information, please see the LICENSE file
 *
 * @author     Bryan Conrad <bkconrad@gmail.com>
 * @copyright  2016 Bryan Conrad
 * @link       https://github.com/hopsoft/docker-graphite-statsd
 * @license    http://choosealicense.com/licenses/MIT  MIT License
 */

/* eslint-disable */

/**
 * SimpleClass documentation
 *
 * @since  0.1.0
 */
import fetch from "node-fetch";
import StatsD from "node-statsd";
import zlib from "zlib";

export default class ScreepsStatsd {
  _host;
  _email;
  _password;
  _shard;
  _graphite;
  _token;
  _success;
  constructor(host, email, password, shard, graphite) {
    this._host = host;
    this._email = email;
    this._password = password;
    this._shard = shard;
    this._graphite = graphite;
    this._client = new StatsD({ host: this._graphite });
    this._reported_events = []
  }

  run(string) {
    this.signin();
    this._memoryAdress = "log"

    setInterval(() => this.loop(), 15000);
  }

  loop() {
    this.getMemory();
  }

  async signin() {
    if (this.token) {
      return;
    }
    console.log("New login request -", new Date());
    const response = await fetch(this._host + "/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        email: this._email,
        password: this._password,
      }),
      headers: {
        "content-type": "application/json",
      },
    });
    const data = await response.json();
    this._token = data.token;
  }

  async getMemory() {
    try {
      await this.signin();

      const response = await fetch(
        this._host + `/api/user/memory?path=${this._memoryAdress}&shard=${this._shard}`,
        {
          method: "GET",
          headers: {
            "X-Token": this._token,
            "X-Username": this._token,
            "content-type": "application/json",
          },
        }
      );
      const data = await response.json();

      this._token = response.headers["x-token"];
      if (!data?.data || data.error) throw new Error(data?.error ?? "No data");
      const unzippedData = JSON.parse(
        zlib
          .gunzipSync(Buffer.from(data.data.split("gz:")[1], "base64"))
          .toString()
      );
      this.resource_event_map = {}
      this.report(unzippedData);
      
      for (const prefix in this.resource_event_map)
        for (const comment in this.resource_event_map[prefix]) {
          if (prefix.includes("market")) 
            console.log(JSON.stringify(this.resource_event_map[prefix][comment]));
          this._client.gauge(this._shard + "." + prefix + comment.split("_").join("."), this.resource_event_map[prefix][comment]);
        }
      
      this.resource_event_map = {}

      for (const prefix_even_id in this._reported_events)
        if (unzippedData.tick.current > this._reported_events[prefix_even_id] + 200) 
          delete this._reported_events[prefix_even_id];

    } catch (e) {
      console.error(e);
      this._token = undefined;
    }
  }

  report(data, prefix = "", resource_event = false) {
    // console.log(data);
    if (prefix === "") console.log("Pushing to gauges -", new Date());
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "object") {
        if (resource_event) {
          for (const event_id in v) {
            let event = v[event_id]
            if (!this._reported_events[prefix + event_id]) {
              this._reported_events[prefix + event_id] = event.tick;
              const prefix_resource = prefix + k + "."
              if (!this.resource_event_map[prefix_resource])
                this.resource_event_map[prefix_resource] = {};
              if (!this.resource_event_map[prefix_resource][event.comment])
                this.resource_event_map[prefix_resource][event.comment] = 0;
              this.resource_event_map[prefix_resource][event.comment] += event.amount;
            }
          }
        } else this.report(v, prefix + k + ".", k == "resourceEvents");
      } else {
        this._client.gauge(this._shard + "." + prefix + k, v);
      }
    }
  }
}

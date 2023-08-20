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

/**
 * SimpleClass documentation
 *
 * @since  0.1.0
 */
import fetch from 'node-fetch';
import StatsD from 'node-statsd';
import zlib from 'zlib';

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
    this._client = new StatsD({host: this._graphite});
  }
  run( string ) {
    this.signin();

    setInterval(() => this.loop(), 15000);
  }

  loop() {
    this.getMemory();
  } 
  
  async signin() {
    if(this.token) {
      return;
    }
    console.log("New login request -", new Date());
    const response = await fetch(this._host + '/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email: this._email,
        password: this._password
      }),
      headers: {
        'content-type': 'application/json'
      }
    });
    const data = await response.json();
    this._token = data.token;
  }

  async getMemory() {
    try {
      await this.signin();

      const response = await fetch(this._host + `/api/user/memory?path=log&shard=${this._shard}`, {
        method: 'GET',
        headers: {
          "X-Token": this._token,
          "X-Username": this._token,
          'content-type': 'application/json',
        }
      });
      const data = await response.json();
      
      this._token = response.headers['x-token'];
      if (!data?.data || data.error) throw new Error(data?.error ?? 'No data');
      const unzippedData = JSON.parse(zlib.gunzipSync(Buffer.from(data.data.split('gz:')[1], 'base64')).toString())
      this.report(unzippedData);
    } catch (e) {
      console.error(e);
      this._token = undefined;
    }
  }

  report(data, prefix="") {
    console.log(data);
    if (prefix === '') console.log("Pushing to gauges -", new Date())
    for (const [k,v] of Object.entries(data)) {
      if (typeof v === 'object') {
        this.report(v, prefix+k+'.');
      } else {
        this._client.gauge(prefix+k, v);
      }
    }
  }
}
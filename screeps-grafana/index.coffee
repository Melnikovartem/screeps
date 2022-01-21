###
hopsoft\screeps-statsd

Licensed under the MIT license
For full copyright and license information, please see the LICENSE file

@author     Bryan Conrad <bkconrad@gmail.com>
@copyright  2016 Bryan Conrad
@link       https://github.com/hopsoft/docker-graphite-statsd
@license    http://choosealicense.com/licenses/MIT  MIT License
###

# Application's initialisation and startup script
ScreepsStatsd = require './src/ScreepsStatsd'
(new ScreepsStatsd).run()


docker run -d \
  -p 3000:3000 \
  --name=grafana \
  --mount type=bind,source="$(pwd)"/target,target=/app \
  -e "GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource,frser-sqlite-datasource" \
  grafana/grafana-enterprise

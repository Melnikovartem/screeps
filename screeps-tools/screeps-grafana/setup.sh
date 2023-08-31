#!/bin/bash
echo Starting containers...
docker-compose up -d
echo Waiting for grafana to start...
CURLRET=1
while [[ $CURLRET != 0 ]]; do
	sleep 1
	curl -s -I http://localhost:1337 > /dev/null
	CURLRET=$?
done
echo Configuring Datasource...
curl -s 'http://admin:admin@localhost:1337/api/datasources' -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary '{"name":"localGraphite","type":"graphite","url":"http://graphite-statsd:8080","access":"proxy","isDefault":true,"database":""}' > /dev/null
sleep 2
# echo Installing Dashboards...
# for filename in ./dashboards/*.json; do
# 	curl -s 'http://admin:admin@localhost:1337/api/dashboards/db' -X POST -H 'Content-Type: application/json;charset=UTF-8' --data @$filename > /dev/null
# done

echo All done! 
echo You should be able connect to http://localhost:1337
echo with username \'admin\' and password \'admin\'

curl -X POST -H 'Content-Type: application/json;charset=UTF-8' --data @dashboards/Account_status.json http://admin:admin1@localhost:1337/api/dashboards/db

# developing useful with:
# rm -rf /var/lib/docker/volumes/screeps-grafana_graphite_data/_data/*
# docker-compose up -d --no-deps --build --remove-orphans node-shard2; docker-compose up -d --no-deps --build node-shard3


# TODO add with code dashboards
# TODO change settings of statsd to deleteGauges in statsd_conf/tcp.js statsd_conf/udp.js
# Couldn't find where configure rolllup aggregation for whisper so for now runtime aggr only avg
# TODO change setting of aggregation in graphite_conf/storage-aggregation.conf :
#[count_legacy]
#pattern = ^stats_counts.*
#xFilesFactor = 0
#aggregationMethod = sum

#[resourceEvents]
#pattern = \.resourceEvents\.
#xFilesFactor = 0
#aggregationMethod = sum

#[cpuUsage]
#pattern = \.cpuUsage\.
#xFilesFactor = 0
#aggregationMethod = average

#[default_average]
#pattern = .*
#xFilesFactor = 0
#aggregationMethod = average
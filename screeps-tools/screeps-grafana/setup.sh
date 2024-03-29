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
echo Installing Dashboards...

for filename in ./dashboards/*.json; do
	curl -s 'http://admin:admin@localhost:1337/api/dashboards/db' -X POST -H 'Content-Type: application/json;charset=UTF-8' \
    --data "{
        \"dashboard\": $(cat "$filename"),
        \"message\": \"Uploaded dashboard\",
        \"overwrite\": false
    }" # get dashboard from file, change "id" to null and send it to import
    echo 
done

echo All done! 
echo You should be able connect to http://localhost:1337
echo with username \'admin\' and password \'admin\'

# useful commands:
# remove all data: 
# sudo rm -rf /var/lib/docker/volumes/screeps-grafana_graphite_data/_data/*
# restart statsd: 
# docker-compose up -d --no-deps --build --remove-orphans node-shard2; docker-compose up -d --no-deps --build node-shard3
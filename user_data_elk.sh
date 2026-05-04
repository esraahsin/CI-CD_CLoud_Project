#!/bin/bash
set -xe

apt update -y
apt install -y docker.io curl

# Elasticsearch requires this — must be set before starting ES
sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" >> /etc/sysctl.conf

systemctl enable docker
systemctl start docker

# Create a shared network for ES ↔ Kibana communication
docker network create elk

# Start Elasticsearch (single-node, no security for simplicity)
docker run -d \
  --name elasticsearch \
  --network elk \
  --restart unless-stopped \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0

# Wait for Elasticsearch to be ready before starting Kibana
echo "Waiting for Elasticsearch..."
until curl -s http://localhost:9200/_cluster/health | grep -q '"status":"green"\|"status":"yellow"'; do
  sleep 5
done
echo "Elasticsearch is ready."

# Start Kibana
docker run -d \
  --name kibana \
  --network elk \
  --restart unless-stopped \
  -p 5601:5601 \
  -e "ELASTICSEARCH_HOSTS=http://elasticsearch:9200" \
  -e "XPACK_SECURITY_ENABLED=false" \
  docker.elastic.co/kibana/kibana:8.12.0

# Create the index template for todo-app logs
sleep 30
curl -s -X PUT "http://localhost:9200/_index_template/todo-app" \
  -H "Content-Type: application/json" \
  -d '{
    "index_patterns": ["todo-app-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0
      },
      "mappings": {
        "properties": {
          "@timestamp":      { "type": "date" },
          "source.ip":       { "type": "ip" },
          "http.request.method":         { "type": "keyword" },
          "http.response.status_code":   { "type": "integer" },
          "http.response.duration_ms":   { "type": "integer" },
          "url.path":        { "type": "keyword" },
          "event.outcome":   { "type": "keyword" },
          "event.dataset":   { "type": "keyword" },
          "source_type":     { "type": "keyword" }
        }
      }
    }
  }'

echo "ELK stack setup complete."
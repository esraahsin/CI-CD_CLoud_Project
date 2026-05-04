output "alb_dns" {
  value = aws_lb.main.dns_name
}

output "frontend_ip" {
  value = aws_instance.frontend.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "kibana_url" {
  value       = "http://${aws_instance.elk.public_ip}:5601"
  description = "Kibana dashboard URL (available ~5 minutes after apply)"
}

output "elk_private_ip" {
  value       = aws_instance.elk.private_ip
  description = "ELK private IP used by backend EC2s"
}
output "alb_dns" {
  value = aws_lb.main.dns_name
}

output "frontend_ip" {
  value = aws_instance.frontend.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

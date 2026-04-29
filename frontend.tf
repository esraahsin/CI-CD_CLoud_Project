resource "aws_instance" "frontend" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = "t2.micro"
  subnet_id                   = aws_subnet.public_a.id
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  associate_public_ip_address = true
  key_name                    = var.key_name != "" ? var.key_name : null

  user_data = base64encode(templatefile("${path.module}/user_data_frontend.sh", {
    alb_dns = aws_lb.main.dns_name
  }))

  tags = { Name = "frontend-instance" }
}

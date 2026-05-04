resource "aws_instance" "elk" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.elk_instance_type
  subnet_id                   = aws_subnet.public_a.id
  vpc_security_group_ids      = [aws_security_group.elk.id]
  associate_public_ip_address = true
  key_name                    = var.key_name != "" ? var.key_name : null

  user_data = base64encode(file("${path.module}/user_data_elk.sh"))

  tags = { Name = "elk-instance" }
}
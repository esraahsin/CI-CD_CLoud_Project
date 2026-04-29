data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_launch_template" "backend" {
  name_prefix   = "backend-lt-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t2.micro"
  key_name      = var.key_name != "" ? var.key_name : null

  network_interfaces {
    security_groups             = [aws_security_group.backend.id]
    associate_public_ip_address = false
  }

  user_data = base64encode(templatefile("${path.module}/user_data_backend.sh", {
    db_host     = aws_db_instance.main.address
    db_password = var.db_password
    github_repo = var.github_repo
  }))

  tag_specifications {
    resource_type = "instance"
    tags = { Name = "backend-instance" }
  }
}

resource "aws_autoscaling_group" "backend" {
  name                = "project-asg"
  desired_capacity    = 2
  min_size            = 2
  max_size            = 4
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  launch_template {
    id      = aws_launch_template.backend.id
    version = "$Latest"
  }

  target_group_arns = [aws_lb_target_group.backend.arn]
  health_check_type = "ELB"

  tag {
    key                 = "Name"
    value               = "backend-asg"
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_policy" "cpu_scale_up" {
  name                   = "cpu-scale-up"
  autoscaling_group_name = aws_autoscaling_group.backend.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

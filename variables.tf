variable "region" {
  default = "us-east-1"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "Full HTTPS URL to your app repo"
  type        = string
}

variable "key_name" {
  description = "EC2 Key Pair name (already created in AWS console)"
  type        = string
  default     = ""
}

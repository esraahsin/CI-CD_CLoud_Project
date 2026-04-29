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

variable "frontend_repo" {
  description = "Full HTTPS URL to your frontend repo"
  type        = string
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH into the frontend EC2 (restrict to your IP in production)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "skip_final_snapshot" {
  description = "Skip RDS final snapshot on destroy (set false for production)"
  type        = bool
  default     = true
}

variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.m6g.large"
}

variable "api_cpu" {
  description = "ECS Fargate CPU units for API"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "ECS Fargate Memory in MB for API"
  type        = number
  default     = 2048
}

variable "worker_cpu" {
  description = "ECS Fargate CPU units for Worker"
  type        = number
  default     = 2048
}

variable "worker_memory" {
  description = "ECS Fargate Memory in MB for Worker"
  type        = number
  default     = 4096
}

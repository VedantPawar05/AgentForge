output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = aws_ecs_cluster.cluster.name
}

output "db_endpoint" {
  description = "PostgreSQL primary host endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache primary host endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "artifacts_bucket" {
  description = "S3 bucket for execution artifacts"
  value       = aws_s3_bucket.artifacts.id
}

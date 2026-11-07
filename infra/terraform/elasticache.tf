resource "aws_elasticache_subnet_group" "redis" {
  name       = "agentforge-${var.environment}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "redis" {
  name        = "agentforge-${var.environment}-redis-sg"
  description = "Allow inbound Redis traffic from VPC private subnets"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Redis"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "agentforge-${var.environment}-redis"
  description                = "AgentForge Redis Queue & Token Bucket cluster"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "production" ? 2 : 1
  parameter_group_name       = "default.redis7"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  automatic_failover_enabled = var.environment == "production" ? true : false
  multi_az_enabled           = var.environment == "production" ? true : false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"

  tags = {
    Name = "agentforge-${var.environment}-redis"
  }
}

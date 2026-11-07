resource "aws_db_subnet_group" "rds" {
  name       = "agentforge-${var.environment}-rds-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "agentforge-${var.environment}-rds-subnets"
  }
}

resource "aws_security_group" "rds" {
  name        = "agentforge-${var.environment}-rds-sg"
  description = "Allow inbound PostgreSQL traffic from VPC private subnets"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
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

resource "aws_db_instance" "postgres" {
  identifier                  = "agentforge-${var.environment}-postgres"
  engine                      = "postgres"
  engine_version              = "16.2"
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  max_allocated_storage       = 500
  storage_type                = "gp3"
  storage_encrypted           = true
  multi_az                    = var.environment == "production" ? true : false
  db_subnet_group_name        = aws_db_subnet_group.rds.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  db_name                     = "agentforge_${var.environment}"
  username                    = "agentforge_admin"
  manage_master_user_password = true

  backup_retention_period   = 30
  backup_window             = "03:00-04:00"
  maintenance_window        = "sun:04:30-sun:05:30"
  auto_minor_version_upgrade = true
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "agentforge-${var.environment}-final-snapshot"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "agentforge-${var.environment}-database"
  }
}

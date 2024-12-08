# City Housing Assistance Platform - Infrastructure

This repository contains the infrastructure as code (IaC) for deploying and managing the City Housing Assistance Platform. The platform is designed to help city governments streamline their housing and shelter assistance programs through secure document management, case workflows, and application processing.

## Overview

This infrastructure project is part of a larger ecosystem that includes:
- Infrastructure (this repository)
- API Service (separate repository)
- User Interface (separate repository)

The infrastructure is built using AWS CDK and provides the foundation for secure document storage, database management, and other cloud resources required to run the platform.

## Core Features Supported by this Infrastructure

- Secure document storage and management
- Database infrastructure for case management
- Identity and access management
- Secure API endpoints
- Resource isolation and security controls
- Multi-environment support (development, staging, production)

## Technical Stack

- **Infrastructure as Code**: AWS CDK with TypeScript
- **Database**: PostgreSQL (Amazon RDS)
- **Document Storage**: Amazon S3
- **API Gateway**: AWS API Gateway
- **Authentication**: AWS Cognito
- **Monitoring**: CloudWatch

## Prerequisites

- Node.js (v16 or later)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker (for local development)
- PostgreSQL client (for database migrations)

## Getting Started

1. Clone the repository:
```bash
git clone [repository-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install
```

3. Copy the parameter template and configure your environment:
```bash
cp params.env.example params.env
# Edit params.env with your configuration
```

4. Bootstrap your AWS environment (if not already done):
```bash
cdk bootstrap
```

5. Deploy the infrastructure:
```bash
cdk deploy --all
```

## Stack Structure

The infrastructure is organized into several nested stacks within the main CDK stack:

- **Account Resources Stack**: Base AWS account setup including VPC configuration and shared resources
- **RDS PostgreSQL Stack**: Aurora/PostgreSQL database infrastructure with multi-AZ support
- **Redis Elasticache Stack**: Redis cluster for caching and session management
- **API Stack**: REST API infrastructure using API Gateway
- **Cognito Auth Stack**: User authentication and authorization infrastructure
- **App Web UI Stack**: Frontend application infrastructure with CloudFront distribution
- **Web OpenAPI Stack**: API documentation interface infrastructure
- **Websocket API Stack**: Real-time communication infrastructure with DynamoDB for connection management

### Key Components by Stack

#### Account Resources Stack
- VPC configuration
- Network security groups
- Shared SSM parameters

#### RDS PostgreSQL Stack
- Production: Aurora PostgreSQL cluster with read replicas
- Non-Production: Single instance PostgreSQL
- Bastion host (in development environment)
- Security groups and subnet configurations

#### Redis Elasticache Stack
- Redis cluster configuration
- Security groups
- Subnet groups

#### API Stack
- HTTP API Gateway
- API domain configuration
- CORS settings

#### Cognito Auth Stack
- User pool configuration
- Authentication triggers
- OAuth/OpenID settings
- Custom domain setup

#### App Web UI Stack
- S3 bucket for static assets
- CloudFront distribution
- WAF configuration (optional)

#### Web OpenAPI Stack
- S3 bucket for API documentation
- CloudFront distribution
- Domain configuration

#### Websocket API Stack
- WebSocket API Gateway
- DynamoDB table for connection management
- Lambda handlers for WebSocket events
- SQS queue for broadcast messages

## Security Features

- Encryption at rest for all sensitive data
- Network isolation using VPC
- IAM roles and policies following least privilege principle
- Secure document storage with versioning
- Audit logging and monitoring

## Environment Configuration

The infrastructure supports multiple environments through parameter files:

- Development
- Staging
- Production

Each environment can be configured separately using environment-specific parameters in `params.env`.

## Monitoring and Maintenance

The infrastructure includes:
- CloudWatch dashboards
- Automated backups
- Alert configurations
- Resource monitoring

## Contributing

We welcome contributions from the community. Please read our contributing guidelines before submitting pull requests.

## Companion Projects

- API Service Repository: [Link to API repository]
- UI Repository: [Link to UI repository]

## Support and Documentation

For detailed technical documentation and support:
- [Link to technical documentation]
- [Link to support resources]
- [Link to deployment guides]

## License

MIT

## Security

For security concerns or vulnerabilities, please contact [security contact information].

## Acknowledgments

This project is made possible through the collaboration of various city governments and technical contributors who share the vision of improving housing assistance services through technology.

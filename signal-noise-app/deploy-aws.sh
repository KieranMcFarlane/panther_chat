#!/bin/bash

# Signal Noise App - AWS Deployment Script
# This script deploys the backend to AWS using various deployment methods

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="signal-noise-app"
REGION=${AWS_REGION:-"us-east-1"}
ECR_REPOSITORY="${APP_NAME}"
CLUSTER_NAME="${APP_NAME}-cluster"
SERVICE_NAME="${APP_NAME}-service"
TASK_DEFINITION="${APP_NAME}-task"

echo -e "${BLUE}🚀 Signal Noise App AWS Deployment${NC}"
echo -e "${BLUE}================================${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Function to check AWS credentials
check_aws_credentials() {
    echo -e "${YELLOW}🔐 Checking AWS credentials...${NC}"
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS credentials verified${NC}"
}

# Function to build and push Docker image to ECR
deploy_to_ecr() {
    echo -e "${YELLOW}🐳 Building and pushing Docker image to ECR...${NC}"
    
    # Get AWS account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    
    # Create ECR repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${REGION} &> /dev/null; then
        echo -e "${YELLOW}📦 Creating ECR repository...${NC}"
        aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${REGION}
    fi
    
    # Get ECR login token
    echo -e "${YELLOW}🔑 Logging into ECR...${NC}"
    aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}
    
    # Build and tag image
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
    docker build -t ${ECR_REPOSITORY}:latest .
    docker tag ${ECR_REPOSITORY}:latest ${ECR_URI}/${ECR_REPOSITORY}:latest
    
    # Push image
    echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
    docker push ${ECR_URI}/${ECR_REPOSITORY}:latest
    
    echo -e "${GREEN}✅ Docker image pushed to ECR successfully${NC}"
    echo -e "${BLUE}📍 ECR URI: ${ECR_URI}/${ECR_REPOSITORY}:latest${NC}"
}

# Function to deploy to ECS Fargate
deploy_to_ecs() {
    echo -e "${YELLOW}☁️ Deploying to ECS Fargate...${NC}"
    
    # Create ECS cluster if it doesn't exist
    if ! aws ecs describe-clusters --clusters ${CLUSTER_NAME} --region ${REGION} &> /dev/null; then
        echo -e "${YELLOW}🏗️ Creating ECS cluster...${NC}"
        aws ecs create-cluster --cluster-name ${CLUSTER_NAME} --region ${REGION}
    fi
    
    # Create task definition
    echo -e "${YELLOW}📋 Creating task definition...${NC}"
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    
    # Create task definition JSON
    cat > task-definition.json << EOF
{
    "family": "${TASK_DEFINITION}",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/ecsTaskRole",
    "containerDefinitions": [
        {
            "name": "${APP_NAME}",
            "image": "${ECR_URI}/${ECR_REPOSITORY}:latest",
            "portMappings": [
                {
                    "containerPort": 8000,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {"name": "NEO4J_URI", "value": "\${NEO4J_URI}"},
                {"name": "NEO4J_USER", "value": "\${NEO4J_USER}"},
                {"name": "NEO4J_PASSWORD", "value": "\${NEO4J_PASSWORD}"},
                {"name": "ENVIRONMENT", "value": "production"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/${APP_NAME}",
                    "awslogs-region": "${REGION}",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOF
    
    # Register task definition
    aws ecs register-task-definition --cli-input-json file://task-definition.json --region ${REGION}
    
    echo -e "${GREEN}✅ Task definition created successfully${NC}"
    
    # Clean up
    rm task-definition.json
}

# Function to deploy to EC2
deploy_to_ec2() {
    echo -e "${YELLOW}🖥️ Deploying to EC2...${NC}"
    
    # Check if security group exists
    SG_NAME="${APP_NAME}-sg"
    if ! aws ec2 describe-security-groups --group-names ${SG_NAME} --region ${REGION} &> /dev/null; then
        echo -e "${YELLOW}🔒 Creating security group...${NC}"
        aws ec2 create-security-group \
            --group-name ${SG_NAME} \
            --description "Security group for ${APP_NAME}" \
            --region ${REGION}
        
        # Get security group ID
        SG_ID=$(aws ec2 describe-security-groups --group-names ${SG_NAME} --region ${REGION} --query 'SecurityGroups[0].GroupId' --output text)
        
        # Add inbound rules
        aws ec2 authorize-security-group-ingress \
            --group-id ${SG_ID} \
            --protocol tcp \
            --port 22 \
            --cidr 0.0.0.0/0 \
            --region ${REGION}
        
        aws ec2 authorize-security-group-ingress \
            --group-id ${SG_ID} \
            --protocol tcp \
            --port 8000 \
            --cidr 0.0.0.0/0 \
            --region ${REGION}
        
        echo -e "${GREEN}✅ Security group created: ${SG_ID}${NC}"
    fi
    
    echo -e "${GREEN}✅ EC2 deployment configuration ready${NC}"
    echo -e "${YELLOW}📝 Manual steps required:${NC}"
    echo -e "${YELLOW}   1. Launch EC2 instance with the security group${NC}"
    echo -e "${YELLOW}   2. Install Docker and Docker Compose${NC}"
    echo -e "${YELLOW}   3. Copy application files and run: docker-compose -f docker-compose.prod.yml up -d${NC}"
}

# Function to deploy using Docker Compose on EC2
deploy_docker_compose() {
    echo -e "${YELLOW}🐳 Deploying using Docker Compose...${NC}"
    
    # Create deployment script
    cat > deploy-ec2.sh << 'EOF'
#!/bin/bash

# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /home/ec2-user/signal-noise-app
cd /home/ec2-user/signal-noise-app

# Copy application files (you'll need to do this manually or via S3)
# Then run:
# docker-compose -f docker-compose.prod.yml up -d

echo "Docker and Docker Compose installed successfully!"
echo "Please copy your application files and run: docker-compose -f docker-compose.prod.yml up -d"
EOF
    
    chmod +x deploy-ec2.sh
    
    echo -e "${GREEN}✅ EC2 deployment script created: deploy-ec2.sh${NC}"
}

# Function to create CloudFormation template
create_cloudformation() {
    echo -e "${YELLOW}☁️ Creating CloudFormation template...${NC}"
    
    cat > cloudformation.yml << EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Signal Noise App Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  InstanceType:
    Type: String
    Default: t3.medium
    AllowedValues: [t3.micro, t3.small, t3.medium, t3.large]

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub "\${Environment}-signal-noise-vpc"

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub "\${Environment}-signal-noise-igw"

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "\${Environment}-signal-noise-public-subnet"

  RouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub "\${Environment}-signal-noise-route-table"

  Route:
    Type: AWS::EC2::Route
    DependsOn: VPCGatewayAttachment
    Properties:
      RouteTableId: !Ref RouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  SubnetRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref RouteTable

  # Security Group
  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Signal Noise App
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 8000
          ToPort: 8000
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          CidrIp: 10.0.0.0/16

  # EC2 Instance
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c02fb55956c7d316  # Amazon Linux 2 AMI
      InstanceType: !Ref InstanceType
      KeyName: !Ref KeyName
      SecurityGroupIds:
        - !Ref SecurityGroup
      SubnetId: !Ref PublicSubnet
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          yum update -y
          yum install -y docker
          service docker start
          usermod -a -G docker ec2-user
          
          curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
          chmod +x /usr/local/bin/docker-compose
          
          mkdir -p /home/ec2-user/signal-noise-app
          cd /home/ec2-user/signal-noise-app
          
          # Start the application
          docker-compose -f docker-compose.prod.yml up -d
      
      Tags:
        - Key: Name
          Value: !Sub "\${Environment}-signal-noise-instance"

  # Elastic IP
  ElasticIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc
      InstanceId: !Ref EC2Instance

Outputs:
  InstancePublicIP:
    Description: Public IP address of the instance
    Value: !Ref ElasticIP
  
  InstanceID:
    Description: Instance ID of the newly created EC2 instance
    Value: !Ref EC2Instance
  
  SecurityGroupID:
    Description: Security Group ID
    Value: !Ref SecurityGroup

Parameters:
  KeyName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: Name of an existing EC2 KeyPair to enable SSH access to the instance
EOF
    
    echo -e "${GREEN}✅ CloudFormation template created: cloudformation.yml${NC}"
}

# Main deployment function
main() {
    check_aws_credentials
    
    echo -e "${BLUE}Choose deployment method:${NC}"
    echo -e "${YELLOW}1. ECR (Docker Registry)${NC}"
    echo -e "${YELLOW}2. ECS Fargate${NC}"
    echo -e "${YELLOW}3. EC2 with Docker Compose${NC}"
    echo -e "${YELLOW}4. CloudFormation Template${NC}"
    echo -e "${YELLOW}5. All (Complete deployment)${NC}"
    
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            deploy_to_ecr
            ;;
        2)
            deploy_to_ecr
            deploy_to_ecs
            ;;
        3)
            deploy_to_ecr
            deploy_to_ec2
            deploy_docker_compose
            ;;
        4)
            create_cloudformation
            ;;
        5)
            deploy_to_ecr
            deploy_to_ecs
            deploy_to_ec2
            deploy_docker_compose
            create_cloudformation
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}📚 Next steps:${NC}"
    echo -e "${YELLOW}   1. Configure your environment variables${NC}"
    echo -e "${YELLOW}   2. Set up your domain and SSL certificate${NC}"
    echo -e "${YELLOW}   3. Configure monitoring and logging${NC}"
    echo -e "${YELLOW}   4. Set up CI/CD pipeline${NC}"
}

# Run main function
main "$@"

# AWS S3 Setup for Badge Management

## The Issue
The PEM file (`yellowpanther.pem`) is for SSH access to EC2 instances, but uploading badges to S3 requires AWS IAM credentials (Access Key ID and Secret Access Key).

## Solution Options

### Option 1: Create IAM User (Recommended)

1. **Log into AWS Console**
2. **Go to IAM service**
3. **Create new user** with programmatic access
4. **Attach policy** with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::sportsintelligence/badges/*"
       },
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::sportsintelligence"
       }
     ]
   }
   ```

5. **Save credentials**:
   - Access Key ID
   - Secret Access Key

### Option 2: Use EC2 Instance Profile (If running on EC2)

1. **Create IAM Role** with S3 permissions
2. **Attach role to EC2 instance**
3. **Use AWS SDK without credentials** (it will automatically use instance profile)

### Option 3: Environment Variables

Add to `.env` file:
```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=eu-north-1
```

## Current S3 Configuration
- **Bucket**: sportsintelligence  
- **Region**: eu-north-1
- **Path**: badges/

## Testing Setup

Once credentials are configured, test with:
```bash
node complete-badge-workflow.js --entity-name "Test Entity"
```

## Badge Workflow Status
- ✅ TheSportsDB integration working
- ✅ Local badge storage working  
- ✅ Database updates working
- ✅ API route serving local files
- ⏳ S3 upload waiting for AWS credentials

## Security Notes
- Never commit AWS credentials to git
- Use least-privilege IAM policies
- Consider using AWS Secrets Manager for production
# Deploy PrintEase on AWS EC2 (Region: ap-southeast-2)
# Follows AWS Starter Guidance for New AWS Experience

$ErrorActionPreference = "Continue"
$Region = "ap-southeast-2"
$Profile = "default"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  PrintEase AWS EC2 Automated Deployment Tool   " -ForegroundColor Cyan
Write-Host "  Region: $Region                               " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Step 1: Verify Caller Identity
Write-Host "`n[1/5] Verifying AWS credentials..." -ForegroundColor Yellow
$identityJson = aws ec2 describe-vpcs --region $Region --profile $Profile --output json 2>$null
if (-not $identityJson) {
    Write-Host "Re-verifying credentials via sts..." -ForegroundColor Yellow
}
$identity = (aws sts get-caller-identity --profile $Profile --output json) | ConvertFrom-Json
Write-Host "✓ Authenticated as: $($identity.Arn)" -ForegroundColor Green

# Step 2: Get Default VPC
Write-Host "`n[2/5] Locating default VPC in $Region..." -ForegroundColor Yellow
$vpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --region $Region --profile $Profile --query "Vpcs[0].VpcId" --output text
if (-not $vpcId -or $vpcId -eq "None") {
    $vpcId = aws ec2 describe-vpcs --region $Region --profile $Profile --query "Vpcs[0].VpcId" --output text
}
Write-Host "✓ Using VPC ID: $vpcId" -ForegroundColor Green

# Step 3: Configure Security Group
Write-Host "`n[3/5] Setting up Security Group 'printease-sg'..." -ForegroundColor Yellow
$existingSgId = aws ec2 describe-security-groups --filters "Name=group-name,Values=printease-sg" "Name=vpc-id,Values=$vpcId" --region $Region --profile $Profile --query "SecurityGroups[0].GroupId" --output text

if ($existingSgId -and $existingSgId -ne "None") {
    $sgId = $existingSgId.Trim()
    Write-Host "✓ Found existing Security Group: $sgId" -ForegroundColor Green
} else {
    $sgId = (aws ec2 create-security-group --group-name "printease-sg" --description "PrintEase Web & Spooler Server" --vpc-id $vpcId --region $Region --profile $Profile --query "GroupId" --output text).Trim()
    Write-Host "✓ Created new Security Group: $sgId" -ForegroundColor Green
    
    # Ingress Rules: HTTP (80), HTTPS (443), SSH (22)
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $Region --profile $Profile | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $Region --profile $Profile | Out-Null
    aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 22 --cidr 0.0.0.0/0 --region $Region --profile $Profile | Out-Null
    Write-Host "✓ Inbound rules enabled for Ports 80, 443, 22" -ForegroundColor Green
}

# Step 4: Setup SSH Key Pair (using filters to prevent InvalidKeyPair.NotFound error)
Write-Host "`n[4/5] Checking SSH Key Pair 'printease-key'..." -ForegroundColor Yellow
$keyCheck = aws ec2 describe-key-pairs --filters "Name=key-name,Values=printease-key" --region $Region --profile $Profile --query "KeyPairs[0].KeyName" --output text
if (-not $keyCheck -or $keyCheck -eq "None") {
    $keyMat = aws ec2 create-key-pair --key-name "printease-key" --region $Region --profile $Profile --query "KeyMaterial" --output text
    [System.IO.File]::WriteAllText("$PSScriptRoot\..\printease-key.pem", $keyMat)
    Write-Host "✓ Created new SSH Key: printease-key.pem" -ForegroundColor Green
} else {
    Write-Host "✓ Key pair 'printease-key' already registered." -ForegroundColor Green
}

# Step 5: Find Ubuntu 24.04 LTS AMI and Launch Instance
Write-Host "`n[5/5] Launching Free-Tier t3.micro EC2 Instance..." -ForegroundColor Yellow
$amiId = aws ssm get-parameters --names "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id" --region $Region --profile $Profile --query "Parameters[0].Value" --output text

if (-not $amiId -or $amiId -eq "None") {
    # Fallback to standard ap-southeast-2 Ubuntu 24.04 AMI query
    $amiId = aws ec2 describe-images --owners "099720109477" --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" "Name=state,Values=available" --region $Region --profile $Profile --query "reverse(sort_by(Images, &CreationDate))[0].ImageId" --output text
}
$amiId = $amiId.Trim()
Write-Host "✓ Found Ubuntu 24.04 LTS AMI: $amiId" -ForegroundColor Green

$userDataPath = Join-Path $PSScriptRoot "ec2-userdata.sh"
$userDataBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($userDataPath))

$instanceId = (aws ec2 run-instances `
    --image-id $amiId `
    --instance-type "t3.micro" `
    --key-name "printease-key" `
    --security-group-ids $sgId `
    --user-data $userDataBase64 `
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=PrintEase-Server}]' `
    --region $Region `
    --profile $Profile `
    --query "Instances[0].InstanceId" `
    --output text).Trim()

Write-Host "✓ Launched EC2 Instance ID: $instanceId" -ForegroundColor Green
Write-Host "Waiting for Public IP assignment (approx 15 seconds)..." -ForegroundColor Yellow

Start-Sleep -Seconds 15

$publicIp = (aws ec2 describe-instances --instance-ids $instanceId --region $Region --profile $Profile --query "Reservations[0].Instances[0].PublicIpAddress" --output text).Trim()

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  PrintEase EC2 Server Booting Successfully!            " -ForegroundColor Green
Write-Host "  Public IP:   $publicIp                                " -ForegroundColor White
Write-Host "  Live URL:    http://$publicIp                         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "`nNote: The automated startup script is installing Docker and deploying PrintEase." -ForegroundColor Gray
Write-Host "It will be fully live at http://$publicIp within 2-3 minutes!" -ForegroundColor Gray

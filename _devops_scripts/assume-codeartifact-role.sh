#!/bin/bash
export AWS_PAGER=""
CODEARTIFACT_AWS_PROFILE=na-central-codeartifact
CODEARTIFACT_ACCOUNT_ID=706556442003
ROLE_TO_ASSUME=SsoUser_AssumeCodeArtifactRole

AWS_ASSUME=$(aws sts assume-role --role-arn arn:aws:iam::${CODEARTIFACT_ACCOUNT_ID}:role/${ROLE_TO_ASSUME} --role-session-name $CODEARTIFACT_AWS_PROFILE --query Credentials)
AWS_ACCESS_KEY_ID=$(echo $AWS_ASSUME | npx json 'AccessKeyId')
AWS_SECRET_ACCESS_KEY=$(echo $AWS_ASSUME | npx json 'SecretAccessKey')
AWS_SESSION_TOKEN=$(echo $AWS_ASSUME | npx json 'SessionToken')

aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile "$CODEARTIFACT_AWS_PROFILE"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile  "$CODEARTIFACT_AWS_PROFILE"
aws configure set aws_session_token "$AWS_SESSION_TOKEN" --profile  "$CODEARTIFACT_AWS_PROFILE"
aws configure set region us-east-1 --profile "$CODEARTIFACT_AWS_PROFILE"

aws codeartifact login --tool npm --repository na-npm --domain na-npm --domain-owner "$CODEARTIFACT_ACCOUNT_ID" --namespace @sa --profile "$CODEARTIFACT_AWS_PROFILE"

# export AWS_PROFILE=$PROFILE
# echo $AWS_ACCESS_KEY_ID
# echo $AWS_SECRET_ACCESS_KEY
# echo $AWS_SESSION_TOKEN


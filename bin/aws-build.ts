#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AwsBuildStack } from '../lib/aws-build-stack';

const app = new cdk.App();
new AwsBuildStack(app, 'AwsBuildStack', {
  // Create the CodeStar Connection in AWS Console first, then paste the ARN here
  connectionArn: app.node.tryGetContext('connectionArn') || 'arn:aws:codeconnections:us-east-1:730626967610:connection/f4405d16-a642-41df-9285-1d7de99d8ae9',
  githubOwner: app.node.tryGetContext('githubOwner') || 'czarny',
  sourceRepoName: app.node.tryGetContext('sourceRepoName') || 'aws-build',
  targetRepoName: app.node.tryGetContext('targetRepoName') || 'lfs-repo',
  branch: app.node.tryGetContext('branch') || 'main',

  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

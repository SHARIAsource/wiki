#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WikiCdkStack } from '../lib/wiki-cdk-stack';
import { WikiRDSStack } from '../lib/wiki-rds-stack';

const app = new cdk.App();
const rdsStack = new WikiRDSStack(app, 'WikiRdsStack', {
  tags: {
    'environment': 'dev',
    'project': 'wiki',
  },
  stackName: 'wiki-rds',
});

const wikiStack = new WikiCdkStack(app, 'WikiCdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '701541878387', region: 'us-east-1' },
  stackName: 'wiki',
  vpc: rdsStack.vpc,
  dbInstance: rdsStack.dbInstance,
  tags: {
    environment: 'prod',
    project: 'wiki'
  }

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
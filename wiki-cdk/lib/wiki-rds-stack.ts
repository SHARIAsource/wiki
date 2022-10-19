import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import {readFileSync} from 'fs';


export class WikiRDSStack extends cdk.Stack {

  // Property for VPC to share with other stack
  // https://bobbyhadz.com/blog/aws-cdk-share-vpc-between-stacks
  public readonly vpc: ec2.Vpc;
  public readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'wiki-vpc', {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'isolated-subnet-1',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28,
        },
      ],
    });
    this.vpc = vpc;

    // Generate and store database credentials
    const wikiDbCredentialsSecret = new secretsManager.Secret(this, 'wikiDbCredentialsSecret', {
      secretName: 'wikiDbCredentialsSecret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres',
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password'
      }
    });    
    
    // Create RDS instance
    const dbInstance = new rds.DatabaseInstance(this, 'db-instance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13_7,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      credentials: rds.Credentials.fromSecret(wikiDbCredentialsSecret),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: 'wikidb',
      publiclyAccessible: false,
    });
    this.dbInstance = dbInstance;

    // output a few properties to help us find the credentials 
    new cdk.CfnOutput(this, 'Secret Name', { value: wikiDbCredentialsSecret.secretName }); 
    new cdk.CfnOutput(this, 'Secret ARN', { value: wikiDbCredentialsSecret.secretArn }); 
    new cdk.CfnOutput(this, 'Secret Full ARN', {
        value: wikiDbCredentialsSecret.secretFullArn || '',
        exportName: 'wikiDbCredentialsSecretFullArn',
    });
    new cdk.CfnOutput(this, 'dbEndpoint', {
      value: dbInstance.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'secretName', {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      value: dbInstance.secret?.secretName!,
    });

  }
}

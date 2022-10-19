import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import {readFileSync} from 'fs';

interface WikiCdkStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
}

export class WikiCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: WikiCdkStackProps) {
    super(scope, id, props);

    const {vpc} = props;
    const {dbInstance} = props;

    // const vpc = new ec2.Vpc(this, 'my-cdk-vpc', {
    //   cidr: '10.0.0.0/16',
    //   natGateways: 0,
    //   maxAzs: 2,
    //   subnetConfiguration: [
    //     {
    //       name: 'public-subnet-1',
    //       subnetType: ec2.SubnetType.PUBLIC,
    //       cidrMask: 24,
    //     },
    //     {
    //       name: 'isolated-subnet-1',
    //       subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    //       cidrMask: 28,
    //     },
    //   ],
    // });
    

    // Get the RDS connection secret
    const secretArn = '';
    // const wikiDbCredentialsSecret = secretsManager.Secret.fromSecretCompleteArn(this, 'wikiDbCredentialsSecret', secretArn);

    // Create an SSM parameter with the secret ARN, then reference the SSM parameter in the userdata?


    // Simple user data script
    // Sets up some requirements, clones the app repo, runs Ansible playbooks to configure the site
    const userDataScript = readFileSync('./lib/user-data.sh', 'utf8');
    const userData = ec2.UserData.custom(userDataScript);

    const machineImage = ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id',
      { os: ec2.OperatingSystemType.LINUX }
    )

    const ec2InstanceSG = new ec2.SecurityGroup(this, 'ec2-instance-sg', {
      vpc,
    });
    ec2InstanceSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow SSH connections from anywhere',
    );

    // // Generate and store database credentials
    // const wikiDbCredentialsSecret = new secretsManager.Secret(this, 'wikiDbCredentialsSecret', {
    //   secretName: 'wikiDbCredentialsSecret',
    //   generateSecretString: {
    //     secretStringTemplate: JSON.stringify({
    //       username: 'postgres',
    //     }),
    //     excludePunctuation: true,
    //     includeSpace: false,
    //     generateStringKey: 'password'
    //   }
    // });    

    // // output a few properties to help us find the credentials 
    // new cdk.CfnOutput(this, 'Secret Name', { value: wikiDbCredentialsSecret.secretName }); 
    // new cdk.CfnOutput(this, 'Secret ARN', { value: wikiDbCredentialsSecret.secretArn }); 
    // new cdk.CfnOutput(this, 'Secret Full ARN', { value: wikiDbCredentialsSecret.secretFullArn || '' });
    
    
    // // Create RDS instance
    // const dbInstance = new rds.DatabaseInstance(this, 'db-instance', {
    //   vpc,
    //   vpcSubnets: {
    //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    //   },
    //   engine: rds.DatabaseInstanceEngine.postgres({
    //     version: rds.PostgresEngineVersion.VER_13_7,
    //   }),
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.BURSTABLE3,
    //     ec2.InstanceSize.MICRO,
    //   ),
    //   credentials: rds.Credentials.fromSecret(wikiDbCredentialsSecret),
    //   multiAz: false,
    //   allocatedStorage: 20,
    //   maxAllocatedStorage: 100,
    //   allowMajorVersionUpgrade: false,
    //   autoMinorVersionUpgrade: true,
    //   backupRetention: cdk.Duration.days(7),
    //   deleteAutomatedBackups: true,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    //   deletionProtection: false,
    //   databaseName: 'wikidb',
    //   publiclyAccessible: false,
    // });

    // Create EC2 instance
    const wikiVm = new ec2.Instance(this, 'WikiVM', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      machineImage: machineImage,
      instanceType: new ec2.InstanceType('t3.small'),
      securityGroup: ec2InstanceSG,
      userData: userData,
      keyName: 'cole_pil'
    });

    dbInstance.connections.allowFrom(wikiVm, ec2.Port.tcp(5432));

  }
}

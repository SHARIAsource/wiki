import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import {readFileSync} from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam';

interface WikiCdkStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
}

export class WikiCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: WikiCdkStackProps) {
    super(scope, id, props);

    const {vpc} = props;
    const {dbInstance} = props;

    // Get the RDS connection secret
    const secretArn = cdk.Fn.importValue('wikiDbCredentialsSecretFullArn');
    const secret = secretsManager.Secret.fromSecretCompleteArn(this, 'wikiDbCredentialsSecret', secretArn);
    // Create an SSM parameter with the secret ARN, then reference the SSM parameter in the userdata
    new ssm.StringParameter(this, 'DBCredentialsArn', {
      parameterName: `/wiki/wiki-rds-credentials-secret-arn`,
      stringValue: secretArn,
    });
    // Allow EC2 to call ssm:GetParameter
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),   // required
    })
    // Allow SSM to get the parameters (used in userdata)
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [
        "arn:aws:ssm:*:*:parameter/wiki/wiki-rds-credentials-secret-arn",
      ]
    }));
    // Allow getting the secret itself (in userdata)
    secret.grantRead(role);
    secret.grantWrite(role);

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
    ec2InstanceSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'allow HTTP connections from anywhere',
    );
    ec2InstanceSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'allow HTTPS connections from anywhere',
    );

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
      keyName: 'cole_pil',
      role: role
    });
    wikiVm.connections.allowTo(dbInstance, ec2.Port.tcp(5432), 'allow psql connections from wiki vm');

    // dbInstance.connections.allowFrom(wikiVm, ec2.Port.tcp(5432));
  }
}

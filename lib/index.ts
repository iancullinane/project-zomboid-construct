import { CfnOutput, ITaggable, TagManager, Tags } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { Asset } from "aws-cdk-lib/aws-s3-assets";

import * as fs from "fs";
import * as path from "path";

import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as r53 from "aws-cdk-lib/aws-route53";

import * as logic from "./logic/server-config"
import { ZomboidAccess } from "./components/zomboid-access"

const TEMPLATE_DIR = path.join(__dirname, "..", "assets", "templates")
const DIST_DIR = path.join(process.cwd(), "assets", "dist")

path.join(process.cwd(), "assets")
export interface GameServerProps {
  cfg: ServerConfig,
  role: iam.IRole,
  vpc: ec2.IVpc,
  sg: ec2.ISecurityGroup,
  hz: r53.IHostedZone,
  keyName: string;
  serverName?: string,
  modFile?: Buffer,
  instanceType?: string
}

export interface ServerConfig {
  region: string,
  ami: string,
  subdomain: string,
  servername: string,
  instancetype: string,
  hostedzoneid: string,
}

const amimap: Record<string, string> = {
  "us-east-2": "ami-0c15a71461028f685",
  "us-east-1": "ami-0f5513ad02f8d23ed",
}

// const amimap = new Record<string, string>([
// ]);

export class GameServerStack extends Construct implements ITaggable {

  public readonly userData: ec2.MultipartUserData;
  public readonly tags: TagManager;

  constructor(scope: Construct, id: string, props: GameServerProps) {
    super(scope, id);


    let region = props.cfg.region
    props.cfg.servername === undefined ? props.serverName = "servertest" : null;
    props.cfg.instancetype === undefined ? props.instanceType = "t2.micro" : null;

    // todo::this feels like kind of a hacky way to set these values, I am not
    // sure context is meant for this kind of work
    const machineImage = ec2.MachineImage.genericLinux(amimap);

    // This file and path stuff is really ugly but I don't know TS well enough...

    //::todo either provide data for various templates, or provide the consumer
    // a method to pass their own files (or both), for now always load from the
    // base construct templates



    let serverFiles = new Map<string, logic.TemplateBuilder>()

    // This project includes `template-file` but at this commit only the
    // project unit file is making use of it: https://www.npmjs.com/package/template-file
    const unitFileConfig = {
      config: {
        servername: props.serverName,
        adminPW: "PasswordXYZ",
        cachedir: "/home/steam/pz"
      }
    };

    let { mods, ids } = logic.parseMods(props.modFile!)
    const serverFileConfig = {
      config: {
        mods: mods.join(";"),
        ids: ids.join(";"),
      }

    }
    // The key is the destination of the files, the object in the second 
    // argument is the Buffer with the template, and the data object with any
    // replacements, currently the unit file is the only "real" template
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.serverName}_SandboxVars.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_SandboxVars.lua`), d: {} })
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.serverName}_spawnpoints.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnpoints.lua`), d: {} })
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.serverName}_spawnregions.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnregions.lua`), d: {} })

    // Only this unit file supports templates
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.serverName}.ini`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_server.ini`), d: serverFileConfig })
    serverFiles.set(path.join(DIST_DIR, `${props.serverName}.service`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_service.service`), d: serverFileConfig })

    const setupCommands = ec2.UserData.forLinux();
    setupCommands.addCommands(
      `echo "---- Install deps"`,
      `sudo add-apt-repository multiverse`,
      `sudo dpkg --add-architecture i386`,
      `sudo apt update`,
      `sudo apt install -y lib32gcc1 libsdl2-2.0-0:i386 docker.io awscli unzip`
    );

    this.userData = new ec2.MultipartUserData;
    this.userData.addUserDataPart(setupCommands, "", true);

    // 
    // This builds the configs and writes to the dist dir
    // 
    let config = logic.buildServerConfig(
      this.userData,
      serverFiles,
      props.serverName,
    );

    const s3UnitFile = new Asset(this, "pz-unit-file", {
      path: path.join(DIST_DIR, `${props.serverName}.service`),
    });
    s3UnitFile.grantRead(props.role);

    const s3ConfigDir = new Asset(this, "pz-config-dir", {
      path: path.join(DIST_DIR, "server-config"),
    });
    s3ConfigDir.grantRead(props.role);


    // Zip up config directory, I know this will zip because I am using the
    // folder as my `localFile`
    this.userData.addS3DownloadCommand({
      bucket: s3ConfigDir.bucket!,
      bucketKey: s3ConfigDir.s3ObjectKey!,
      localFile: "/home/steam/files/",
    });

    // This will be a single object because it is a filename
    this.userData.addS3DownloadCommand({
      bucket: s3UnitFile.bucket!,
      bucketKey: s3UnitFile.s3ObjectKey!,
      localFile: `/etc/systemd/system/${props.serverName}.service`,
    });

    // Place, enable, and start the service
    this.userData.addCommands(
      `mkdir -p /home/steam/pz/Server/`, // Just in case
      `unzip /home/steam/files/${s3ConfigDir.s3ObjectKey} -d /home/steam/pz/Server/`,
      `chmod +x /etc/systemd/system/${props.serverName}`,
      `systemctl enable ${props.serverName}.service`,
      `systemctl start ${props.serverName}.service`,
    );

    props.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    // ---- Start server
    const instance = new ec2.Instance(this, "project-zomboid-ec2", {
      instanceType: new ec2.InstanceType(props.cfg.instancetype),
      machineImage: machineImage,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      keyName: props.keyName,
      securityGroup: props.sg,
      role: props.role,
      userData: this.userData,
    });
    Tags.of(instance).add("game", "projectzomboid");



    // Holder for pz sg's
    // todo::nested?
    const zomboidServerSg = new ec2.SecurityGroup(
      this,
      "zomboid-server-port-reqs",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: "sg to match zomboid requirements",
      }
    );

    // Following two sg's are for Steam server
    zomboidServerSg.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.tcpRange(27010, 27020),
      "steam tcp rules"
    );

    zomboidServerSg.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.udpRange(27010, 27020),
      "steam udp rules"
    );

    // Loop users out of context and provide access via sg
    // This is simplest possible design based on user IP so I don't have to 
    // have private subnets, NATs, or anything else that costs money this will
    // be resolved in the next update which will include an NLB, by default 
    // there are no users
    let users = this.node.tryGetContext('users')
    for (let key in users) {
      let value = users[key];
      new ZomboidAccess(this, "zomboid-users-" + value, {
        securityGroup: zomboidServerSg,
        playersIp: value,
        player: key
      })
    }

    // add the pz ingress rules
    instance.addSecurityGroup(zomboidServerSg);

    // // Add a hosted zone, each game is one server, one subdomain, plan accordingly
    // const pzHZ = new r53.PublicHostedZone(this, "HostedZoneDev", {
    //   zoneName: props.cfg.subdomain + "." + props.hz.zoneName,
    // });

    new r53.ARecord(this, "PzARecordB", {
      zone: props.hz,
      target: r53.RecordTarget.fromIpAddresses(instance.instancePrivateIp),
    });


    // // todo::This can probably be a downstream lookup
    // new r53.NsRecord(this, "NsForParentDomain", {
    //   zone: props.hz,
    //   recordName: props.cfg.subdomain + '.' + `${props.serverName}.com`,
    //   values: pzHZ.hostedZoneNameServers!, // exclamation is like, hey it might be null but no: https://stackoverflow.com/questions/54496398/typescript-type-string-undefined-is-not-assignable-to-type-string
    // });

    // Create outputs for connecting
    new CfnOutput(this, "IP Address", {
      value: instance.instancePublicIp,
      exportName: "IPAddress"
    });

    //   // Configure the `natGatewayProvider` when defining a Vpc
    //   const natGatewayProvider = NatProvider.instance({
    //     instanceType: new InstanceType('t2.micro'),
    //   });

    //   // The code that defines your stack goes here
    //   const baseVpc = new Vpc(this, 'base-vpc', {
    //     cidr: props.cidrRange,
    //     maxAzs: props.azs,
    //     natGatewayProvider: natGatewayProvider,
    //   })
    //   const vpcSG = new SecurityGroup(this, 'SG', { vpc: baseVpc });

    //   new CfnOutput(this, "VPC ID", { value: baseVpc.vpcId});
    //   new CfnOutput(this, "SG ID", { value: vpcSG.securityGroupId});
  }
}

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
}

export interface ServerConfig {
  region: string,
  ami: string,
  keyName: string;
  servername?: string,
  subdomain?: string,
  instancetype?: string,
  serverName?: string,
  modFile?: Buffer,
  public?: Boolean;
  fresh?: boolean,
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

    // Ensure some values
    props.cfg.servername === undefined ? props.cfg.serverName = "servertest" : null;
    props.cfg.instancetype === undefined ? props.cfg.instancetype = "t2.micro" : null;
    props.cfg.fresh === undefined ? props.cfg.fresh = false : null;

    const machineImage = ec2.MachineImage.genericLinux(amimap);
    let serverFiles = new Map<string, logic.TemplateBuilder>();

    const unitFileConfig = {
      config: {
        servername: props.cfg.servername!,
        adminPW: "PasswordXYZ",
        cachedir: "/home/steam/pz"
      }
    }

    let serverFileConfig = {}
    if (props.cfg.modFile !== null) {
      let { mods, ids } = logic.parseMods(props.cfg.modFile!)
      serverFileConfig = {
        config: {
          mods: mods.join(";"),
          ids: ids.join(";"),
        }
      }
    }
    // The key is the destination of the files, the object in the second 
    // argument is the Buffer with the template, and the data object with any
    // replacements, currently the unit file is the only "real" template
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.serverName}_SandboxVars.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_SandboxVars.lua`), d: {} })
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.serverName}_spawnpoints.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnpoints.lua`), d: {} })
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.serverName}_spawnregions.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnregions.lua`), d: {} })

    // Only this unit file supports templates
    serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.serverName}.ini`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_server.ini`), d: serverFileConfig })
    serverFiles.set(path.join(DIST_DIR, `${props.cfg.serverName}.service`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_service.service`), d: unitFileConfig })

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
    logic.buildServerConfig(
      this.userData,
      serverFiles,
    );

    const s3UnitFile = new Asset(this, "pz-unit-file", {
      path: path.join(DIST_DIR, `${props.cfg.serverName}.service`),
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
      localFile: `/etc/systemd/system/${props.cfg.serverName}.service`,
    });

    // Place, enable, and start the service
    this.userData.addCommands(
      `mkdir -p /home/steam/pz/Server/`, // Just in case
      `unzip /home/steam/files/${s3ConfigDir.s3ObjectKey} -d /home/steam/pz/Server/`,
      `chmod +x /etc/systemd/system/${props.cfg.serverName}`,
      `systemctl enable ${props.cfg.serverName}.service`,
      `systemctl start ${props.cfg.serverName}.service`,
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
        subnetType: props.cfg.public === true || undefined ? ec2.SubnetType.PUBLIC : ec2.SubnetType.PRIVATE_WITH_NAT,
      },
      keyName: props.cfg.keyName,
      securityGroup: props.sg,
      role: props.role,
      userData: this.userData,
    });
    Tags.of(instance).add("game", `pz-${props.cfg.servername}`);



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

    // If a subdomain is provided, create and use it
    // warning: will fail if trying to use twice
    let pzHz: r53.IPublicHostedZone;
    if (props.cfg.subdomain) {
      pzHz = new r53.PublicHostedZone(this, "HostedZoneDev", {
        zoneName: props.cfg.subdomain + "." + props.hz.zoneName,
      });
      // todo::This can probably be a downstream lookup
      new r53.NsRecord(this, "NsForParentDomain", {
        zone: props.hz,
        recordName: props.cfg.subdomain + '.' + `${props.cfg.serverName}.com`,
        values: pzHz.hostedZoneNameServers!, // exclamation is like, hey it might be null but no: https://stackoverflow.com/questions/54496398/typescript-type-string-undefined-is-not-assignable-to-type-string
      });
    } else {
      pzHz = props.hz;
    }

    new r53.ARecord(this, "PzARecordB", {
      zone: pzHz!,
      target: r53.RecordTarget.fromIpAddresses(instance.instancePublicIp),
    });


    // // todo::This can probably be a downstream lookup
    // new r53.NsRecord(this, "NsForParentDomain", {
    //   zone: props.hz,
    //   recordName: props.cfg.subdomain + '.' + `${props.cfg.serverName}.com`,
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

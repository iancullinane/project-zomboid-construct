import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface ZomboidAccessProps {
  securityGroup: ec2.SecurityGroup;
  playersIp: string;
  player: string;
}

// Access to ports for playing Project Zomboid
export class ZomboidAccess extends Construct {

  constructor(scope: Construct, id: string, props: ZomboidAccessProps) {
    super(scope, id);

    props.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.playersIp),
      ec2.Port.udp(16261),
      "pz UDP rule one " + props.player
    );

    props.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.playersIp),
      ec2.Port.udp(8766),
      "pz UDP rule two" + props.player
    );
  }
}

[![Generic badge](https://img.shields.io/badge/development-in&nbsp;progress-orange.svg)](https://shields.io/)
   
project-zomboid-construct
=========================

This will provide a project zomboid server runnning on EC2. Server configs will be generated at synth. If you provide a file under `assets/mods.txt` you can use a space seperated Modname:ModID format to list server mods. See the current mod list in this repo. This way they will be downloaded and managed at server start.  

It is assumed you have a VPC and HostedZone to hook into. 

The stack will provide the following:

* The four needed config files, and a systemd unit file
  * Generated by template (coming soon, more config)
* MultiPartUserData
  * Install system dependencies
  * Install game via steamcmd
  * Create cdk assets from the files generated at synth
    * Add file commands (including unzip of main files) to UserData
  * Write, enable, and start a systemd unit file on `start-server.sh`
* A subdomain on the provided HostedZone (server name is your domain name, without a ".com")
* Steam ingress rules
* If provided, IP address whitelisting for a set of users (required until NLB is finished)
* An EC2 instance using all above

***Note***: As of this commit access is provided by IP address ingress rules. This will remain until I finish the networking portion.

### Config Props

This is all messy from dev, I will clean it up later, but you need to provide the `GameServerProps` interface, which includes a `ServerConfig` interface...sorry

---
```markdown
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
```
---
### modFile

You can provide a list of mods. Place a file called `mods.txt` in `assets/` to load it. Otherwise the below modlist will be used. This file must be in a certain format (below) to be properly parsed. Currently this pacakge has the following `mods.txt` file embedded. If you want to change it. Mods are included in ther `server.ini` file:

---
```markdown
2503622437 SkillRecoveryJournal
2667899942 VFExpansion1
2701170568 ExtraMapSymbols 
2701170568 ExtraMapSymbolsUI
1910606509 CookingTime
1911229825 LearningTime
2039234811 RelaxingTime
1926311864 ClearingTime
2244879881 ExploringTime
1105347046 PZGate
1510950729 FRUsedCars 
1510950729 FRUsedCarsNRN
2489148104 87cruiser
2441990998 89def110
2529746725 EasyConfigChucked
2458631365 ExpandedHelicopterEvents
2756615186 rx7fc
1299328280 ToadTraits
2686972114 DylansZombieLoot
2695471997 myclothinguimod
2711057211 CleanDirt
2699828474 RebalancedPropMoving
2169435993 modoptions
2619072426 TheStar
2734705913 MapSymbolSizeSlider
2392709985 tsarslib
2478768005 TMC_Trolley

```
---
Altogether after deploy a player would be able to use `sub.example.com` on port `16261` and `8766` as well as necessary ports for Steam.

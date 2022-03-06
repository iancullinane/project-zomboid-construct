
project-zomboid-construct
=========================

This will provide a project zomboid server runnning on EC2. Server configs will be generated at synth. It is assued you have a VPC and HostedZone to hook into.

The stack will provide the following:

* MultiPartUserData
  * Install system dependencies
  * Install game via steamcmd
  * Download file asstes from the cdk.Asset object types
  * Write, enable, and start a systemd unit file on `start-server.sh`
* A subdomain on the provided HostedZone
* Steam ingress rules
* An EC2 instance using all above

***Note***: As of this commit access is provided by IP address ingress rules. This will remain until I finish the networking portion.

### Context

Package provide custom stack props in the following form:

---
```markdown
export interface GameServerProps {
  cfg: ServerConfig, // Currently unused, is little more than a UserData shim
  role: iam.IRole,
  vpc: ec2.IVpc,
  sg: ec2.ISecurityGroup,
  hz: r53.IHostedZone,
  serverName?: string,
  modFile?: Buffer,
}
```
---

### modFile

A future update will allow for a list of custom mods. This file must be in a certain format (below) to be properly parsed. Currently this pacakge has the following `mods.txt` file embedded. If you want to change it. Mods are included in ther `server.ini` file:

```
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

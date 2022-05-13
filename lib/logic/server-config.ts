/// <reference path="../index.ts" />
// This could or maybe should be its own package, but for simplicity and because
// this is for personal user, I am leaving it here
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { GameConfig } from "../index"
import { sandboxFileConfig, unitFileConfig } from "./types";
import { FileMaker } from "./file-config";


export function buildServerConfig(userData: ec2.UserData, cfg: GameConfig) {

  let serverFileConfig = {};
  if (cfg.modFile !== null) {
    let { mods, ids } = parseMods(cfg.modFile!)
    serverFileConfig = {
      config: {
        mods: mods.join(";"),
        ids: ids.join(";"),
      }
    }
  }

  let fm = new FileMaker()
  // let serverFiles = new Map<string, TemplateBuilder>();
  fm.addFile(`${cfg.servername}_SandboxVars.lua`, "server-config", cfg.servername!, sandboxFileConfig)
  fm.addFile(`${cfg.servername}_spawnpoints.lua`, "server-config", cfg.servername!, {})
  fm.addFile(`${cfg.servername}_spawnregions.lua`, "server-config", cfg.servername!, {})
  fm.addFile(`${cfg.servername}.ini`, "server-config", cfg.servername!, serverFileConfig)
  fm.addFile(`${cfg.servername}.service`, "units", `${cfg.servername}.service`, unitFileConfig)
  fm.addFile(`ebs-unit.service`, "units", `${cfg.servername}.service`, {})
  fm.addFile(`r53-unit.service`, "units", `${cfg.servername}.service`, {})

  fm.writeFiles()

  let addUsers: string[] = [
    `echo "---- Add users"`,
    `sudo usermod -aG docker ubuntu`,
    `sudo usermod -aG docker steam`
  ];

  // Install steam commands
  // You can ask the steamcmd container to dl workshop items (compiled into
  // steamcmdMods variable), but you need to login, took awhile to figure 
  // this out the the feature exists I just don't use it, the following 
  // will used the compiled mods config to provide steamcmd with the right args:
  // ${steamcmdMods.join(' ')} \
  let installCommands: string[] = [
    `echo "---- Install PZ"`,
    `mkdir /mnt/${cfg.servername}`,
    `docker run -v /mnt/${cfg.servername}:/data steamcmd/steamcmd:ubuntu-18 \
        +login anonymous \
        +force_install_dir /data \
        +app_update 380870 validate \
        +quit`
  ]

  // userData.addCommands(...updateDebian);
  userData.addCommands(...addUsers);
  userData.addCommands(...installCommands);
}



// parseMods is a helper for generating two arrays, one a list of mods, and the
// other a list of mod ids which match their partner in the other list
function parseMods(modFile: Buffer): { mods: Array<string>, ids: Array<string> } {

  var modInstallArray = Array<string>();
  var ids = Array<string>()
  var mods = Array<string>()
  modFile === undefined ? null : modInstallArray = modFile.toString().split("\n");

  // Populate arrays from source
  modInstallArray.forEach((v, i) => {
    if (v === "") { return }

    // This is actually unused, see below
    let modConfig = v.split(/\s+/)
    // steamcmdMods[i] = `+workshop_download_item 380870 ${modConfig[0]}`
    ids.push(`${modConfig[0]}`)
    mods.push(`${modConfig[1]}`)
  });

  return {
    mods,
    ids,
  }
}


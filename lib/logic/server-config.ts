/// <reference path="../index.ts" />
// This could or maybe should be its own package, but for simplicity and because
// this is for personal user, I am leaving it here
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { GameConfig } from "../index"
import { sandboxFileDefaultConfig, UnitFileConfig } from "../types";
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

  const unitServiceConfig: UnitFileConfig = {
    servername: cfg.servername!,
    adminPW: "PasswordXYZ",
    cachedir: `/mnt/${cfg.servername}`,

  };

  let fm = new FileMaker()
  // let serverFiles = new Map<string, TemplateBuilder>();
  // When adding something to the file maker, the first value fileName is more
  // akin to which template is desired
  fm.addFile(`SandboxVars.lua`, "server-config", cfg.servername!, sandboxFileDefaultConfig)
  fm.addFile(`spawnpoints.lua`, "server-config", cfg.servername!, {})
  fm.addFile(`spawnregions.lua`, "server-config", cfg.servername!, {})
  fm.addFile(`server.ini`, "server-config", cfg.servername!, serverFileConfig)

  fm.addFile(`service.service`, "units", `${cfg.servername}`, unitServiceConfig)
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


// 
// 
// 

// -rw-r--r--  1 root root  439 Jan  1  1980 sheeta.service_ebs-unit.service
// -rw-r--r--  1 root root 1593 Jan  1  1980 sheeta.service_r53-unit.service
// -rw-r--r--  1 root root  377 Jan  1  1980 sheeta.service_service.service
// root@ip-192-168-19-228:/home# systemctl start sheeta.service_service.service
// Assertion failed on job for sheeta.service_service.service.
// root@ip-192-168-19-228:/home# cat /etc/systemd/system/sheeta.service_service.service
// [Unit]
// Description=Start the project zomboid server script as a service
// AssertPathExists=/mnt/default/start-server.sh

// [Service]
// RemainAfterExit=yes
// Restart=always
// RestartSec=10
// StartLimitInterval=0
// TimeoutStartSec=0
// ExecStart=/bin/sh -c '/mnt/default/start-server.sh -servername default -adminpassword PasswordXYZ -cachedir=/mnt/default'

// [Install]
// WantedBy=multi-user.target
// root@ip-192-168-19-228:/home#

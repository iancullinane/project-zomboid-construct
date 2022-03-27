/// <reference path="../index.ts" />

// This could or maybe should be its own package, but for simplicity and because
// this is for personal user, I am leaving it here
import * as fs from "fs";
import * as path from "path";

import * as ec2 from "aws-cdk-lib/aws-ec2";
import { render, Data } from "template-file"
import { DIST_DIR, TEMPLATE_DIR, GameConfig, InfraConfig } from "../index"


export interface Config {
  userData: ec2.UserData
}

// TemplateBuilder is a Buffer holding a template file, and a data object to 
// hold its values for replacement
export interface TemplateBuilder {
  b: Buffer,
  d: Data,
}



function getTemplate(fileName: string): TemplateBuilder {
  // let t = TemplateBuilder{ b: fs.readFileSync(`${TEMPLATE_DIR}/template_SandboxVars.lua`), d: { }}
  let t = {
    b: fs.readFileSync(`${TEMPLATE_DIR}/template${fileName}`),
    d: {}
  };
  return t
};


export function buildServerConfig(userData: ec2.UserData, cfg: GameConfig): Config {

  const unitFileConfig = {
    config: {
      servername: cfg.servername!,
      adminPW: "PasswordXYZ",
      cachedir: `/mnt/${cfg.servername}`
    }
  }



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

  let serverFiles = new Map<string, TemplateBuilder>();

  serverFiles.set(path.join(DIST_DIR, "server-config", `${cfg.servername}_SandboxVars.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/game/template_SandboxVars.lua`), d: { config: { ch_points: 5 } } });
  serverFiles.set(path.join(DIST_DIR, "server-config", `${cfg.servername}_spawnpoints.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/game/template_spawnpoints.lua`), d: {} });
  serverFiles.set(path.join(DIST_DIR, "server-config", `${cfg.servername}_spawnregions.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/game/template_spawnregions.lua`), d: {} });

  // t file supports templates
  serverFiles.set(path.join(DIST_DIR, "server-config", `${cfg.servername}.ini`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/game/template_server.ini`), d: serverFileConfig })

  serverFiles.set(path.join(DIST_DIR, `${cfg.servername}.service`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/game/template_service.service`), d: unitFileConfig })

  // todo::interface configs into data and be clever
  serverFiles.forEach((tmpl, k) => {
    writeFileFromTemplate(k, tmpl.b, tmpl.d)
  })

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

  return {
    userData
  }

}

// writeFileFromTemplate takes a path (should be your dist path) and renders
// a template from the buffer and data
export function writeFileFromTemplate(path: string, template: Buffer, data: Data) {
  var rendered = render(template.toString(), data);
  try {
    if (template) {
      fs.writeFileSync(path, rendered)
    }
  } catch (e) {
    console.log("Error writing file")
  }
}

// parseMods is a helper for generating two arrays, one a list of mods, and the
// other a list of mod ids which match their partner in the other list
export function parseMods(modFile: Buffer): { mods: Array<string>, ids: Array<string> } {

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


// const unitFileConfig = {
//       config: {
//         servername: props.cfg.servername!,
//         adminPW: "PasswordXYZ",
//         cachedir: "/home/steam/pz"
//       }
//     }

//     let serverFileConfig = {};
//     if (props.cfg.modFile !== null) {
//       let { mods, ids } = logic.parseMods(props.cfg.modFile!)
//       serverFileConfig = {
//         config: {
//           mods: mods.join(";"),
//           ids: ids.join(";"),
//         }
//       }
//     }
//     // The key is the destination of the files, the object in the second 
//     // argument is the Buffer with the template, and the data object with any
//     // replacements, currently the unit file is the only "real" template
//     serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.servername}_SandboxVars.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_SandboxVars.lua`), d: {} })
//     serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.servername}_spawnpoints.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnpoints.lua`), d: {} })
//     serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.servername}_spawnregions.lua`), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_spawnregions.lua`), d: {} })

//     // Only this unit file supports templates
//     serverFiles.set(path.join(DIST_DIR, "server-config", `${props.cfg.servername}.ini`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_server.ini`), d: serverFileConfig })
//     serverFiles.set(path.join(DIST_DIR, `${props.cfg.servername}.service`,), { b: fs.readFileSync(`${TEMPLATE_DIR}/template_service.service`), d: unitFileConfig })

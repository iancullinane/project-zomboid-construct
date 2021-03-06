// This could or maybe should be its own package, but for simplicity and because
// this is for personal user, I am leaving it here
import * as fs from "fs";
const fsPromises = fs.promises;

import * as ec2 from "aws-cdk-lib/aws-ec2";
import { render, Data } from "template-file"

export interface Config {
  userData: ec2.UserData
}

// TemplateBuilder is a Buffer holding a template file, and a data object to 
// hold its values for replacement
export interface TemplateBuilder {
  b: Buffer,
  d: Data,
}

export function buildServerConfig(
  userData: ec2.UserData,
  serverConfig: Map<string, TemplateBuilder>): Config {

  // Write the templates
  // todo::interface configs into data and be clever
  serverConfig.forEach((tmpl, k) => {
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
    `mkdir /home/steam/pz`,
    `docker run -v /home/steam/pz:/data steamcmd/steamcmd:ubuntu-18 \
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

// 
// export async function writeFileFromTemplate(path: string, template: Buffer, data: Data) {
//   let rendered = render(template.toString(), data);

//   // useful:https://stackoverflow.com/questions/40593875/using-filesystem-in-node-js-with-async-await
//   try {
//     fsPromises.writeFile(path, rendered);
//   } catch (err) {
//     console.log(`error writing: ${path}`)
//   }
// }
// 

// writeFileFromTemplate takes a path (should be your dist path) and renders
// a template from the buffer and data
export function writeFileFromTemplate(path: string, template: Buffer, data: Data) {


  var rendered = render(template.toString(), data);
  try {
    // let contents = await fs.readFileSync(path);
    if (template) {
      fs.writeFileSync(path, rendered)
    }
  } catch (e) {
    console.log("Error writing file")
  }


  // Open file, register error
  // console.log(`write to: ${path}`)
  // var file = fs.createWriteStream(path, { flags: "w" });
  // file.on('error', (err) => { console.log(`error writing file: ${err}`) });

  // console.log()

  // // Use template-file methods to render server files
  // var rendered = render(template.toString(), data);
  // rendered.split("\n").forEach((v) => { file.write(`${v}\n`) });
  // console.log(rendered);
  // file.end();

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

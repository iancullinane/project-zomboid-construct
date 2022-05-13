// object defaults
// https://stackoverflow.com/questions/23314806/setting-default-value-for-typescript-object-passed-as-argument
import { render, Data } from "template-file"
import { DIST_DIR, TEMPLATE_DIR } from "../index"
import * as fs from "fs";
import * as path from "path";

export interface TemplateBuilder {
  b: Buffer,
  d: Data,
}

export class FileMaker {
  files: Map<string, TemplateBuilder>;

  constructor() {
    this.files = new Map<string, TemplateBuilder>();
  }

  public addFile(fileName: string, assetType: string, serverName: string, d: Data) {
    let key = path.join(DIST_DIR, assetType, `${serverName}${fileName}`)
    let object = { b: fs.readFileSync(`${TEMPLATE_DIR}/${assetType}/template_${fileName}`), d: d }
    this.files.set(key, object);
  }

  public writeFiles() {
    this.files.forEach((tmpl, k) => {
      writeFileFromTemplate(k, tmpl.b, tmpl.d)
    })
  }
}


function writeFileFromTemplate(path: string, template: Buffer, data: Data) {
  var rendered = render(template.toString(), data);
  try {
    if (template) {
      fs.writeFileSync(path, rendered)
    }
  } catch (e) {
    console.log("Error writing file")
  }
}

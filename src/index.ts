import { editor, MarkerSeverity, Uri } from "monaco-editor";
import * as monaco from "monaco-editor";
import { configureMonacoYaml, type SchemasSettings } from "monaco-yaml";
import * as yaml from "yaml";

import "./index.css";
import schema from "./schema.json";

const TAB_SIZE = 2;

window.MonacoEnvironment = {
  getWorker(moduleId, label) {
    switch (label) {
      case "yaml":
        return new Worker(new URL("monaco-yaml/yaml.worker", import.meta.url));
      default:
        throw new Error(`Unknown label ${label}`);
    }
  },
};

const defaultSchema: SchemasSettings = {
  uri: "file://./workspace.schema.json",
  // @ts-expect-error TypeScript can’t narrow down the type of JSON imports
  schema,
  fileMatch: ["**"],
};

const monacoYaml = configureMonacoYaml(monaco, {
  enableSchemaRequest: false,
  schemas: [defaultSchema],
});

// defaultSchema.schema.

// monacoYaml.update({
//   schemas:[]
// })

const uploadButton = document.getElementById(
  "upload-button-demo"
) as HTMLButtonElement;
const uploadInput = document.getElementById("upload-name") as HTMLInputElement;

const popUploadButton = document.getElementById("depublish-upload-button");

const getUploadOptions = (): string[] =>
  schema!.properties["uploads"]["items"]["enum"];

const setUploadOptions = (value: string[]): void => {
  schema!.properties["uploads"]["items"]["enum"] = value;
  monacoYaml.update({
    schemas: [defaultSchema],
  });
};

const updateUploadOptions = (...value: string[]): boolean => {
  let knownUploads = getUploadOptions();
  let sizeBefore = knownUploads.length;
  knownUploads.push(...value);
  knownUploads = [...new Set(knownUploads)];
  setUploadOptions(knownUploads);

  return sizeBefore !== knownUploads.length;
};

const value = `
# Edit the configuration here
# Hint: Ctl+Space shows you the configuration options, hover any property to see a detailed description

id: dfs
uploads:
  - "123"
  - "456"
  - "not-yet-accepted"
`
  .replace(/:$/m, ": ")
  .trim();

const ed = editor.create(document.getElementById("editor")!, {
  automaticLayout: true,
  model: editor.createModel(value, "yaml", Uri.parse("monaco-yaml.yaml")),
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "vs-dark"
    : "vs-light",
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true,
  },
  tabSize: TAB_SIZE,
});

editor.onDidChangeMarkers(([resource]) => {
  const problems = document.getElementById("problems")!;
  const markers = editor.getModelMarkers({ resource });
  while (problems.lastChild) {
    problems.lastChild.remove();
  }
  for (const marker of markers) {
    if (marker.severity === MarkerSeverity.Hint) {
      continue;
    }
    const wrapper = document.createElement("div");
    wrapper.setAttribute("role", "button");
    const codicon = document.createElement("div");
    const text = document.createElement("div");
    wrapper.classList.add("problem");
    codicon.classList.add(
      "codicon",
      marker.severity === MarkerSeverity.Warning
        ? "codicon-warning"
        : "codicon-error"
    );
    text.classList.add("problem-text");
    text.textContent = marker.message;
    wrapper.append(codicon, text);
    wrapper.addEventListener("click", () => {
      ed.setPosition({
        lineNumber: marker.startLineNumber,
        column: marker.startColumn,
      });
      ed.focus();
    });
    problems.append(wrapper);
  }
});

uploadButton!.addEventListener("click", () => {
  let text = uploadInput.value.trim() ?? "";
  if (text === "") return;
  const wasNew = updateUploadOptions(text);
  if (!wasNew) return;

  let model = ed.getModel();

  let rawConfigText = model?.getValue() ?? "";
  let config = yaml.parse(rawConfigText);
  console.log(config);

  let doc = yaml.parseDocument(rawConfigText);
  let uploads = doc.get("uploads") as any | undefined;
  if (uploads === undefined) {
    uploads = doc.createNode([]) as unknown as any;
    doc.set("uploads", uploads);
  }

  if (uploads["items"].find((i) => i["value"] === text) !== undefined) return;
  const newUpload = doc.createNode(text);
  newUpload.comment =
    "This comment could contain a human readable ID for the Upload";
  uploads.add(newUpload);

  /*
   Note this is text generated from the AST,
   That means, formatting is done by the YAML lib.
   While comments are preserved, some other hidden toekns like whitespace/indentation isn't.

   For our purposes, this should be enough.
  */
  let roundTrippedText = doc.toString({ indent: TAB_SIZE });
  model?.setValue(roundTrippedText);
});

popUploadButton!.addEventListener("click", () => {
  let knownUploads = getUploadOptions();
  knownUploads.splice(0, 1);
  console.log(knownUploads);
  setUploadOptions(knownUploads);
});

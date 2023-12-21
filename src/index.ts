// import { editor, MarkerSeverity, Uri } from "monaco-editor";
import { configureMonacoYaml, type SchemasSettings } from "monaco-yaml";
import * as monaco from "monaco-editor";
import * as yaml from "yaml";
// eslint-disable-next-line import/no-unresolved
import YamlWorker from "./yaml-worker?worker";

import "./index.css";
import schema from "./schema.json";

const TAB_SIZE = 2;

window.MonacoEnvironment = {
  getWorker(moduleId, label) {
    switch (label) {
      case "yaml":
        return new YamlWorker();
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

document.getElementById("loading-msg")!.remove();

const monacoYaml = configureMonacoYaml(monaco, {
  enableSchemaRequest: false,
  schemas: [defaultSchema],
});

const uploadButton = document.getElementById(
  "upload-button-demo"
) as HTMLButtonElement;
const uploadInput = document.getElementById("upload-name") as HTMLInputElement;

const popUploadButton = document.getElementById("depublish-upload-button");

const getUploadOptions = (): string[] => schema!.properties.uploads.items.enum;

const setUploadOptions = (value: string[]): void => {
  schema!.properties.uploads.items.enum = value;
  monacoYaml.update({
    schemas: [defaultSchema],
  });
};

const updateUploadOptions = (...value: string[]): boolean => {
  let knownUploads = getUploadOptions();
  const sizeBefore = knownUploads.length;
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

const ed = monaco.editor.create(document.getElementById("editor")!, {
  automaticLayout: true,
  model: monaco.editor.createModel(
    value,
    "yaml",
    monaco.Uri.parse("monaco-yaml.yaml")
  ),
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

monaco.editor.onDidChangeMarkers(([resource]) => {
  const problems = document.getElementById("problems")!;
  const markers = monaco.editor.getModelMarkers({ resource });
  while (problems.lastChild) {
    problems.lastChild.remove();
  }
  for (const marker of markers) {
    if (marker.severity === monaco.MarkerSeverity.Hint) {
      continue;
    }
    const wrapper = document.createElement("div");
    wrapper.setAttribute("role", "button");
    const codicon = document.createElement("div");
    const text = document.createElement("div");
    wrapper.classList.add("problem");
    codicon.classList.add(
      "codicon",
      marker.severity === monaco.MarkerSeverity.Warning
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
  const text = uploadInput.value.trim() ?? "";
  if (text === "") return;
  const wasNew = updateUploadOptions(text);
  if (!wasNew) return;

  const model = ed.getModel();

  const rawConfigText = model?.getValue() ?? "";
  const config = yaml.parse(rawConfigText);
  console.log(config);

  const doc = yaml.parseDocument(rawConfigText);
  let uploads = doc.get("uploads") as unknown as yaml.YAMLSeq | undefined;
  if (uploads === undefined) {
    uploads = doc.createNode([]) as unknown as yaml.YAMLSeq;
    doc.set("uploads", uploads);
  }

  if (
    uploads.items.find(
      (i) =>
        ((i as yaml.Pair<yaml.ParsedNode, yaml.ParsedNode>)
          .value as unknown as string) === text
    ) !== undefined
  )
    return;
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
  const roundTrippedText = doc.toString({ indent: TAB_SIZE });
  model?.setValue(roundTrippedText);
});

popUploadButton!.addEventListener("click", () => {
  const knownUploads = getUploadOptions();
  knownUploads.splice(0, 1);
  console.log(knownUploads);
  setUploadOptions(knownUploads);
});

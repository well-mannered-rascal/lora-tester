// lora tester 2024

import { join } from "@std/path";

import { fileExists, getFilesWithExtension, loadJsonFile } from "./util.ts";

// CONSTANTS
const PROJECT_CONF_FILENAME = "project.json" as const;

/**
 * Connect to a comfy ui instance on the given serverUrl with the given message handlers
 */
// function connect(
//   serverUrl: string,
//   onMessage: (event: MessageEvent) => void,
//   onError: (event: Event) => void,
//   onOpen?: (event: Event) => void,
//   onClose?: (event: Event) => void,
// ) {
//   const socket = new WebSocket(serverUrl);
//   socket.addEventListener("message", onMessage);
//   socket.addEventListener("error", onError);

//   onOpen && socket.addEventListener("open", onOpen);
//   onClose && socket.addEventListener("close", onClose);
// }

// Function to execute a single workflow and await its completion
async function executePromptSync(
  workflow: JSON,
  serverUrl: string,
  socket: WebSocket,
): Promise<void> {
  const payload = {
    prompt: workflow,
    clientId: "LORA_TESTER",
  };

  const response = await fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute workflow: ${response.statusText}`);
  }

  // Extract the prompt ID from the response
  const { prompt_id } = await response.json();
  console.log(`Prompt ID ${prompt_id} submitted, awaiting completion...`);

  // Wait for the WebSocket notification for this specific prompt ID
  const result = await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      console.log(event.data);
      const message = JSON.parse(event.data);
      if (message.prompt_id === prompt_id && message.status === "completed") {
        console.log(`Prompt ID ${prompt_id} completed.`);
        socket.removeEventListener("message", onMessage); // Clean up listener

        // TODO: fetch result

        resolve(); // Resolve the promise to proceed to the next prompt
      }
    };

    socket.addEventListener("message", onMessage);
  });

  console.log("result", result);
}

async function main() {
  // Get filepath from user, check if project config exists already
  if (Deno.args.length < 1) {
    console.log("Usage: ./lora-tester /path/to/loras");
    return;
  }
  const projectPath = Deno.args[0];

  // TODO check if dir actually exists

  // check file path for config file
  const projectConfPath = join(projectPath, PROJECT_CONF_FILENAME);

  const hasProjectConfig = await fileExists(projectConfPath);

  // if no config file, copy and prompt user to edit config before re-running
  if (!hasProjectConfig) {
    const projectConfPath = `${projectPath}/${PROJECT_CONF_FILENAME}`;
    await Deno.copyFile(
      join(".", "ProjectConfigTemplate.json"),
      projectConfPath,
    );

    console.log("New project detected, adding default project config.");
    console.log("Please edit project config before running this script");
    return;
  }

  // load config file
  const projectConf = await loadJsonFile(projectConfPath);

  // load list of available lora model names
  const loraNames = await getFilesWithExtension(projectPath, ".safetensors");

  // connect to comfy socket stream, wait for connection to be established
  const comfySocket = new WebSocket(projectConf["serverUrl"]);
  await new Promise((resolve) => (comfySocket.onopen = resolve));

  // load workflow template as text and apply project generation config values
  const workflowData = await Deno.readFile(join(".", "default_workflow.json"));
  let workflowTemplateStr = workflowData.toString();
  for (const [key, value] of Object.entries(projectConf["generationParams"])) {
    const placeholder = `\${${key}}`;
    workflowTemplateStr = workflowTemplateStr.replaceAll(
      placeholder,
      JSON.stringify(value),
    );
  }

  // start generation loop
  for (const lora of loraNames) {
    for (const loraStrength of projectConf["loraStrengthValues"]) {
      for (const testPromptConf of projectConf["testPrompts"]) {
        // TODO: proper aspect ratio testing, for now just copy baseResolution to height and width
        workflowTemplateStr.replaceAll(
          "${height}",
          JSON.stringify(projectConf["baseResolution"]),
        );
        workflowTemplateStr.replaceAll(
          "${width}",
          JSON.stringify(projectConf["baseResolution"]),
        );

        // load triggerTokens into positive prompt
        const positive = (testPromptConf["positive"] as string).replaceAll(
          "${triggerTokens}",
          projectConf["triggerTokens"],
        );

        // apply positive and negative
        workflowTemplateStr.replaceAll(
          "${positive}",
          positive,
        );
        workflowTemplateStr.replaceAll(
          "${negative}",
          testPromptConf["negative"],
        );

        // Convert to JSON and execute
        const payload = JSON.parse(workflowTemplateStr);
      }
    }
  }

  //
}

if (import.meta.main) {
  main();
}

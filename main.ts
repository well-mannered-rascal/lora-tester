// lora tester 2024

// TODO for next sesh 11/7/24
/**
 *  - investigate why the fuck i cant get
 *
 * - investigate how to programmatically bypass lora node to enable "reference outputs" for each prompt batch
 *
 * - verify that processed output from /history request still has prompt data on it
 *
 * -various inline TODOs all over the code
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";

import {
  fileExists,
  getFilesWithExtension,
  getUniqueFilePath,
  loadJsonFile,
  saveReadableStreamToFile,
} from "./util.ts";
import { createUniqueDirectory } from "./util.ts";

// CONSTANTS
const PROJECT_CONF_FILENAME = "project.json" as const;
const TEST_RESULT_DIRNAME = "test_runs";

/**
 * Take a workflow payload and execute it, waiting for the result
 * @param workflow
 * @param serverUrl
 * @param socket
 * @returns The prompt_id for optional fetching at a later time
 */
async function executePromptSync(
  workflow: JSON,
  serverUrl: string,
  socket: WebSocket,
): Promise<string> {
  const payload = {
    prompt: workflow,
    clientId: "LORA_TESTER",
  };

  const response = await fetch(`${serverUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute workflow: ${response}`);
  }

  // Extract the prompt ID from the response
  const { prompt_id } = await response.json();
  console.log(`Prompt ID ${prompt_id} submitted, awaiting completion...`);

  // Wait for the WebSocket notification for this specific prompt ID
  await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (
        message.data.prompt_id === prompt_id && message.data.value &&
        message.data.max && message.data.value === message.data.max
      ) {
        console.log(`Prompt ID ${prompt_id} completed.`);
        socket.removeEventListener("message", onMessage); // Clean up listener

        resolve(); // Resolve the promise to proceed to the next prompt
      }
    };

    socket.addEventListener("message", onMessage);
  });

  return prompt_id;
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

  // load available models and loras
  const availableModels = await fetch(
    `${projectConf["serverUrl"]}/models/checkpoints`,
  ).then((response) => response.json(), (error) => {
    console.error(error);
    return false;
  }) as string[];
  const availableLoras = await fetch(
    `${projectConf["serverUrl"]}/models/loras`,
  ).then((response) => response.json(), (error) => {
    console.error(error);
    return false;
  }) as string[];

  if (!availableModels || !availableLoras) {
    console.log(
      "Failed to load model lists, check your `serverUrl` config value!!",
    );
    return;
  }

  // load list of this project's checkpoint and lora model names
  const projectLoraNames = await getFilesWithExtension(
    projectPath,
    ".safetensors",
  );
  const projectModelName = projectConf["generationParams"]["ckpt_name"];

  // check that model name is actually present on ComfyUI server
  const remoteModelName = availableModels.find((value) => {
    return value.includes(projectModelName);
  });

  // check that lora names are actually present on ComfyUI server
  const remoteLoraNames: string[] = [];
  for (const loraName of projectLoraNames) {
    const remoteLoraName = availableLoras.find((value) => {
      return value.includes(loraName);
    });

    remoteLoraName && remoteLoraNames.push(remoteLoraName);
  }

  // connect to comfy socket stream, wait for connection to be established
  const comfySocketUrl = `${
    (projectConf["serverUrl"] as string).replace(/^https?/, "ws")
  }/ws`;
  console.log(comfySocketUrl);
  const comfySocket = new WebSocket(comfySocketUrl);

  try {
    await new Promise((resolve, reject) => {
      comfySocket.onopen = (ev) => resolve(ev);
      comfySocket.onerror = (ev) => reject(ev);
    });
    console.log("Connected to ComfyUI websocket successfully.");
  } catch (error) {
    const errMsg = (error as ErrorEvent)["error"];
    console.error("Failed to connect to Comfy server: ", errMsg || error);
  }

  // load workflow template as text and apply top level project conf generationParams
  let workflowTemplateStr = await Deno.readTextFile(
    join(".", "default_workflow.json"),
  );
  for (let [key, value] of Object.entries(projectConf["generationParams"])) {
    const placeholder = `"\${${key}}"`;

    if (key === "ckpt_name") {
      value = remoteModelName;
    } else if (key === "seed" && value === -1) {
      value = Math.floor(Math.random() * (10000000000));
      console.log("random seed", value);
    }
    workflowTemplateStr = workflowTemplateStr.replaceAll(
      placeholder,
      JSON.stringify(value),
    );
  }

  // calculate total image output number, multiplied by two when enableReferenceOutputs is enabled
  // TODO: Be smart and actually check how many test prompts are enabled
  let totalTestOutputs = remoteLoraNames.length *
    (projectConf["loraStrengthValues"] as number[]).length *
    Object.keys(projectConf["testPrompts"]).length *
    (projectConf["generationParams"]["batch_size"] as number);

  projectConf["enableReferenceOutputs"] && (totalTestOutputs *= 2);

  console.log("Expected image output count: ", totalTestOutputs);

  // TODO: Prompt user after displaying expected image count to get consent first <3

  // ensure output and test run directories are created if necessary
  let testRunDir;
  if (projectConf["saveOutputsLocally"]) {
    await ensureDir(join(projectPath, TEST_RESULT_DIRNAME));

    testRunDir = await createUniqueDirectory(
      join(projectPath, TEST_RESULT_DIRNAME, projectConf["testRunName"]),
    );
  }

  // start generation loop
  for (const lora of remoteLoraNames) {
    for (const loraStrength of projectConf["loraStrengthValues"]) {
      // TODO: Support lora clip strength values as well
      for (const promptConf of projectConf["testPrompts"]) {
        // TODO: support enableReferenceOutputs, figure out how to bypass lora node most effectively, perhaps bypass: true might work

        // check  if this prompt is actually enabled
        if (!promptConf["enabled"]) {
          console.log("Skipped prompt: ", promptConf["name"]);
          continue;
        }

        // TODO: proper aspect ratio testing, for now just copy baseResolution to height and width
        // iterate over a canned list of aspect ratios and calculate latent dimensions from base resolution
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          "${height}",
          JSON.stringify(projectConf["baseResolution"]),
        );
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          "${width}",
          JSON.stringify(projectConf["baseResolution"]),
        );

        // load triggerTokens into positive prompt
        console.log(promptConf["positive"] as string);
        const positive = (promptConf["positive"] as string).replaceAll(
          "${triggerTokens}",
          projectConf["triggerTokens"],
        );

        // apply positive and negative
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          "${positive}",
          positive,
        );
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          "${negative}",
          promptConf["negative"],
        );

        // Apply lora model name and strength values
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          '"${loraModel}"',
          JSON.stringify(lora),
        );
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          '"${loraStrength}"',
          JSON.stringify(loraStrength),
        );
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          '"${loraClipStrength}"',
          "1",
        ); // TODO: support loraClipStrength array

        // apply filename {loraName}^{loraStrength}-{with/without}-{promptName}-{batchNumber}.png
        const filenamePrefix = `${
          projectConf["testRunName"]
        }-${lora}^${loraStrength}-${promptConf["name"]}`;
        workflowTemplateStr = workflowTemplateStr.replaceAll(
          "${filenamePrefix}",
          filenamePrefix,
        );

        // Convert to JSON and execute
        const payload = JSON.parse(workflowTemplateStr);

        const promptId = await executePromptSync(
          payload,
          projectConf["serverUrl"],
          comfySocket,
        );

        // Fetch image from /history if we actually want to save it locally as well
        if (projectConf["saveOutputsLocally"] && testRunDir) {
          const historyResponse = await fetch(
            `http://localhost:8188/history/${promptId}`,
            {
              method: "GET",
              headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "User-Agent": "Mozilla/5.0", // Simulate a browser request
                "Connection": "keep-alive",
                "Host": "localhost:8188"
              },
            },
          );

          console.log(historyResponse);

          console.log(`http://localhost:8188/history/${promptId}`);
          const promptInfo = await historyResponse.text();
          console.log(promptInfo);
          // if (!historyResponse.body) {
          //   throw new Error(
          //     "Failed to get ReadableStream from /history response!",
          //   );
          // }

          // ./output/{}

          // save history response as png
          // const fullUniqueFilePath = getUniqueFilePath(join(testRunDir, `${filenamePrefix}.png`))
          // await saveReadableStreamToFile(historyResponse.body, './sandbox/test.png')
        }

        return;
      }
    }
  }

  //
}

if (import.meta.main) {
  main();
}

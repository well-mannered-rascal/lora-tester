// lora tester 2024

// TODO for next sesh 11/8/24
/**
 * - investigate how to programmatically bypass lora node to enable "reference outputs" for each prompt batch
 *
 * -various inline TODOs all over the code
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";

import {
  fileExists,
  getFilesWithExtension,
  loadJsonFile,
  logInPlace,
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
  await new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (
        message.data.prompt_id === prompt_id && message.data.value &&
        message.data.max
      ) {
        logInPlace(
          `Progress: ${
            Math.trunc((message.data.value / message.data.max) * 100)
          }%`,
        );

        if (message.data.value === message.data.max) {
          console.log("\n");
          console.log(`Prompt ID ${prompt_id} completed.`);
          socket.removeEventListener("message", onMessage); // Clean up listener

          resolve(); // Resolve the promise to proceed to the next prompt
        }
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
  const totalTestOutputs = remoteLoraNames.length *
    (projectConf["loraStrengthValues"] as number[]).length *
    Object.keys(projectConf["testPrompts"]).length *
    (projectConf["generationParams"]["batch_size"] as number);

  // TODO: support enableReferenceOutputs
  // projectConf["enableReferenceOutputs"] && (totalTestOutputs *= 2);

  console.log("Expected image output count: ", totalTestOutputs);

  //  Prompt user after displaying expected image count to get consent first <3
  const bigAssBatchConsent = prompt("Consent to batch size: (y/n)");
  if (bigAssBatchConsent === "n") {
    comfySocket.close();
    return;
  }

  // ensure output and test run directories are created if necessary
  let testRunDir;
  if (projectConf["saveOutputsLocally"]) {
    await ensureDir(join(projectPath, TEST_RESULT_DIRNAME));

    testRunDir = await createUniqueDirectory(
      join(projectPath, TEST_RESULT_DIRNAME, projectConf["testRunName"]),
    );
    console.log(`New test run directory: ${testRunDir}`);
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

        // make a copy so we actually get a fresh template for each prompt :P
        let workflowStr = workflowTemplateStr;

        // TODO: proper aspect ratio testing, for now just copy baseResolution to height and width
        // iterate over a canned list of aspect ratios and calculate latent dimensions from base resolution
        workflowStr = workflowStr.replaceAll(
          "${height}",
          JSON.stringify(projectConf["baseResolution"]),
        );
        workflowStr = workflowStr.replaceAll(
          "${width}",
          JSON.stringify(projectConf["baseResolution"]),
        );

        // load triggerTokens into positive prompt
        const positive = (promptConf["positive"] as string).replaceAll(
          "${triggerTokens}",
          projectConf["triggerTokens"],
        );

        // apply positive and negative
        workflowStr = workflowStr.replaceAll(
          "${positive}",
          positive,
        );
        workflowStr = workflowStr.replaceAll(
          "${negative}",
          promptConf["negative"],
        );

        // Apply lora model name and strength values
        workflowStr = workflowStr.replaceAll(
          '"${loraModel}"',
          JSON.stringify(lora),
        );
        workflowStr = workflowStr.replaceAll(
          '"${loraStrength}"',
          JSON.stringify(loraStrength),
        );
        workflowStr = workflowStr.replaceAll(
          '"${loraClipStrength}"',
          "1",
        ); // TODO: support loraClipStrength array

        // apply filename {loraName}^{loraStrength}-{with/without}-{promptName}-{batchNumber}.png
        const filenamePrefix = `${
          projectConf["testRunName"]
        }-${lora}^${loraStrength}-${promptConf["name"]}`;
        workflowStr = workflowStr.replaceAll(
          "${filenamePrefix}",
          filenamePrefix,
        );

        // Convert to JSON and execute
        const payload = JSON.parse(workflowStr);

        const promptId = await executePromptSync(
          payload,
          projectConf["serverUrl"],
          comfySocket,
        );

        // Fetch image from /history if we actually want to save it locally as well
        if (projectConf["saveOutputsLocally"] && testRunDir) {
          // wait a bit because comfy fucking sucks balls
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // fetch prompt meta data necessary to fetch actual image (ass api design, 2 thumbs down)
          const historyResponse = await fetch(
            `${projectConf["serverUrl"]}/history/${promptId}`,
          );
          const promptInfo = await historyResponse.json();

          // identify filename, subfolder, and type from historyResponse (cuz this fuckin makes sense somehow)
          const imageMetas = promptInfo[promptId]["outputs"]["9"]["images"];
          if (!imageMetas) {
            console.log(
              "Failed to retreive completed prompt meta for prompt ID: ",
              promptId,
            );
            continue;
          }

          // For all images in imageMeta, grab the filename, subfolder, and type and make a /view request, save as png
          for (const imageMeta of imageMetas) {
            const queryParams = new URLSearchParams({
              ...imageMeta,
            });
            const viewResponse = await fetch(
              `${projectConf["serverUrl"]}/view?${queryParams.toString()}`,
            );
            if (!viewResponse.ok) {
              throw new Error("Failed to GET /view");
            }
            await saveReadableStreamToFile(
              viewResponse.body!,
              join(testRunDir, imageMeta["filename"]),
            );
          }
        }
      }
    }
  }
  comfySocket.close();
  console.log("All done! <3");
}

if (import.meta.main) {
  main();
}

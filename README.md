# Lora Tester

Utility for batch testing stable diffusion lora models.

## Usage (Compiled Binary Release)

`./lora_tester.exe <path/to/lora/models>`

If this is the first time running for the given directory, a `project.json` file
will be generated. You will be prompted to edit the configuration file before
running again. This file contains all of the necessary configuration and must be
fully configured for the program to run correctly.

## Configuration

A project.json template will be generated on first run of the command in the
directory specified by the user.

### project.json

```
{
  "testRunName": "",

  "serverUrl": "http://localhost:8188",

  "triggerTokens": "", // keywords to trigger your lora

  "baseResolution": 1024,

  // TODO: will toggle including reference images that do not have the lora applied for each prompt
  "enableReferenceOutputs": true, 

  // whether or not to save images to the local models dir
  "saveOutputsLocally": true,

  "loraStrengthValues": [
    1.0,
    0.75
  ],

  // TODO not implemented
  "_loraClipStrengthValues": [
    1.0
  ],

  // Configure the names exactly as you would in comfy
  "generationParams": {
    "ckpt_name": "",
    "sampler_name": "euler_ancestral",
    "scheduler": "sgm_uniform",
    "steps": 20,
    "cfg": 7,
    "seed": -1, // Seed for the whole test run. -1 is random
    "batch_size": 1
  },

  // Add your custom test prompts here following the same format. Use ${triggerTokens} to place where your activation tokens should go.
  "testPrompts": [
    {
      "name": "init",
      "enabled": true,
      "positive": "${triggerTokens}",
      "negative": ""
    },
    {
      "name": "simple_portrait",
      "enabled": true,
      "positive": "${triggerTokens}, looking at viewer, arms crossed, happy, outdoors, portrait, simple background",
      "negative": ""
    }
  ]
}
```

## Boring Design Stuff

A command line utility that takes a directory of models, a generation config,
and a trigger word/base prompt, and runs each model at different strength
intervals through a series of pre-made prompts. For each prompt, an output
without the lora applied will be included for visual reference. The utility
should focus on pose, setting, shot length, expression, and style, and
eventually include less important variety such as time of day, clothing, etc.

### Requirements

- Show progress live in terminal window (images generated / total expected)
  - include prompt name currently running

- Project configuration:
  - name of test run
  - trigger token(s)
  - server url
  - base resolution to use (to calculate non square aspect ratios from)
  - test prompts
  - generation parameters
  - should use variable names directly from comfyui where applicable
  - array of strength values to try
- Test prompts:
  - should be toggleable
  - configurable in the main project config
  - have preloaded defaults in the main config
  - should be static and unchanging (no dynamic prompt-type stuff)
  - default included test prompts should cover pose, style, and setting variety
    at the minimum
- Outputs:
  - reside under /outputs in project directory
  - outputs/{runName}/{promptName}/
  - filenames:
    - {testRunName}-{loraName}^{loraStrength}-{promptName}-{batchNumber}.png

### Program Sequence

1. User runs script with a path to a project directory
   `./lora-tester path/to/loras`
   - this creates a new project config in the directory, and an empty `/output`
     folder
1. User edits config file to their preference
1. User runs script again `./lora-tester path/to/loras`
   - script calculates total permutations expected and prompts for user
     confirmation
1. For each lora:
   - For each lora strength config value
     - For each test prompt
       - for each aspect ratio
         - generate `$batchsize` number of images with lora
         - generate `$batchsize` number of images without lora

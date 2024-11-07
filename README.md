# Lora Tester

Utility for batch testing stable diffusion lora models.

## MVP

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
